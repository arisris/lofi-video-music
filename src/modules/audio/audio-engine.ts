// Audio engine — adapted from src_old/lib/audio.ts to the new store
// (clips/currentTime/playing, no separate bumpClips/isAudioInit).
import { getTotalDuration, useEditorStore } from "../../store/editor-store";
import { ensureAudioElement, runtime } from "../../shared/lib/runtime";
import type { TimelineClip } from "../../shared/types/clip";

function audioSettingsOf(clip: { settings: Record<string, unknown> }) {
  const s = clip.settings;
  return {
    volume: typeof s.volume === "number" ? s.volume : 1,
    playbackRate: typeof s.playbackRate === "number" ? s.playbackRate : 1,
    pan: typeof s.pan === "number" ? s.pan : 0,
    eqLow: typeof s.eqLow === "number" ? s.eqLow : 0,
    eqMid: typeof s.eqMid === "number" ? s.eqMid : 0,
    eqHigh: typeof s.eqHigh === "number" ? s.eqHigh : 0,
  };
}

export function initAudioEngine() {
  if (runtime.audioReady && runtime.audioCtx) return;
  const Ctor = window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new Ctor();
  const audioEl = ensureAudioElement();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;

  const source = audioCtx.createMediaElementSource(audioEl);
  const eqLow = audioCtx.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 150;
  const eqMid = audioCtx.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 1000;
  const eqHigh = audioCtx.createBiquadFilter();
  eqHigh.type = "highshelf";
  eqHigh.frequency.value = 4000;
  const gainNode = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  const dest = audioCtx.createMediaStreamDestination();

  let last: AudioNode = source;
  last.connect(eqLow); last = eqLow;
  last.connect(eqMid); last = eqMid;
  last.connect(eqHigh); last = eqHigh;
  last.connect(gainNode); last = gainNode;
  if (panner) { last.connect(panner); last = panner; }
  last.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.connect(dest);

  runtime.audioCtx = audioCtx;
  runtime.analyser = analyser;
  runtime.source = source;
  runtime.dest = dest;
  runtime.eqLow = eqLow;
  runtime.eqMid = eqMid;
  runtime.eqHigh = eqHigh;
  runtime.gainNode = gainNode;
  runtime.panner = panner;
  runtime.dataArray = new Uint8Array(analyser.frequencyBinCount);
  runtime.audioReady = true;
}

export function applyAudioSettings(clip: { settings: Record<string, unknown> }) {
  const audioEl = ensureAudioElement();
  const s = audioSettingsOf(clip);
  if (!runtime.audioReady || !runtime.audioCtx) {
    audioEl.volume = Math.min(1, s.volume);
    audioEl.playbackRate = s.playbackRate;
    return;
  }
  audioEl.volume = 1;
  audioEl.playbackRate = s.playbackRate;
  const t = runtime.audioCtx.currentTime;
  runtime.gainNode?.gain.setValueAtTime(s.volume, t);
  runtime.eqLow?.gain.setValueAtTime(s.eqLow, t);
  runtime.eqMid?.gain.setValueAtTime(s.eqMid, t);
  runtime.eqHigh?.gain.setValueAtTime(s.eqHigh, t);
  runtime.panner?.pan.setValueAtTime(s.pan, t);
}

function activeMusicClip() {
  const { clips, currentTime } = useEditorStore.getState();
  return clips.find(
    (c) =>
      c.type === "music" &&
      (c.settings.enabled as boolean | undefined) !== false &&
      currentTime >= c.start &&
      currentTime <= c.start + c.duration,
  );
}

/**
 * Clips to search for audio. On the /image route, music still comes from the
 * video route snapshot — mirrors src_old getClipsToSearch.
 */
export function clipsForAudio(): TimelineClip[] {
  const { clips, route, videoClips } = useEditorStore.getState();
  return route === "/image" ? [...(videoClips ?? []), ...clips] : clips;
}

export function activeMusicClipIn(list: TimelineClip[], time: number) {
  return list.find(
    (c) =>
      c.type === "music" &&
      (c.settings.enabled as boolean | undefined) !== false &&
      time >= c.start &&
      time <= c.start + c.duration,
  );
}

const toAbsoluteUrl = (url: string): string => {
  if (!url) return "";
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

/** At most one pending loadedmetadata seek per element (rapid src swaps). */
let pendingSeek: { el: HTMLAudioElement; handler: () => void } | null = null;

function setPendingSeek(el: HTMLAudioElement, handler: () => void) {
  if (pendingSeek && (pendingSeek.el !== el || pendingSeek.handler !== handler)) {
    try {
      pendingSeek.el.removeEventListener("loadedmetadata", pendingSeek.handler);
    } catch {
      /* noop */
    }
  }
  pendingSeek = { el, handler };
  el.addEventListener("loadedmetadata", handler, { once: true });
}

function clearPendingSeek(el: HTMLAudioElement, handler: () => void) {
  if (pendingSeek && pendingSeek.el === el && pendingSeek.handler === handler) {
    pendingSeek = null;
  }
}

/**
 * Move the playhead + sync <audio> — adapts src_old seekGlobal.
 * Swaps src when the active clip changes, sets the offset, play/pause follows state.
 */
export function seekTo(time: number) {
  const st = useEditorStore.getState();
  if (st.isRecording) return;
  const list = clipsForAudio();
  const next = Math.min(Math.max(0, time), getTotalDuration(st.clips));
  st.setTime(next);

  const audioEl = runtime.audioEl ?? ensureAudioElement();
  const clip = activeMusicClipIn(list, next);
  if (!clip || typeof clip.settings.audioUrl !== "string" || !clip.settings.audioUrl) {
    if (!audioEl.paused) audioEl.pause();
    return;
  }
  const url = clip.settings.audioUrl as string;
  const startOffset =
    typeof clip.settings.startOffset === "number" ? clip.settings.startOffset : 0;
  const playhead = next - clip.start + startOffset;
  const audioDur =
    typeof clip.settings.audioDuration === "number"
      ? (clip.settings.audioDuration as number)
      : clip.duration;

  if (toAbsoluteUrl(audioEl.src) !== toAbsoluteUrl(url)) {
    audioEl.src = url;
    applyAudioSettings(clip);
    const onLoaded = () => {
      clearPendingSeek(audioEl, onLoaded);
      if (playhead < audioDur) {
        try {
          audioEl.currentTime = Math.max(0, playhead);
        } catch { /* noop */ }
        applyAudioSettings(clip);
        if (useEditorStore.getState().playing) {
          void audioEl.play().catch(() => {});
        }
      } else {
        audioEl.pause();
      }
    };
    setPendingSeek(audioEl, onLoaded);
    if (audioEl.readyState >= 1) onLoaded();
  } else {
    if (playhead < audioDur) {
      try {
        audioEl.currentTime = Math.max(0, playhead);
      } catch { /* noop */ }
      applyAudioSettings(clip);
      if (useEditorStore.getState().playing && audioEl.paused) {
        void audioEl.play().catch(() => {});
      }
    } else {
      audioEl.pause();
    }
  }
}

export function playAudio() {
  initAudioEngine();
  const audioEl = ensureAudioElement();
  void runtime.audioCtx?.resume().catch(() => {});
  const st = useEditorStore.getState();
  st.setPlaying(true);
  const clip = activeMusicClipIn(clipsForAudio(), st.currentTime);
  if (!clip) { audioEl.pause(); return; }
  const url = typeof clip.settings.audioUrl === "string" ? clip.settings.audioUrl : "";
  const startOffset = typeof clip.settings.startOffset === "number" ? clip.settings.startOffset : 0;
  if (!url) { audioEl.pause(); return; }
  const audioDur = typeof clip.settings.audioDuration === "number" ? clip.settings.audioDuration : clip.duration;
  const playAt = (offset: number) => {
    if (offset >= audioDur) {
      audioEl.pause();
      return;
    }
    // Setting currentTime before metadata is ready throws/no-ops — defer.
    if (audioEl.readyState < 1) {
      const onLoaded = () => {
        clearPendingSeek(audioEl, onLoaded);
        try {
          audioEl.currentTime = Math.max(0, offset);
        } catch { /* noop */ }
        applyAudioSettings(clip);
        if (useEditorStore.getState().playing) {
          void audioEl.play().catch(() => {});
        }
      };
      setPendingSeek(audioEl, onLoaded);
      // Cached metadata can already be ready by the time we listen.
      if (audioEl.readyState >= 1) onLoaded();
      return;
    }
    try { audioEl.currentTime = Math.max(0, offset); } catch { /* noop */ }
    void audioEl.play().catch(() => {});
  };
  if (toAbsoluteUrl(audioEl.src) !== toAbsoluteUrl(url)) {
    audioEl.src = url;
    applyAudioSettings(clip);
    playAt(st.currentTime - clip.start + startOffset);
    return;
  }
  applyAudioSettings(clip);
  // Already at the right source: only re-seek when drifted to avoid churn.
  const playhead = st.currentTime - clip.start + startOffset;
  if (Math.abs(audioEl.currentTime - playhead) > 0.35 || audioEl.paused) {
    playAt(playhead);
  } else if (audioEl.paused) {
    void audioEl.play().catch(() => {});
  }
}

export function pauseAudio() {
  runtime.audioEl?.pause();
  useEditorStore.getState().setPlaying(false);
}

export function syncAudioToPlayhead() {
  // Called on seek/scrub: shift <audio> to follow the active clip.
  const audioEl = runtime.audioEl;
  if (!audioEl || audioEl.paused) return;
  const st = useEditorStore.getState();
  const clip = activeMusicClip();
  if (!clip || !clip.settings.audioUrl) { audioEl.pause(); return; }
  const startOffset = typeof clip.settings.startOffset === "number" ? clip.settings.startOffset : 0;
  const target = st.currentTime - clip.start + startOffset;
  if (Math.abs(audioEl.currentTime - target) > 0.4) {
    try { audioEl.currentTime = Math.max(0, target); } catch { /* noop */ }
  }
}

export function skipToNextTrack() {
  const { clips, currentTime, playing } = useEditorStore.getState();
  const musics = clips
    .filter((c) => c.type === "music" && (c.settings.enabled as boolean | undefined) !== false)
    .sort((a, b) => a.start - b.start);
  if (musics.length === 0) return;
  const next = musics.find((c) => c.start > currentTime + 0.1) ?? musics[0];
  if (playing) {
    useEditorStore.getState().setTime(next.start);
    playAudio();
  } else {
    useEditorStore.getState().setTime(next.start);
  }
}

export function skipToPrevTrack() {
  const { clips, currentTime, playing } = useEditorStore.getState();
  const musics = clips
    .filter((c) => c.type === "music" && (c.settings.enabled as boolean | undefined) !== false)
    .sort((a, b) => a.start - b.start);
  if (musics.length === 0) return;
  const idx = musics.findIndex((c) => currentTime >= c.start && currentTime <= c.start + c.duration);
  let target = musics[0];
  if (idx === -1) {
    target = [...musics].reverse().find((c) => c.start + c.duration < currentTime) ?? musics[0];
  } else if (currentTime - musics[idx].start > 2) {
    target = musics[idx];
  } else if (idx > 0) {
    target = musics[idx - 1];
  } else {
    target = musics[idx];
  }
  if (playing) {
    useEditorStore.getState().setTime(target.start);
    playAudio();
  } else {
    useEditorStore.getState().setTime(target.start);
  }
}

/** 0..1 level for the visualizer. See src_old/utils/helpers.ts getAudioReactivity. */
export function getAudioLevel(kind: "bass" | "mid" | "treble" | "volume" = "volume"): number {
  if (!runtime.analyser || !runtime.dataArray) return 0;
  if (!useEditorStore.getState().playing) return 0;
  runtime.analyser.getByteFrequencyData(runtime.dataArray as Uint8Array<ArrayBuffer>);
  const data = runtime.dataArray;
  const len = data.length;
  const avg = (a: number, b: number) => {
    let sum = 0;
    for (let i = a; i < b; i++) sum += data[i];
    return sum / Math.max(1, b - a) / 255;
  };
  switch (kind) {
    case "bass": return avg(0, Math.floor(len * 0.1) || 1);
    case "mid": return avg(Math.floor(len * 0.1), Math.floor(len * 0.5));
    case "treble": return avg(Math.floor(len * 0.5), len);
    default: return avg(0, len);
  }
}
