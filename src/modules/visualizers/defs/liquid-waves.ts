// Liquid Wave: three layered, audio-driven sine waves with gradient fills.
//
// Modern reinterpretation of the legacy Canvas 2D "liquid_waves" visualizer.
// Each layer is tuned to a different band (bass / mid / high) so the stack
// moves with the track instead of as a single oscillator.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";
import { rainbowField, mainColorField, opacityField } from "../_core/shader";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_audioBins;
uniform float u_intensity;
uniform float u_amplitude;
uniform float u_speed;
uniform float u_layers;
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
  float x = uv.x;
  float y = uv.y; // 0 bottom, 1 top

  float nb = max(1.0, u_audioBins);

  // band levels
  float bass = 0.0;
  for (int i = 0; i < 8; i++) bass += texture2D(u_audio, vec2(float(i) / nb, ${AUDIO_LIVE_V})).r;
  bass /= 8.0;
  float mids = 0.0;
  int ms = int(nb * 0.15);
  for (int i = 0; i < 16; i++) mids += texture2D(u_audio, vec2(float(ms + i) / nb, ${AUDIO_LIVE_V})).r;
  mids /= 16.0;
  float highs = 0.0;
  int hs = int(nb * 0.5);
  for (int i = 0; i < 24; i++) highs += texture2D(u_audio, vec2(float(hs + i) / nb, ${AUDIO_LIVE_V})).r;
  highs /= 24.0;

  float t = u_time * u_speed;

  // layer parameters: amp, freq, speed, val, opacity, colorShift
  // We unroll three layers.
  float baseY = 0.28;

  // layer 0 (bass)
  float amp0 = 0.12 * u_amplitude * u_intensity;
  float freq0 = 0.003 * u_resolution.x;
  float val0 = bass;
  float op0 = 0.35;
  float shift0 = 0.0;
  float spd0 = t * 0.8;
  float disp0 = sin(x * freq0 + spd0) * amp0 * (0.3 + val0 * 1.7);
  float waveY0 = baseY + disp0;
  // layer 1 (mids)
  float amp1 = 0.08 * u_amplitude * u_intensity;
  float freq1 = 0.007 * u_resolution.x;
  float val1 = mids;
  float op1 = 0.45;
  float shift1 = 60.0;
  float spd1 = -t * 1.2;
  float disp1 = sin(x * freq1 + spd1) * amp1 * (0.3 + val1 * 1.7);
  float waveY1 = baseY + disp1;
  // layer 2 (highs)
  float amp2 = 0.05 * u_amplitude * u_intensity;
  float freq2 = 0.015 * u_resolution.x;
  float val2 = highs;
  float op2 = 0.55;
  float shift2 = 120.0;
  float spd2 = t * 1.8;
  float disp2 = sin(x * freq2 + spd2) * amp2 * (0.3 + val2 * 1.7);
  float waveY2 = baseY + disp2;

  // composite
  vec4 acc = vec4(0.0);
  // helper macro-ish: process layer
  // layer 0
  {
    float wy = waveY0;
    if (y <= wy) {
      float layerOp = op0;
      // gradient from wave top to bottom
      float gradT = clamp((wy - y) / max(0.01, wy), 0.0, 1.0);
      vec3 c1, c2;
      if (u_rainbow > 0.5) {
        float hue1 = mod(t * 12.0 + shift0, 360.0);
        float hue2 = mod(hue1 + 100.0, 360.0);
        c1 = hsl2rgb(vec3(hue1 / 360.0, 0.8, 0.6));
        c2 = hsl2rgb(vec3(hue2 / 360.0, 0.8, 0.4));
      } else {
        c1 = u_color;
        c2 = u_color;
      }
      vec3 col = mix(c1, c2, gradT);
      float a = layerOp * mix(1.0, 0.05, gradT);
      // stroke near top
      float stroke = smoothstep(0.006, 0.0, abs(y - wy)) * 0.6;
      if (u_rainbow > 0.5) {
        float hue1 = mod(t * 12.0 + shift0, 360.0);
        col = mix(col, hsl2rgb(vec3(hue1 / 360.0, 0.95, 0.72)), stroke);
      } else {
        col = mix(col, u_color, stroke);
      }
      a = max(a, stroke * layerOp);
      // over composite
      acc.rgb = acc.rgb * (1.0 - a) + col * a;
      acc.a = acc.a + (1.0 - acc.a) * a;
    }
  }
  // layer 1 (mids) — gated by the Layers control
  if (u_layers > 1.5) {
    float wy = waveY1;
    if (y <= wy) {
      float layerOp = op1;
      float gradT = clamp((wy - y) / max(0.01, wy), 0.0, 1.0);
      vec3 c1, c2;
      if (u_rainbow > 0.5) {
        float hue1 = mod(t * 12.0 + shift1, 360.0);
        float hue2 = mod(hue1 + 100.0, 360.0);
        c1 = hsl2rgb(vec3(hue1 / 360.0, 0.8, 0.6));
        c2 = hsl2rgb(vec3(hue2 / 360.0, 0.8, 0.4));
      } else {
        c1 = u_color;
        c2 = u_color;
      }
      vec3 col = mix(c1, c2, gradT);
      float a = layerOp * mix(1.0, 0.05, gradT);
      float stroke = smoothstep(0.006, 0.0, abs(y - wy)) * 0.6;
      if (u_rainbow > 0.5) {
        float hue1 = mod(t * 12.0 + shift1, 360.0);
        col = mix(col, hsl2rgb(vec3(hue1 / 360.0, 0.95, 0.72)), stroke);
      } else {
        col = mix(col, u_color, stroke);
      }
      a = max(a, stroke * layerOp);
      acc.rgb = acc.rgb * (1.0 - a) + col * a;
      acc.a = acc.a + (1.0 - acc.a) * a;
    }
  }
  // layer 2 (highs) — gated by the Layers control
  if (u_layers > 0.5) {
    float wy = waveY2;
    if (y <= wy) {
      float layerOp = op2;
      float gradT = clamp((wy - y) / max(0.01, wy), 0.0, 1.0);
      vec3 c1, c2;
      if (u_rainbow > 0.5) {
        float hue1 = mod(t * 12.0 + shift2, 360.0);
        float hue2 = mod(hue1 + 100.0, 360.0);
        c1 = hsl2rgb(vec3(hue1 / 360.0, 0.8, 0.6));
        c2 = hsl2rgb(vec3(hue2 / 360.0, 0.8, 0.4));
      } else {
        c1 = u_color;
        c2 = u_color;
      }
      vec3 col = mix(c1, c2, gradT);
      float a = layerOp * mix(1.0, 0.05, gradT);
      float stroke = smoothstep(0.006, 0.0, abs(y - wy)) * 0.6;
      if (u_rainbow > 0.5) {
        float hue1 = mod(t * 12.0 + shift2, 360.0);
        col = mix(col, hsl2rgb(vec3(hue1 / 360.0, 0.95, 0.72)), stroke);
      } else {
        col = mix(col, u_color, stroke);
      }
      a = max(a, stroke * layerOp);
      acc.rgb = acc.rgb * (1.0 - a) + col * a;
      acc.a = acc.a + (1.0 - acc.a) * a;
    }
  }

  if (acc.a < 0.004) discard;
  gl_FragColor = vec4(acc.rgb, clamp(acc.a, 0.0, 1.0));
}
`;

export const LiquidWavesVisualizer: VisualizerDef = {
  id: "liquid_waves",
  name: "Liquid Wave",
  icon: "icon-[ri--water-flash-line]",
  audio: "fft",
  fragment: FRAGMENT,
  settings: {
    layers: 3,
    intensity: 1.0,
    amplitude: 1.0,
    speed: 1.0,
    rainbow: false,
    color: "#3b82f6",
    opacity: 0.85,
  },
  fields: [
    {
      kind: "slider",
      key: "layers",
      label: "Layers",
      min: 1,
      max: 3,
      step: 1,
    },
    {
      kind: "slider",
      key: "intensity",
      label: "Intensity",
      min: 0.1,
      max: 4,
      step: 0.05,
    },
    {
      kind: "slider",
      key: "amplitude",
      label: "Amplitude",
      min: 0.1,
      max: 3,
      step: 0.05,
    },
    {
      kind: "slider",
      key: "speed",
      label: "Speed",
      min: 0.1,
      max: 3,
      step: 0.05,
    },
    rainbowField(),
    mainColorField(),
    opacityField(),
  ],
};
