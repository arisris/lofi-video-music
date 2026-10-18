// Kaleidoscope: audio-reactive mirror fold, optionally over a custom image.
//
// The second definition, and the first that uses an image field. With a
// picture set it warps that picture; without one it falls back to the 1x1 white
// texture and reads as a pure light pattern, so the style is usable either way.

import type { VisualizerDef } from "../types";

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
uniform float u_zoom;
uniform float u_bands;
uniform vec3  u_color;

const float TAU = 6.2831853;

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

  // Bass swells the zoom, and the overall level speeds the drift, so the
  // pattern breathes with the track instead of spinning at a constant rate.
  float bass = texture2D(u_audio, vec2(0.02, 0.5)).r;
  float zoom = u_zoom * (1.0 + bass * 0.35 + u_audioLevel * 0.20);
  float spin = u_time * u_spin * (0.40 + u_audioLevel * 1.60);

  vec2 q = vec2(cos(a + spin), sin(a + spin)) * (r * zoom) + 0.5;
  vec3 col = texture2D(u_image, fract(q)).rgb * u_color;

  // Concentric rings, each reading a different point of the spectrum.
  float ring = texture2D(u_audio, vec2(fract(r * u_bands - u_time * 0.10), 0.5)).r;
  col += u_color * ring * 0.55;

  col *= smoothstep(0.78, 0.05, r);
  col += u_color * u_audioLevel * 0.12;

  gl_FragColor = vec4(col, 1.0);
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
    zoom: 1.4,
    bands: 6,
    color: "#a855f7",
    image: "",
    opacity: 1,
  },
  fields: [
    { kind: "slider", key: "segments", label: "Segments", min: 2, max: 24, step: 1 },
    { kind: "slider", key: "spin", label: "Spin", min: 0, max: 2, step: 0.01 },
    { kind: "slider", key: "zoom", label: "Zoom", min: 0.2, max: 4, step: 0.05 },
    { kind: "slider", key: "bands", label: "Rings", min: 1, max: 24, step: 1 },
    { kind: "color", key: "color", label: "Tint" },
    { kind: "image", key: "image", label: "Image", hint: "Optional. Warps a picture; without one it renders as light only." },
    { kind: "slider", key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01, scale: 100, unit: "%" },
  ],
  // A radial visual wants a square box; the default lower-half strip leaves it
  // stretched, so this is the first definition to use the bbox hook.
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.82;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};