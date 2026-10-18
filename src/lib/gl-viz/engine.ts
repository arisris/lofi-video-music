// Renders a VisualizerDef onto the 2D canvas through the shared WebGL context.
//
// WebGLRenderer already owns the context, the full-screen quad and the uniform
// plumbing, and rain-gpu.ts already proved the composite path works: draw the
// quad offscreen, then drawImage it into the 2D context at the clip's bounding
// box. This module adds the two things that path lacks - textures and per-style
// programs - and stays ignorant of any individual visualizer.

import { WebGLRenderer, type UniformValue } from "../webgl-renderer";
import { runtime } from "../runtime";
import { hexToRGB, hexToRGBA } from "../../utils/helpers";
import { AUDIO_SAMPLER, IMAGE_SAMPLER, type BBox, type VisualizerDef } from "./types";
import type { AudioSource } from "./types";

const AUDIO_UNIT = 0;
const IMAGE_UNIT = 1;

// Audio is read into a private buffer, never runtime.dataArray. That array is
// shared with the legacy 2D visualizers; overwriting it here would hand them
// waveform data when they expect spectrum data in the same frame.
let audioBuffer = new Uint8Array(new ArrayBuffer(1024));
let floatBuffer = new Float32Array(1024);

/**
 * Decibel window the raw spectrum is mapped onto.
 *
 * getByteFrequencyData fixes its own window at -100..-30 dBFS. Music does not
 * live there: measured on a chord, the 90th percentile of the spectrum sat at
 * -126 dB while the content that was actually audible sat within a few dB of
 * the -30 ceiling. Every audible band therefore arrived as 246-255, the
 * differences between neighbouring bands collapsed into a handful of byte
 * steps, and the silhouette came out a solid block with a cliff. Reading raw
 * decibels keeps the full range and lets the window be chosen for music, and
 * leaves the legacy visualizers - which still read the byte array - untouched.
 */
const DB_FLOOR = -90;
// Deliberately above anything a track reaches. A lower ceiling pins the bass
// bars to full height, and a flat run of full-height bars is the block this
// window exists to avoid.
const DB_CEILING = -6;

// Peak hold lives here because the shader cannot own it: a per-bin peak has to
// survive across frames to be a peak. Row 1 of the audio texture carries it,
// which is what lets a definition draw the thin falling caps above its bars.
let peakBuffer = new Uint8Array(new ArrayBuffer(1024));
let audioTexels = new Uint8Array(new ArrayBuffer(2048));
let lastPeakAt = 0;

/** How long a bin's peak takes to fall from full scale to nothing. */
const PEAK_FALL_MS = 900;

/**
 * Peak holds are wall-clock, not per-frame: the same cap should take the same
 * time to descend whether the tab is drawing at 30 or 144fps.
 */
const updatePeaks = (now: number, bins: number): void => {
  const dt = lastPeakAt === 0 ? 16 : Math.min(200, now - lastPeakAt);
  lastPeakAt = now;
  const fall = (255 * dt) / PEAK_FALL_MS;

  for (let i = 0; i < bins; i++) {
    const live = audioBuffer[i];
    const held = peakBuffer[i] - fall;
    peakBuffer[i] = live > held ? live : (held > 0 ? held : 0);
  }
};

// Programs are keyed by id *and* a hash of the source, so editing a shader
// under HMR recompiles instead of silently reusing the old program.
const programs = new Map<string, WebGLProgram>();
let audioTexture: WebGLTexture | null = null;
let fallbackTexture: WebGLTexture | null = null;
// undefined = not requested yet, null = loading or failed
const imageTextures = new Map<string, WebGLTexture | null>();
// Intrinsic size of each uploaded picture, as width / height. A shader that
// draws a picture undistorted needs it: without the ratio there is no way to
// fit one inside a square without stretching it. 0 means "no usable image".
const imageAspects = new Map<string, number>();

const hashSource = (src: string): string => {
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return String(h);
};

const getProgram = (def: VisualizerDef): WebGLProgram | null => {
  const key = `${def.id}:${hashSource(def.fragment)}`;
  const cached = programs.get(key);
  if (cached) return cached;

  const program = WebGLRenderer.compileProgram(WebGLRenderer.DEFAULT_VERTEX_SHADER, def.fragment);
  if (!program) return null;

  // Drop the previous build of this style rather than letting HMR leak one.
  for (const existing of [...programs.keys()]) {
    if (existing.startsWith(`${def.id}:`)) programs.delete(existing);
  }
  programs.set(key, program);
  return program;
};

const setTextureParams = (gl: WebGLRenderingContext, tex: WebGLTexture) => {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
};

/**
 * Fills the audio texture for this frame.
 *
 * Spectrum data arrives as magnitudes 0-255. Waveform data arrives centred on
 * 128, so shaders reading `wave` subtract 0.5 themselves.
 *
 * When playback is paused the analyser holds its last buffer, which would leave
 * the visual frozen mid-beat. Decaying instead matches what render.ts does for
 * the legacy visualizers, so pausing fades out rather than sticking.
 */
const uploadAudio = (gl: WebGLRenderingContext, source: AudioSource, bins: number, isPlaying: boolean): number => {
  const analyser = runtime.analyser;
  const available = analyser ? analyser.frequencyBinCount : bins;
  if (audioBuffer.length !== available) audioBuffer = new Uint8Array(new ArrayBuffer(available));

  if (!analyser) {
    // Still upload, so u_audio is a valid texture rather than a null binding.
    // The audio engine starts lazily, and a clip can render before it does.
    audioBuffer.fill(0);
  } else if (isPlaying) {
    if (source === "wave") {
      analyser.getByteTimeDomainData(audioBuffer);
    } else {
      if (floatBuffer.length !== available) floatBuffer = new Float32Array(available);
      analyser.getFloatFrequencyData(floatBuffer);
      const span = DB_CEILING - DB_FLOOR;
      for (let i = 0; i < available; i++) {
        const t = (floatBuffer[i] - DB_FLOOR) / span;
        audioBuffer[i] = t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0;
      }
    }
  } else {
    for (let i = 0; i < audioBuffer.length; i++) {
      audioBuffer[i] = audioBuffer[i] > 4 ? audioBuffer[i] - 4 : 0;
    }
  }

  if (!audioTexture) audioTexture = gl.createTexture();
  if (peakBuffer.length !== available) peakBuffer = new Uint8Array(new ArrayBuffer(available));

  // Waveform rows have no meaningful peak height - a peak of a signal centred
  // on zero says nothing about how loud it is - so the hold row stays flat
  // rather than falling on the same clock.
  if (source === "fft") {
    updatePeaks(performance.now(), available);
  } else {
    lastPeakAt = 0;
    peakBuffer.fill(0);
  }

  if (audioTexels.length !== bins * 2) audioTexels = new Uint8Array(new ArrayBuffer(bins * 2));
  audioTexels.set(audioBuffer.subarray(0, bins), 0);
  audioTexels.set(peakBuffer.subarray(0, bins), bins);

  gl.bindTexture(gl.TEXTURE_2D, audioTexture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.LUMINANCE, bins, 2, 0,
    gl.LUMINANCE, gl.UNSIGNED_BYTE,
    audioTexels,
  );
  setTextureParams(gl, audioTexture);

  let sum = 0;
  const count = Math.min(bins, audioBuffer.length);
  for (let i = 0; i < count; i++) sum += audioBuffer[i];
  const mean = sum / Math.max(1, count) / 255;
  return source === "wave" ? Math.min(1, mean * 2) : mean;
};

/** 1x1 opaque white, bound to u_image so a sampler is never undefined. */
const getFallbackTexture = (gl: WebGLRenderingContext): WebGLTexture => {
  if (!fallbackTexture) {
    fallbackTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fallbackTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }
  setTextureParams(gl, fallbackTexture);
  return fallbackTexture;
};

/**
 * Textures are cached by URL and uploaded asynchronously; until one lands the
 * fallback stays bound, so swapping images mid-playback never stalls a frame.
 */
const getImageTexture = (gl: WebGLRenderingContext, url: string): WebGLTexture | null => {
  if (!url) return null;
  if (imageTextures.has(url)) return imageTextures.get(url) ?? null;

  imageTextures.set(url, null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    setTextureParams(gl, tex);
    imageTextures.set(url, tex);
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      imageAspects.set(url, img.naturalWidth / img.naturalHeight);
    }
  };
  img.onerror = () => {
    console.warn(`[glviz] could not load texture "${url}"`);
    imageTextures.delete(url);
    imageAspects.delete(url);
  };
  img.src = url;
  return null;
};

/**
 * Declared fields become uniforms under `u_<key>`: sliders as floats, toggles
 * as 0/1, colours as normalised vec3, and selects whose option values are
 * numeric so a shader can switch behaviour on one.
 *
 * A setting the clip does not carry falls back to the definition's own default.
 * Without that, a clip saved before a field existed pushes no uniform at all
 * and the shader renders nothing, because GLSL uniforms start at zero - and
 * `u_bars = 0` is not a sparse visual, it is an empty screen.
 */
const buildUniforms = (
  def: VisualizerDef,
  settings: Record<string, unknown>,
  bbox: BBox,
  time: number,
  level: number,
  bins: number,
  imageAspect: number,
): Record<string, UniformValue> => {
  const uniforms: Record<string, UniformValue> = {
    u_resolution: [bbox.width, bbox.height],
    u_time: time,
    u_audioLevel: level,
    u_audioBins: bins,
    // 0 when there is no picture, which is the signal for a shader to skip
    // drawing one rather than painting the 1x1 white fallback as a block.
    u_imageAspect: imageAspect,
  };

  for (const field of def.fields) {
    const value = settings[field.key] ?? def.settings[field.key];
    switch (field.kind) {
      case "slider":
        if (typeof value === "number" && Number.isFinite(value)) uniforms[`u_${field.key}`] = value;
        break;
      case "toggle":
        uniforms[`u_${field.key}`] = value === true ? 1 : 0;
        break;
      case "color":
        if (typeof value === "string") {
          uniforms[`u_${field.key}`] = field.alpha ? hexToRGBA(value) : hexToRGB(value);
        }
        break;
      case "select": {
        const option = field.options.find((o) => o.value === value);
        const numeric = option ? Number(option.value) : NaN;
        if (Number.isFinite(numeric)) uniforms[`u_${field.key}`] = numeric;
        break;
      }
      default:
        break;
    }
  }
  return uniforms;
};

/** Bounding box a clip should occupy, falling back to the legacy layout. */
export const resolveBBox = (def: VisualizerDef, w: number, h: number, settings: Record<string, unknown>): BBox =>
  def.bbox ? def.bbox(w, h, settings) : { x: 0, y: h / 2, width: w, height: h / 2 };

/**
 * Draws one frame of a visualizer into the 2D context at `bbox`.
 *
 * The composite happens here, in the same task as the draw, which is what lets
 * the WebGL output reach captureStream() in the recorder unchanged.
 */
export const drawVisualizer = (
  def: VisualizerDef,
  ctx2d: CanvasRenderingContext2D,
  bbox: BBox,
  settings: Record<string, unknown>,
  time: number,
  isPlaying: boolean,
): void => {
  const gl = WebGLRenderer.getContext();
  if (!gl) return;

  // Match the shared canvas to the destination once, then draw each visualizer
  // into its own rectangle. Resizing per draw would reallocate the drawing
  // buffer on every frame, which is what made stacking several clips expensive.
  const target = ctx2d.canvas;
  if (!WebGLRenderer.ensureSize(target.width, target.height)) return;

  const w = Math.max(1, Math.round(bbox.width));
  const h = Math.max(1, Math.round(bbox.height));
  const x = Math.round(bbox.x);
  const y = Math.round(bbox.y);
  if (w > target.width || h > target.height) return;

  const program = getProgram(def);
  if (!program) return;

  const available = runtime.analyser?.frequencyBinCount ?? 1024;
  const bins = Math.max(1, Math.min(def.bins ?? available, available));
  const level = uploadAudio(gl, def.audio, bins, isPlaying);

  const imageField = def.fields.find((f) => f.kind === "image");
  const rawImage = imageField ? settings[imageField.key] : undefined;
  const imageUrl = typeof rawImage === "string" ? rawImage : "";
  const image = imageUrl ? getImageTexture(gl, imageUrl) : null;
  const imageAspect = image ? imageAspects.get(imageUrl) ?? 0 : 0;

  gl.activeTexture(gl.TEXTURE0 + AUDIO_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, audioTexture);
  gl.activeTexture(gl.TEXTURE0 + IMAGE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, image ?? getFallbackTexture(gl));

  // The viewport is in GL space, whose origin is the bottom-left corner.
  const glY = target.height - y - h;
  const glCanvas = WebGLRenderer.drawQuadAt(
    program,
    buildUniforms(def, settings, bbox, time, level, bins, imageAspect),
    x, glY, w, h,
    { [AUDIO_SAMPLER]: AUDIO_UNIT, [IMAGE_SAMPLER]: IMAGE_UNIT },
  );

  // drawImage reads image coordinates, whose origin is the top-left - the
  // opposite end of the canvas from the viewport we just drew into. Since the
  // two canvases are the same size, the source rectangle is the clip's own
  // rect; passing the GL-space y here would copy the mirrored strip.
  // Copying only this rectangle keeps sibling clips from bleeding together.
  if (glCanvas) ctx2d.drawImage(glCanvas, x, y, w, h, x, y, w, h);
};