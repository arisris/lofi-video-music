// Spectrum bars, the first definition for the glviz clip.
//
// Everything a visualizer needs lives in this one file: its shader, its
// defaults and the schema for its inspector. Copy this shape, change the
// fragment source, and it is a new style.

import type { VisualizerDef } from "../types";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_audioLevel;
uniform float u_bars;
uniform float u_intensity;
uniform float u_glow;
uniform vec3  u_color;

// Bars grow up from a baseline, their reflection fills the strip below it.
const float REFLECTION = 0.32;
const float GAP = 0.24;

void main() {
  vec2 uv = v_texCoord;

  float baseline = 1.0 - REFLECTION;
  bool mirrored = uv.y < baseline;
  float y = mirrored ? 2.0 * baseline - uv.y : uv.y;

  float bars = max(1.0, u_bars);
  float slot = 1.0 / bars;
  float idx = floor(uv.x / slot);
  float fx = fract(uv.x / slot);

  // Smooth edges straight from the quad resolution, so the shader needs no
  // derivative extension to stay valid WebGL 1.0.
  float aaX = 1.5 / u_resolution.x;
  float aaY = 1.5 / u_resolution.y;

  float halfGap = GAP * 0.5;
  float dx = min(fx - halfGap, (1.0 - halfGap) - fx);
  float maskX = smoothstep(-aaX, aaX, dx);

  // Bass carries most of the energy, so bias the bin lookup instead of walking
  // the spectrum linearly and leaving the right-hand bars permanently dead.
  float t = (idx + 0.5) / bars;
  float level = texture2D(u_audio, vec2(pow(t, 1.6), 0.5)).r;

  float h = clamp(level * u_intensity, 0.0, 1.0);
  float top = baseline + h * REFLECTION;

  float maskY = smoothstep(-aaY, aaY, y - baseline) * smoothstep(-aaY, aaY, top - y);
  float alpha = maskX * maskY;

  // A pulsing line on the baseline keeps a quiet passage from reading as dead.
  float glowLine = exp(-abs(y - baseline) * 90.0) * (0.12 + u_audioLevel * 0.45);
  alpha = max(alpha, glowLine * maskX);

  if (alpha < 0.004) discard;

  float tip = smoothstep(0.0, 0.08, h * REFLECTION - (y - baseline));
  vec3 col = mix(u_color, vec3(1.0), tip * 0.5) + u_color * tip * u_glow;

  if (mirrored) {
    alpha *= (1.0 - (baseline - uv.y) / REFLECTION) * 0.7;
  }

  gl_FragColor = vec4(col, alpha);
}
`;

export const BarsVisualizer: VisualizerDef = {
  id: "bars",
  name: "Bars",
  icon: "icon-[ri--bar-chart-2-line]",
  audio: "fft",
  bins: 512,
  fragment: FRAGMENT,
  settings: {
    bars: 48,
    intensity: 1.8,
    glow: 0.5,
    color: "#3b82f6",
    opacity: 1,
  },
  fields: [
    { kind: "slider", key: "bars", label: "Bars", min: 4, max: 160, step: 1 },
    { kind: "slider", key: "intensity", label: "Intensity", min: 0.1, max: 4, step: 0.05 },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
    { kind: "color", key: "color", label: "Main Color" },
    { kind: "slider", key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01, scale: 100, unit: "%" },
  ],
};