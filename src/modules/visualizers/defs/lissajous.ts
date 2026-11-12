// Lissajous: an audio X-Y scope - the waveform plotted against a delayed copy
// of itself, drawn as a glowing phosphor trace.
//
// The retro instrument look that the set was missing. It reads the time-domain
// row (audio: "wave", centred on 0.5) and traces X = sample(s), Y = sample(s +
// phase) as s runs across the buffer. The figure is drawn by finding each
// fragment's nearest point on the trace: a tight core plus a wide halo, which is
// what reads as a CRT phosphor. Rainbow colours the trace by its position, so
// the loop paints itself in hue.
//
// Cheap enough to run in a small square box: the per-fragment cost is a loop of
// two texture taps, capped by the Points control.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_points;
uniform float u_phase;
uniform float u_scale;
uniform float u_width;
uniform float u_grid;
uniform float u_glow;
uniform float u_rainbow;
uniform vec3  u_color;

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if (h < 1.0 / 6.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0 / 6.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0 / 6.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0 / 6.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0 / 6.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}

void main() {
  vec2 uv = v_texCoord;
  float ar = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);

  // Nearest point on the trace, and where on the loop it sits (for the hue).
  float minD = 100000.0;
  float minS = 0.0;
  for (int i = 0; i < 200; i++) {
    if (float(i) >= u_points) break;
    float s = float(i) / u_points;
    float wx = texture2D(u_audio, vec2(s, ${AUDIO_LIVE_V})).r - 0.5;
    float wy = texture2D(u_audio, vec2(fract(s + u_phase), ${AUDIO_LIVE_V})).r - 0.5;
    vec2 pt = vec2(wx, wy) * u_scale;
    float d = length(p - pt);
    if (d < minD) {
      minD = d;
      minS = s;
    }
  }

  // Width is in pixels, converted to this quad's units.
  float wUv = max(0.5, u_width) / u_resolution.y;
  float core = exp(-minD * minD / (wUv * wUv * 0.12));
  float halo = exp(-minD * minD / (wUv * wUv * 5.0)) * 0.55;
  float traceI = core + halo;

  // Retro scope graticule: centre cross plus an inscribed circle, drawn dim
  // so the trace stays the bright part.
  float gridM = 0.0;
  if (u_grid > 0.5) {
    vec2 g = abs(p);
    float axes = smoothstep(0.0016, 0.0004, min(g.x, g.y));
    float circ = smoothstep(0.0025, 0.0008, abs(length(p) - 0.32));
    gridM = max(axes, circ) * 0.22;
  }
  float intensity = max(traceI, gridM);
  if (intensity < 0.004) discard;

  vec3 col;
  if (u_rainbow > 0.5) {
    float hue = mod(minS * 360.0 + u_time * 20.0, 360.0);
    col = hsl2rgb(vec3(hue / 360.0, 0.85, 0.6));
  } else {
    col = u_color;
  }
  col *= 1.0 + u_audioLevel * 0.5;
  if (gridM > traceI) col = vec3(0.42, 0.52, 0.62);
  gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0));
}
`;

export const LissajousVisualizer: VisualizerDef = {
  id: "lissajous",
  name: "Lissajous",
  icon: "icon-[ri--infinity-line]",
  audio: "wave",
  bins: 512,
  fragment: FRAGMENT,
  settings: {
    grid: false,
    points: 120,
    phase: 0.25,
    scale: 0.8,
    width: 2.5,
    glow: 0.8,
    rainbow: false,
    color: "#4ade80",
    opacity: 1,
  },
  fields: [
    {
      kind: "slider",
      key: "points",
      label: "Points",
      min: 40,
      max: 200,
      step: 1,
    },
    {
      kind: "slider",
      key: "phase",
      label: "Phase",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "scale",
      label: "Scale",
      min: 0.2,
      max: 1.5,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "width",
      label: "Thickness",
      min: 0.5,
      max: 8,
      step: 0.5,
      unit: "px",
    },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "grid", label: "Scope grid" },
    { kind: "toggle", key: "rainbow", label: "Rainbow Mode" },
    { kind: "color", key: "color", label: "Trace Color" },
    {
      kind: "slider",
      key: "opacity",
      label: "Opacity",
      min: 0,
      max: 1,
      step: 0.01,
      scale: 100,
      unit: "%",
    },
  ],
  // A scope is square.
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.8;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};
