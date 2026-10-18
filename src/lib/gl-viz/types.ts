// Self-describing definition for a shader visualizer.
//
// Everything the render engine and the settings panel need lives here: the
// GLSL program, how the audio texture gets filled, the schema that drives the
// generated UI, and the defaults merged in when the style is picked. Adding a
// visualizer means adding one file to `defs/` and importing it - nothing else
// in the codebase needs to know it exists.

/** Rect in canvas pixels, matching the inline shape used across the renderer. */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Analysis that fills the audio texture uploaded to the fragment shader. */
export type AudioSource = "fft" | "wave";

/** One control in the generated settings UI. Rendered in array order. */
export type FieldSchema =
  | {
      kind: "slider";
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      /** Appended to the readout, e.g. "%" or "px". */
      unit?: string;
      /** Multiplies the readout only, so a 0-1 control can read as a percentage. */
      scale?: number;
    }
  | { kind: "color"; key: string; label: string }
  | { kind: "toggle"; key: string; label: string }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[] }
  /** Custom image from the media pool. Stored as a URL, resolved at draw time. */
  | { kind: "image"; key: string; label: string; hint?: string };

export interface VisualizerDef {
  /** Stable id, persisted on the clip as `settings.style`. */
  id: string;
  name: string;
  /** Iconify class, same convention as the other clip types. */
  icon: string;
  /** Which analysis the audio texture carries. */
  audio: AudioSource;
  /**
   * Samples uploaded per frame. Defaults to the analyser's frequencyBinCount.
   * Shaders sample it as `texture2D(u_audio, vec2(i / bins, 0.5))`.
   */
  bins?: number;
  /**
   * GLSL ES 1.00 fragment shader (WebGL1, since WebGLRenderer uses
   * WebGLRenderingContext). The full-screen quad vertex shader is shared via
   * WebGLRenderer.DEFAULT_VERTEX_SHADER, so definitions never repeat it.
   */
  fragment: string;
  /** Defaults merged into a clip when this style is selected. */
  settings: Record<string, unknown>;
  /** Drives the generated settings UI. */
  fields: FieldSchema[];
  /**
   * Clip bounding box in canvas pixels. Defaults to the full width over the
   * lower half, matching the legacy visualizer clip.
   */
  bbox?: (w: number, h: number) => BBox;
}

/** Shader sampler names every fragment shader may declare. */
export const AUDIO_SAMPLER = "u_audio";
/** Bound to a 1x1 white texture when a def declares no custom image. */
export const IMAGE_SAMPLER = "u_image";