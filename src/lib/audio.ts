import { editorStore } from "../store/editor-store";
import { runtime } from "./runtime";
import { getClipsToSearch } from "../utils/helpers";
import { bumpClips } from "../store/actions/timeline-actions";

export const reconnectAudioEngine = () => {
  if (!runtime.audioCtx || !runtime.audioEl) return;

  try {
    // Focus only on connecting audio nodes, not playback control
    if (!runtime.source) {
      runtime.source = runtime.audioCtx.createMediaElementSource(
        runtime.audioEl,
      );

      // Connect in series: source -> eqLow -> eqMid -> eqHigh -> gainNode -> panner -> analyser
      let lastNode: AudioNode = runtime.source;
      if (runtime.eqLow) {
        lastNode.connect(runtime.eqLow);
        lastNode = runtime.eqLow;
      }
      if (runtime.eqMid) {
        lastNode.connect(runtime.eqMid);
        lastNode = runtime.eqMid;
      }
      if (runtime.eqHigh) {
        lastNode.connect(runtime.eqHigh);
        lastNode = runtime.eqHigh;
      }
      if (runtime.gainNode) {
        lastNode.connect(runtime.gainNode);
        lastNode = runtime.gainNode;
      }
      if (runtime.panner) {
        lastNode.connect(runtime.panner);
        lastNode = runtime.panner;
      }
      lastNode.connect(runtime.analyser);
    }
  } catch (e) {
    console.warn("Audio reconnection failed:", e);
  }
};

export const applyAudioSettings = (
  clip: Record<string, any> | { settings?: Record<string, any> },
) => {
  if (!clip || !runtime.audioEl) return;

  const volumeVal = (clip.settings as Record<string, any>)?.volume ?? 1.0;

  // Apply volume. Keep base HTML5 volume fader at 1.0 maximum.
  // If the audio engine is not initialized yet, fall back to setting audioEl.volume (up to 1.0).
  if (!editorStore.getState().isAudioInit) {
    runtime.audioEl.volume = Math.min(1.0, volumeVal);
  } else {
    runtime.audioEl.volume = 1.0;
  }

  // Apply playback speed
  runtime.audioEl.playbackRate =
    (clip.settings as Record<string, any>)?.playbackRate ?? 1.0;

  // Apply EQ, Gain (Volume Boost) & Panning settings if audio engine is initialized
  if (editorStore.getState().isAudioInit && runtime.audioCtx) {
    const time = runtime.audioCtx.currentTime;
    if (runtime.gainNode) {
      runtime.gainNode.gain.setValueAtTime(volumeVal, time);
    }
    if (runtime.eqLow) {
      runtime.eqLow.gain.setValueAtTime(clip.settings?.eqLow ?? 0, time);
    }
    if (runtime.eqMid) {
      runtime.eqMid.gain.setValueAtTime(clip.settings?.eqMid ?? 0, time);
    }
    if (runtime.eqHigh) {
      runtime.eqHigh.gain.setValueAtTime(clip.settings?.eqHigh ?? 0, time);
    }
    if (runtime.panner) {
      runtime.panner.pan.setValueAtTime(clip.settings?.pan ?? 0, time);
    }
  }
};

export const initAudioEngine = () => {
  if (editorStore.getState().isAudioInit) {
    reconnectAudioEngine();
    return;
  }

  const AudioContextCtor =
    window.AudioContext || (window as any).webkitAudioContext;
  runtime.audioCtx = new AudioContextCtor();

  runtime.analyser = runtime.audioCtx.createAnalyser();
  runtime.analyser.fftSize = 512;
  runtime.analyser.smoothingTimeConstant = 0.8;

  if (!runtime.source) {
    runtime.source = runtime.audioCtx.createMediaElementSource(
      runtime.audioEl!,
    );
  }

  // Create 3-band EQ filters
  runtime.eqLow = runtime.audioCtx.createBiquadFilter();
  runtime.eqLow.type = "lowshelf";
  runtime.eqLow.frequency.value = 150;

  runtime.eqMid = runtime.audioCtx.createBiquadFilter();
  runtime.eqMid.type = "peaking";
  runtime.eqMid.Q.value = 1.0;
  runtime.eqMid.frequency.value = 1000;

  runtime.eqHigh = runtime.audioCtx.createBiquadFilter();
  runtime.eqHigh.type = "highshelf";
  runtime.eqHigh.frequency.value = 4000;

  // Create Gain Node for volume boost
  runtime.gainNode = runtime.audioCtx.createGain();

  // Create Stereo Panner Node
  runtime.panner = runtime.audioCtx.createStereoPanner
    ? runtime.audioCtx.createStereoPanner()
    : (null as unknown as StereoPannerNode);

  runtime.dest = runtime.audioCtx.createMediaStreamDestination();

  // Route in series: source -> eqLow -> eqMid -> eqHigh -> gainNode -> panner -> analyser -> outputs
  let lastNode: AudioNode = runtime.source;

  lastNode.connect(runtime.eqLow);
  lastNode = runtime.eqLow;

  lastNode.connect(runtime.eqMid);
  lastNode = runtime.eqMid;

  lastNode.connect(runtime.eqHigh);
  lastNode = runtime.eqHigh;

  lastNode.connect(runtime.gainNode);
  lastNode = runtime.gainNode;

  if (runtime.panner) {
    lastNode.connect(runtime.panner);
    lastNode = runtime.panner;
  }

  lastNode.connect(runtime.analyser);
  runtime.analyser.connect(runtime.audioCtx.destination);
  runtime.analyser.connect(runtime.dest);

  const bufferLength = runtime.analyser.frequencyBinCount;
  runtime.dataArray = new Uint8Array(bufferLength);

  editorStore.setState({ isAudioInit: true });
};

export const playAudio = () => {
  initAudioEngine();

  if (runtime.audioCtx.state === "suspended") {
    runtime.audioCtx.resume().catch((e) => console.warn(e));
  }

  if (!runtime.audioEl) return;
  const audioEl = runtime.audioEl;

  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state);

  const activeClip = clipsToSearch.find(
    (c: any) =>
      c.type === "music" &&
      c.settings?.enabled !== false &&
      state.currentTime >= c.start &&
      state.currentTime <= c.start + c.duration,
  );

  editorStore.setState({ isPlaying: true });

  if (activeClip) {
    const localTime = state.currentTime - activeClip.start;
    const playheadTime = localTime + (activeClip.settings.startOffset || 0);

    if (audioEl.src !== activeClip.settings.audioUrl) {
      audioEl.src = activeClip.settings.audioUrl;
    }

    // Apply current settings (volume, speed, pan, EQ)
    applyAudioSettings(activeClip);

    if (
      playheadTime < (activeClip.settings.audioDuration || activeClip.duration)
    ) {
      audioEl.currentTime = playheadTime;
      audioEl.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Playback prevented by browser policy.", error);
        }
      });
    } else {
      audioEl.pause();
    }
  } else {
    audioEl.pause();
  }
  bumpClips();
};

export const pauseAudio = () => {
  if (runtime.audioEl) {
    runtime.audioEl.pause();
  }
  editorStore.setState({ isPlaying: false });
  bumpClips();
};

export const skipToNextTrack = () => {
  const clipsToSearch = getClipsToSearch(editorStore.getState());

  const musicClips = clipsToSearch
    .filter((c: any) => c.type === "music" && c.settings?.enabled !== false)
    .sort((a: any, b: any) => a.start - b.start);

  if (musicClips.length === 0) return;

  const nextClip = musicClips.find(
    (c: any) => c.start > (editorStore.getState().currentTime || 0) + 0.1,
  );
  if (nextClip) {
    editorStore.setState({ currentTime: nextClip.start });
  } else {
    editorStore.setState({ currentTime: musicClips[0].start });
  }

  if (editorStore.getState().isPlaying) {
    playAudio();
  } else {
    bumpClips();
  }
};

export const skipToPrevTrack = () => {
  const clipsToSearch = getClipsToSearch(editorStore.getState());

  const musicClips = clipsToSearch
    .filter((c: any) => c.type === "music" && c.settings?.enabled !== false)
    .sort((a: any, b: any) => a.start - b.start);

  if (musicClips.length === 0) return;

  const curTime = editorStore.getState().currentTime || 0;
  const currentClipIdx = musicClips.findIndex(
    (c: any) => curTime >= c.start && curTime <= c.start + c.duration,
  );

  if (currentClipIdx !== -1) {
    const currentClip = musicClips[currentClipIdx];
    if (curTime - currentClip.start > 2) {
      editorStore.setState({ currentTime: currentClip.start });
    } else if (currentClipIdx > 0) {
      editorStore.setState({
        currentTime: musicClips[currentClipIdx - 1].start,
      });
    } else {
      editorStore.setState({ currentTime: currentClip.start });
    }
  } else {
    const prevClip = [...musicClips]
      .reverse()
      .find((c: any) => c.start + c.duration < curTime);
    if (prevClip) {
      editorStore.setState({ currentTime: prevClip.start });
    } else {
      editorStore.setState({ currentTime: musicClips[0].start });
    }
  }

  if (editorStore.getState().isPlaying) {
    playAudio();
  } else {
    bumpClips();
  }
};

// Deprecated selectTrack compatibility stub
export const selectTrack = (_index?: unknown, _autoPlay = true) => {
  console.warn("selectTrack is deprecated. Use timeline music clip controls.");
};
