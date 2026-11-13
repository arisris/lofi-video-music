// Circle: radial spectrum bars around a ring, with a pulsing core.
//
// Modern reinterpretation of the legacy Canvas 2D "circle" visualizer, now
// driven by a shader. Bass swells the bar length and the core breathes with it.
//
// Shape size scales the whole figure - ring, spokes and glow together. The
// spokes grow with the music and the glow trails past their tips, so a loud
// passage can reach the bounding box and be cut off flat at its edge; pulling
// the size down leaves room for the shadow without touching the spectrum.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";
import { HSL_GLSL, TAU_GLSL, glowField, rainbowField, mainColorField, opacityField } from "../_core/shader";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_audioLevel;
uniform float u_audioBins;
uniform float u_bars;
uniform float u_intensity;
uniform float u_width;
uniform float u_radius;
uniform float u_size;
uniform float u_glow;
uniform float u_pulse;
uniform float u_mode;
uniform float u_rainbow;
uniform vec3  u_color;

${TAU_GLSL}

${HSL_GLSL}

void main() {
  vec2 p = v_texCoord - 0.5;
  p.x *= u_resolution.x / u_resolution.y;
  // Dividing the radius instead of scaling the spokes is what makes this one
  // control for the whole figure: every distance below is measured in the same
  // space, so the ring, the bars, the glow and the core all shrink together and
  // the shadow keeps its proportions. The angle is untouched, so the spokes stay
  // where they are. 1.0 is the unscaled layout.
  float r = length(p) / max(0.05, u_size);
  float a = atan(p.y, p.x);

  float bars = max(8.0, u_bars);
  float sector = TAU / bars;
  // angular distance to the centre of the nearest spoke
  float angDist = abs(mod(a + 3.14159, sector) - sector * 0.5);

  float barIdx = floor((a + 3.14159) / sector);
  float idxNorm = barIdx / bars;

  // logarithmic band pick, matching the spectrum convention of the bars def
  float nb = max(1.0, u_audioBins);
  float hi = min(128.0, nb);
  float b0 = pow(hi, idxNorm);
  float b1 = pow(hi, (barIdx + 1.0) / bars);
  float centre = 0.5 * (b0 + b1);
  float level = texture2D(u_audio, vec2(centre / nb, ${AUDIO_LIVE_V})).r;
  float shaped = pow(level, 1.35);
  float barLen = shaped * u_intensity * 0.32;

  float inner = max(0.05, u_radius);
  float outer = inner + barLen;

  float spokeHalf = sector * 0.5 * clamp(u_width, 0.05, 1.0);
  float angMask = smoothstep(spokeHalf, spokeHalf * 0.25, angDist);

  // spoke body
  float inBar = step(inner, r) * step(r, outer) * angMask;
  // Dots variant: one bead per spoke riding the column tip instead of the
  // full column. The arc-length approximation keeps the beads circular.
  float beadR = max(0.006, spokeHalf * max(outer, 0.05) * 0.55);
  float bead = smoothstep(beadR, beadR * 0.45, length(vec2(r - outer, angDist * max(outer, 0.05))));
  float shapeA = u_mode > 0.5 ? bead : inBar;
  // glow along the spoke
  float glowMask = angMask * exp(-abs(r - (inner + outer) * 0.5) / max(0.001, (outer - inner) * 0.6 + 0.005)) * 0.6;

  vec3 baseHsl = rgb2hsl(u_color);
  float hue;
  float sat;
  float lig;
  if (u_rainbow > 0.5) {
    hue = mod(baseHsl.x * 360.0 + idxNorm * 360.0, 360.0);
    sat = max(0.7, baseHsl.y);
    lig = clamp(baseHsl.z, 0.45, 0.65);
  } else {
    hue = baseHsl.x * 360.0;
    sat = baseHsl.y;
    lig = baseHsl.z;
  }
  vec3 col = hsl2rgb(vec3(hue / 360.0, sat, lig));

  // brighten the tip
  float tip = smoothstep(outer - 0.02, outer, r);
  col = mix(col, vec3(1.0), tip * 0.45);

  float alpha = shapeA + glowMask * u_glow;

  // pulsing core ring
  float bass = texture2D(u_audio, vec2(0.005, ${AUDIO_LIVE_V})).r;
  float pulseR = inner - 0.02 + bass * u_pulse * 0.12;
  float ringDist = abs(r - pulseR);
  float ring = smoothstep(0.012, 0.0, ringDist) * (0.35 + u_audioLevel * 0.5);
  alpha = max(alpha, ring);
  col = mix(col, u_color, ring);

  // faint inner disc
  float disc = smoothstep(inner, inner - 0.015, r) * 0.18;
  alpha = max(alpha, disc);

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

export const CircleVisualizer: VisualizerDef = {
  id: "circle",
  name: "Circle",
  icon: "icon-[ri--donut-chart-line]",
  audio: "fft",
  bins: 256,
  fragment: FRAGMENT,
  settings: {
    mode: "0",
    bars: 48,
    intensity: 1.1,
    width: 0.55,
    radius: 0.18,
    size: 1,
    glow: 0.7,
    pulse: 0.6,
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
        { value: "0", label: "Spokes" },
        { value: "1", label: "Dots" },
      ],
    },
    { kind: "slider", key: "bars", label: "Bars", min: 8, max: 128, step: 1 },
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
      key: "width",
      label: "Width",
      min: 0.05,
      max: 1,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "radius",
      label: "Inner Radius",
      min: 0.05,
      max: 0.45,
      step: 0.01,
    },
    // The one control for the whole figure. 1.0 is the layout the other sliders
    // were tuned against; below that the glow is pulled back from the clip's
    // edge, above it the figure grows until the box crops it.
    {
      kind: "slider",
      key: "size",
      label: "Shape size",
      min: 0.3,
      max: 2,
      step: 0.005,
    },
    glowField(),
    {
      kind: "slider",
      key: "pulse",
      label: "Core Pulse",
      min: 0,
      max: 2,
      step: 0.05,
    },
    rainbowField(),
    mainColorField(),
    opacityField(),
  ],
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.9;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};
