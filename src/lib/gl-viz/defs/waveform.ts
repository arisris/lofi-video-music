// Waveform: a single audio-reactive line centred on the clip, with a soft glow.
//
// Modern reinterpretation of the legacy Canvas 2D "waveform" visualizer. Reads
// the time-domain row of the audio texture and draws a smooth, glowing stroke.
//
// The curve is drawn as the perpendicular distance to a locally-linearised
// sample of the wave, not as a per-column vertical hit. That is what keeps the
// thickness even on steep stretches - a vertical test thins the line to nothing
// where the waveform climbs, which is what read as stiff and pixelated.

import { AUDIO_LIVE_V, type VisualizerDef } from "../types";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_audioLevel;
uniform float u_intensity;
uniform float u_thickness;
uniform float u_smooth;
uniform float u_glow;
uniform float u_rainbow;
uniform vec3  u_color;

vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float h = 0.0, s = 0.0;
  float l = (mx + mn) * 0.5;
  float d = mx - mn;
  if (d > 0.0001) {
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

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

/**
 * Signed wave height at u, as an offset from the centre line.
 *
 * The texture filter is linear, so each tap already interpolates its two
 * neighbours; the gaussian across nine taps on top of that takes the
 * stair-stepping out of the high-frequency content and gives the line its
 * gentleness. Radius 0 collapses to a plain linear read.
 */
float waveAt(float u) {
  float radius = u_smooth * 0.08;
  float sum = 0.0;
  float wsum = 0.0;
  for (int i = -4; i <= 4; i++) {
    float w = exp(-float(i * i) * 0.30);
    float off = float(i) * 0.25 * radius;
    float s = texture2D(u_audio, vec2(clamp(u + off, 0.0, 1.0), ${AUDIO_LIVE_V})).r - 0.5;
    sum += s * w;
    wsum += w;
  }
  return sum / wsum;
}

void main() {
  vec2 uv = v_texCoord;
  float px = max(1.0, u_resolution.x);
  float py = max(1.0, u_resolution.y);

  // Height of the centre line in uv, then the same curve one pixel to either
  // side so the local tangent is known.
  float amp = u_intensity * 0.45;
  float y0 = 0.5 + waveAt(uv.x) * amp;
  float dxu = 1.0 / px;
  float yl = 0.5 + waveAt(uv.x - dxu) * amp;
  float yr = 0.5 + waveAt(uv.x + dxu) * amp;

  // Perpendicular distance in pixels to that tangent. Steep stretches keep the
  // full thickness this way instead of thinning into jaggies.
  float yPx = uv.y * py;
  vec2 tangent = vec2(2.0, (yr - yl) * py);
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));
  float dist = abs((yPx - y0 * py) * normal.y);

  float halfWidth = max(0.6, u_thickness * 0.5);
  float aa = 1.25;
  float core = 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, dist);

  // A wide exponential halo under the stroke is what stops it reading as a hard
  // pixel line; it breathes a little with the overall level.
  float spread = max(2.5, u_thickness * 3.5);
  float glow = exp(-max(dist - halfWidth, 0.0) / spread) * u_glow * (0.6 + u_audioLevel * 0.8);

  vec3 baseHsl = rgb2hsl(u_color);
  vec3 col;
  if (u_rainbow > 0.5) {
    float hue = mod(baseHsl.x * 360.0 + uv.x * 360.0, 360.0);
    col = hsl2rgb(vec3(hue / 360.0, max(0.7, baseHsl.y), clamp(baseHsl.z, 0.45, 0.65)));
  } else {
    col = u_color;
  }

  float alpha = core + glow * 0.7;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col * (1.0 + glow * 0.5), clamp(alpha, 0.0, 1.0));
}
`;

export const WaveformVisualizer: VisualizerDef = {
  id: "waveform",
  name: "Waveform",
  icon: "icon-[ri--pulse-line]",
  audio: "wave",
  bins: 512,
  fragment: FRAGMENT,
  settings: {
    intensity: 1.0,
    thickness: 2.5,
    smooth: 0.35,
    glow: 0.6,
    rainbow: false,
    color: "#3b82f6",
    opacity: 1,
  },
  fields: [
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
      key: "thickness",
      label: "Thickness",
      min: 0.5,
      max: 8,
      step: 0.5,
    },
    {
      kind: "slider",
      key: "smooth",
      label: "Smoothness",
      min: 0,
      max: 1,
      step: 0.01,
    },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "rainbow", label: "Rainbow Mode" },
    { kind: "color", key: "color", label: "Main Color" },
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
  bbox: (w: number, h: number) => ({
    x: 0,
    y: h / 2 - 100,
    width: w,
    height: 200,
  }),
};
