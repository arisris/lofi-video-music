// Browser runtime refs. Simplified from src_old/lib/runtime.ts:
// all nullable, created lazily by the audio engine.
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
    const el = new Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    runtime.audioEl = el;
  }
  return runtime.audioEl;
}
