// Browser runtime refs — all nullable, created lazily by the audio engine.
export interface RuntimeRefs {
  audioCtx: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaElementAudioSourceNode | null;
  dest: MediaStreamAudioDestinationNode | null;
  eqLow: BiquadFilterNode | null;
  eqMid: BiquadFilterNode | null;
  eqHigh: BiquadFilterNode | null;
  gainNode: GainNode | null;
  panner: StereoPannerNode | null;
  dataArray: Uint8Array | null;
  audioEl: HTMLAudioElement | null;
  audioReady: boolean;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
}

export const runtime: RuntimeRefs = {
  audioCtx: null,
  analyser: null,
  source: null,
  dest: null,
  eqLow: null,
  eqMid: null,
  eqHigh: null,
  gainNode: null,
  panner: null,
  dataArray: null,
  audioEl: null,
  audioReady: false,
  canvas: null,
  ctx: null,
  mediaRecorder: null,
  recordedChunks: [],
};

export function ensureAudioElement(): HTMLAudioElement {
  if (!runtime.audioEl) {
    // Prefer the single hidden <audio id="audioElement"> in the DOM so the
    // engine and the preview tick share one element (one element = max one
    // MediaElementSource; two elements = analyser/recorder goes silent).
    if (typeof document !== "undefined") {
      const dom = document.getElementById(
        "audioElement",
      ) as HTMLAudioElement | null;
      if (dom) {
        runtime.audioEl = dom;
        return dom;
      }
    }
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    runtime.audioEl = el;
  }
  return runtime.audioEl;
}

/**
 * Bind the preview's hidden <audio> element. If the engine already wired a
 * different element (createMediaElementSource), re-wire the graph to the new
 * element so analyser + recorder destination keep receiving audio.
 */
export function bindAudioElement(el: HTMLAudioElement): HTMLAudioElement {
  if (runtime.audioEl === el) return el;
  if (!runtime.audioReady || !runtime.audioCtx || !runtime.source) {
    runtime.audioEl = el;
    return el;
  }
  try {
    runtime.source.disconnect();
  } catch {
    /* noop */
  }
  const source = runtime.audioCtx.createMediaElementSource(el);
  const entry = runtime.eqLow ?? runtime.gainNode ?? runtime.analyser;
  if (entry) {
    try {
      source.connect(entry);
    } catch {
      /* noop */
    }
  }
  runtime.source = source;
  runtime.audioEl = el;
  return el;
}
