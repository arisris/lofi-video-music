// Shared runtime refs to browser resources used by the render/audio engines.
//
// Engine-side refs (audio graph, analyser, FFT buffer) are created before the
// render loop starts, so they are typed as non-null for consumer convenience.
// UI-side refs are set directly by React components and may be unset between
// mounts, so they stay nullable.
export interface RuntimeRefs {
  audioCtx: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
  dest: MediaStreamAudioDestinationNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  gainNode: GainNode;
  panner: StereoPannerNode;
  dataArray: Uint8Array<ArrayBuffer>;
  recordedChunks: Blob[];
  mediaRecorder: MediaRecorder | null;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  audioEl: HTMLAudioElement | null;
}

export const runtime: RuntimeRefs = {
  audioCtx: null!,
  analyser: null!,
  source: null!,
  dest: null!,
  eqLow: null!,
  eqMid: null!,
  eqHigh: null!,
  gainNode: null!,
  panner: null!,
  dataArray: null!,
  recordedChunks: [],
  mediaRecorder: null,
  canvas: null,
  ctx: null,
  audioEl: null,
};
