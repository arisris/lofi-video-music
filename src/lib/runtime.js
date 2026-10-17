// Shared runtime refs to browser resources used by the render/audio engines.
// JSDoc types are picked up by TypeScript during the migration.
export const runtime = {
  /** @type {AudioContext | null} */
  audioCtx: null,
  /** @type {AnalyserNode | null} */
  analyser: null,
  /** @type {MediaStreamAudioSourceNode | null} */
  source: null,
  /** @type {MediaStreamAudioDestinationNode | null} */
  dest: null,
  /** @type {BiquadFilterNode | null} */
  eqLow: null,
  /** @type {BiquadFilterNode | null} */
  eqMid: null,
  /** @type {BiquadFilterNode | null} */
  eqHigh: null,
  /** @type {GainNode | null} */
  gainNode: null,
  /** @type {StereoPannerNode | null} */
  panner: null,
  /** @type {Uint8Array | null} */
  dataArray: null,
  /** @type {MediaRecorder | null} */
  mediaRecorder: null,
  /** @type {HTMLCanvasElement | null} */
  canvas: null,
  /** @type {CanvasRenderingContext2D | null} */
  ctx: null,
  /** @type {HTMLAudioElement | null} */
  audioEl: null
};
