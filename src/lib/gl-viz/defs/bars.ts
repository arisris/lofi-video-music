// Spectrum bars, the first definition for the glviz clip.
//
// Everything a visualizer needs lives in this one file: its shader, its
// defaults and the schema for its inspector. Copy this shape, change the
// fragment source, and it is a new style.

import { AUDIO_LIVE_V, AUDIO_PEAK_V, type VisualizerDef } from "../types";

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
uniform float u_centre;
uniform float u_detail;
uniform float u_curve;
uniform float u_peak;
uniform float u_glow;
uniform vec3  u_color;

// Bars grow up from a baseline, their reflection fills the strip below it.
const float REFLECTION = 0.32;
// Every slot keeps a sliver, so a quiet band reads as a dot along the rule
// instead of disappearing into the background.
const float MIN_BAR = 0.008;

// Signed distance to a box with rounded corners, negative inside. The radius is
// given in pixels so the caps stay circular; in uv space they would stretch
// into ellipses on a non-square quad.
float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

void main() {
  vec2 uv = v_texCoord;

  float baseline = 1.0 - REFLECTION;
  bool mirrored = uv.y < baseline;
  float y = mirrored ? 2.0 * baseline - uv.y : uv.y;

  float bars = max(1.0, u_bars);
  float slot = 1.0 / bars;
  float idx = floor(uv.x / slot);
  float fx = fract(uv.x / slot);

  // Bass lives at the low end of the spectrum, so reading the strip left to
  // right packs every loud band into the first few bars and leaves the rest
  // empty - lopsided, with nothing balancing the far side. Measuring each
  // fragment's distance from the middle instead makes distance-from-centre the
  // band: the bass sits where the eye already looks, the treble runs out to
  // both edges, and the two halves mirror for free.
  if (u_centre > 0.5) {
    idx = min(floor(abs(uv.x - 0.5) * 2.0 * bars), bars - 1.0);
  }

  float px = u_resolution.x;
  float py = u_resolution.y;
  float slotPx = px / bars;
  float dxPx = (fx - 0.5) * slotPx;
  float hw = 0.5 * slotPx * clamp(u_width, 0.02, 1.0);
  float yPx = (y - baseline) * py;

  // Logarithmic bands. A 256-bin FFT puts nearly all of its energy in the
  // lowest few bins - measured on a two-tone test signal, 26 of 256 carried
  // anything - so walking the spectrum linearly strands the whole signal in
  // bar one. Spacing bands geometrically matches how pitch is heard.
  float nb = max(1.0, u_audioBins);
  float hi = min(160.0, nb);
  float b0 = pow(hi, idx / bars);
  float b1 = pow(hi, (idx + 1.0) / bars);

  float centre = 0.0;
  float loudest = 0.0;
  float held = 0.0;
  for (int k = 0; k < 3; k++) {
    float f = mix(b0, b1, (float(k) + 0.5) / 3.0);
    float v = texture2D(u_audio, vec2(f / nb, ${AUDIO_LIVE_V})).r;
    loudest = max(loudest, v);
    if (k == 1) centre = v;
    held = max(held, texture2D(u_audio, vec2(f / nb, ${AUDIO_PEAK_V})).r);
  }

  // Detail picks between the band's loudest tap and its single centre tap.
  // Lighter on the average means taller bars and steadier motion; all the way
  // on it, neighbouring bars can differ sharply, which is what gives the
  // silhouette its teeth.
  float level = mix(loudest, centre, clamp(u_detail, 0.0, 1.0));

  // Contrast, before gain. The analyser already reports in decibels, so a
  // plain multiply clips almost every band to full height on ordinary material
  // and the silhouette flattens into a block. The power curve pushes quiet
  // bands down and leaves loud ones alone, which is what separates a tall peak
  // from the bars beside it.
  float shaped = pow(level, clamp(u_curve, 0.25, 8.0));

  float h = clamp(shaped * u_intensity, 0.0, 1.0);
  float barH = max(h, MIN_BAR) * REFLECTION;
  float top = baseline + barH;

  float halfH = 0.5 * barH * py;
  float barD = roundedBox(vec2(dxPx, yPx - halfH), vec2(hw, halfH), min(hw, halfH));
  float barA = smoothstep(0.5, -0.5, barD);
  float maskX = smoothstep(0.5, -0.5, hw - abs(dxPx));

  // Peak cap: a thin pill at the height this band recently reached. It only
  // draws once the band has fallen back below that, so a sustained loud passage
  // shows bars and no caps - the same courtesy a hardware analyser offers.
  // The hold row rides the same curve as the bars, so a cap always lands on the
  // scale the bar it belongs to would have reached.
  float peakH = max(clamp(pow(held, clamp(u_curve, 0.25, 8.0)) * u_intensity, 0.0, 1.0) * REFLECTION, barH);
  float capHalfH = max(0.75, 0.0035 * py);
  float capD = roundedBox(vec2(dxPx, yPx - peakH * py), vec2(hw, capHalfH), min(hw, capHalfH));
  float capA = smoothstep(0.5, -0.5, capD) * step(0.004, peakH - barH);
  if (mirrored) capA = 0.0;
  capA *= clamp(u_peak, 0.0, 1.0);

  float alpha = max(barA, capA);

  // A pulsing line on the baseline keeps a quiet passage from reading as dead,
  // over a fainter rule that spans the full width - the floor the bars stand on.
  float glowLine = exp(-abs(yPx) * 0.45) * (0.12 + u_audioLevel * 0.45);
  float rule = smoothstep(1.1, 0.1, abs(yPx)) * 0.3;
  alpha = max(alpha, max(glowLine * maskX, rule));

  if (alpha < 0.004) discard;

  // Brighten towards the leading edge, not the foot of the bar: y grows
  // upwards here, so the tip is the largest y inside the bar. Scaled to the
  // bar's own height so a short bar still gets one.
  float tipBand = min(0.06, barH * 0.45);
  float tip = smoothstep(0.0, tipBand, y - (top - tipBand));
  vec3 col = mix(u_color, vec3(1.0), tip * 0.5) + u_color * tip * u_glow;
  col = mix(col, mix(u_color, vec3(1.0), 0.9), capA / max(alpha, 0.001));

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
    bars: 64,
    intensity: 1.35,
    width: 0.42,
    centre: true,
    detail: 0.4,
    curve: 1.9,
    peak: 0.9,
    glow: 0.5,
    color: "#3b82f6",
    opacity: 1,
  },
  fields: [
    { kind: "slider", key: "bars", label: "Bars", min: 4, max: 160, step: 1 },
    {
      kind: "slider",
      key: "intensity",
      label: "Intensity",
      min: 0.1,
      max: 4,
      step: 0.05,
    },
    // Fraction of the slot the bar fills. Well under 1 reads as a spectrum
    // rather than a solid block, which is where the shape gets its rhythm.
    {
      kind: "slider",
      key: "width",
      label: "Width",
      min: 0.05,
      max: 1,
      step: 0.01,
    },
    { kind: "toggle", key: "centre", label: "Centre Bass" },
    {
      kind: "slider",
      key: "detail",
      label: "Detail",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "curve",
      label: "Contrast",
      min: 0.5,
      max: 4,
      step: 0.05,
    },
    {
      kind: "slider",
      key: "peak",
      label: "Peak Hold",
      min: 0,
      max: 1,
      step: 0.01,
    },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
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
};
