// Kaleidoscope: audio-reactive mirror fold, optionally over a custom image.
//
// The second definition, and the first that uses an image field. With a
// picture set it warps that picture; without one it falls back to the 1x1 white
// texture and reads as a pure light pattern, so the style is usable either way.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";
import { TAU_GLSL, opacityField } from "../_core/shader";

// The audio texture carries a peak-hold row as well as the live one, so every
// sample names the row it wants. Leaving these at the midpoint would quietly
// blend the two and make this style follow decaying peaks instead of the
// actual signal.
const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;
uniform sampler2D u_image;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_segments;
uniform float u_spin;
uniform float u_twirl;
uniform float u_zoom;
uniform float u_bands;
uniform float u_radius;
uniform vec3  u_color;
uniform vec4  u_background;

${TAU_GLSL}

void main() {
  vec2 p = v_texCoord - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  float r = length(p);
  float a = atan(p.y, p.x);

  // Mirror into wedge segments: fold the angle into one sector, then reflect
  // it back across the sector's centre line. That fold is the kaleidoscope.
  float seg = max(2.0, floor(u_segments));
  float sector = TAU / seg;
  a = abs(mod(a, sector) - sector * 0.5);
  // Twirl bends each wedge into a spiral; zero keeps the classic straight fold.
  a += r * u_twirl;

  // Bass swells the zoom, and the overall level speeds the drift, so the
  // pattern breathes with the track instead of spinning at a constant rate.
  float bass = texture2D(u_audio, vec2(0.02, ${AUDIO_LIVE_V})).r;
  float zoom = u_zoom * (1.0 + bass * 0.35 + u_audioLevel * 0.20);
  float spin = u_time * u_spin * (0.40 + u_audioLevel * 1.60);

  vec2 q = vec2(cos(a + spin), sin(a + spin)) * (r * zoom) + 0.5;
  vec3 col = texture2D(u_image, fract(q)).rgb * u_color;

  // Concentric rings, each reading a different point of the spectrum. Twirl
  // shears them into a spiral; at zero they stay perfectly concentric.
  float ring = texture2D(u_audio, vec2(fract(r * u_bands - u_time * 0.10 + a * u_twirl * 0.159), ${AUDIO_LIVE_V})).r;
  col += u_color * ring * 0.55;
  col += u_color * u_audioLevel * 0.12;

  // Circular mask, dissolving radially into the background the user picked.
  //
  // The quad is square, so r reaches 0.5 at the edge midpoints but 0.707 in
  // the corners. Fading out only past 0.707 left every corner at full
  // strength, which is what made the effect read as a hard square; the
  // default radius of 0.5 inscribes a circle and clears the corners entirely.
  //
  // Alpha is mixed on the same falloff rather than scaled by it, so the
  // pattern stays opaque where it exists and only the surround takes the
  // background's alpha - scaling instead would make a transparent background
  // hide the pattern too, which is the opposite of what it is for.
  float edge = max(0.08, u_radius);
  float fade = 1.0 - smoothstep(edge - 0.14, edge, r);
  gl_FragColor = vec4(mix(u_background.rgb, col, fade), mix(u_background.a, 1.0, fade));
}
`;

export const KaleidoscopeVisualizer: VisualizerDef = {
  id: "kaleidoscope",
  name: "Kaleidoscope",
  icon: "icon-[ri--flower-line]",
  audio: "fft",
  fragment: FRAGMENT,
  settings: {
    segments: 8,
    spin: 0.35,
    twirl: 0,
    zoom: 1.4,
    bands: 6,
    radius: 0.5,
    color: "#a855f7",
    // Fully transparent by default: the visual floats over whatever backdrop the
    // timeline already has instead of stamping an opaque square on top of it.
    background: "#00000000",
    image: "",
    opacity: 1,
  },
  fields: [
    {
      kind: "slider",
      key: "segments",
      label: "Segments",
      min: 2,
      max: 24,
      step: 1,
    },
    { kind: "slider", key: "spin", label: "Spin", min: 0, max: 2, step: 0.01 },
    { kind: "slider", key: "twirl", label: "Twirl", min: 0, max: 3, step: 0.05 },
    {
      kind: "slider",
      key: "zoom",
      label: "Zoom",
      min: 0.2,
      max: 4,
      step: 0.05,
    },
    { kind: "slider", key: "bands", label: "Rings", min: 1, max: 24, step: 1 },
    // Capped at the quad's edge midpoint radius (0.5), not its corner radius
    // (0.707). The falloff has to finish before the quad runs out, otherwise
    // the pattern is still at full strength where the square stops and the
    // disc turns back into a box.
    {
      kind: "slider",
      key: "radius",
      label: "Radius",
      min: 0.15,
      max: 0.5,
      step: 0.01,
    },
    { kind: "color", key: "color", label: "Tint" },
    { kind: "color", key: "background", label: "Background", alpha: true },
    {
      kind: "image",
      key: "image",
      label: "Image",
      hint: "Optional. Warps a picture; without one it renders as light only.",
    },
    opacityField(),
  ],
  // A radial visual wants a square box; the default lower-half strip leaves it
  // stretched, so this is the first definition to use the bbox hook.
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.82;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};
