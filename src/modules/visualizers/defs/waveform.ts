// Waveform: a single audio-reactive line centred on the clip, with a soft glow.
//
// Modern reinterpretation of the legacy Canvas 2D "waveform" visualizer. Reads
// the time-domain row of the audio texture and draws a smooth, glowing stroke.
//
// The curve is drawn as the perpendicular distance to a locally-linearised
// sample of the wave, not as a per-column vertical hit. That is what keeps the
// thickness even on steep stretches - a vertical test thins the line to nothing
// where the waveform climbs, which is what read as stiff and pixelated.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";
import {
  HSL_GLSL,
  glowField,
  rainbowField,
  mainColorField,
  opacityField,
} from "../_core/shader";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_audioLevel;
uniform float u_intensity;
uniform float u_thickness;
uniform float u_smooth;
uniform float u_mode;
uniform float u_glow;
uniform float u_rainbow;
uniform vec3  u_color;

${HSL_GLSL}

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

  vec3 lineCol = col * (1.0 + glow * 0.5);
  float alpha = core + glow * 0.7;

  if (u_mode > 0.5 && u_mode < 1.5) {
    // Mirror: a second line reflected across the centre, reusing the already
    // sampled neighbours so it costs no extra texture taps.
    vec2 tangentM = vec2(2.0, (yl - yr) * py);
    vec2 normalM = normalize(vec2(-tangentM.y, tangentM.x));
    float distM = abs((yPx - (1.0 - y0) * py) * normalM.y);
    float coreM = 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, distM);
    float glowM = exp(-max(distM - halfWidth, 0.0) / spread) * u_glow * (0.6 + u_audioLevel * 0.8);
    lineCol = col * (1.0 + max(glow, glowM) * 0.5);
    alpha = max(core, coreM) + max(glow, glowM) * 0.7;
  } else if (u_mode > 1.5) {
    // Filled: the area between the curve and the centre line, in a dimmer
    // wash of the same colour so the stroke stays the bright part.
    float lo = min(0.5, y0);
    float hiF = max(0.5, y0);
    float feather = 2.0 / py;
    float fill = smoothstep(lo - feather, lo + feather, uv.y)
               * (1.0 - smoothstep(hiF - feather, hiF + feather, uv.y));
    alpha = max(alpha, fill * 0.35);
    lineCol = mix(col * 0.6, lineCol, clamp(core + glow, 0.0, 1.0));
  }

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(lineCol, clamp(alpha, 0.0, 1.0));
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
    mode: "0",
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
      kind: "select",
      key: "mode",
      label: "Style",
      options: [
        { value: "0", label: "Line" },
        { value: "1", label: "Mirror" },
        { value: "2", label: "Filled" },
      ],
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
    glowField(),
    rainbowField(),
    mainColorField(),
    opacityField(),
  ],
  bbox: (w: number, h: number) => ({
    x: 0,
    y: h / 2 - 100,
    width: w,
    height: 200,
  }),
};
