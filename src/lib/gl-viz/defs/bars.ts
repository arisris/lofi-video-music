// Spectrum columns with two silhouettes: solid bars and LED blocks.
//
// The shape is one shader with a `mode` switch rather than two definitions -
// both read the same log-spaced bands out of the audio texture and share the
// contour, colour and reflection, so switching mode changes the silhouette and
// not the data behind it. Rainbow Mode shifts the hue across the bands in
// either mode.

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
uniform float u_cell;
uniform float u_reflection;
uniform float u_glow;
uniform float u_rainbow;
uniform float u_mode;
uniform vec3  u_color;

// Bars mode grows solid columns up from a baseline, with a mirrored strip
// below it. Blocks mode quantises the very same columns into LED cells - it
// shares the baseline and the reflection strip so the two variants read as the
// same equalizer, one smooth and one stepped. 0 selects bars, anything above
// 0.5 selects blocks.
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

void main() {
  vec2 uv = v_texCoord;

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
  float level = mix(loudest, centre, clamp(u_detail, 0.0, 1.0));

  // Contrast, before gain. The analyser already reports in decibels, so a
  // plain multiply clips almost every band to full height on ordinary material
  // and the silhouette flattens into a block. The power curve pushes quiet
  // bands down and leaves loud ones alone.
  float shaped = pow(level, clamp(u_curve, 0.25, 8.0));
  float h = clamp(shaped * u_intensity, 0.0, 1.0);

  // Rainbow shifts the hue across the bands, anchored by the chosen colour so
  // the spectrum keeps its palette instead of turning into a generic flag.
  vec3 baseHsl = rgb2hsl(u_color);
  float hue = baseHsl.x * 360.0;
  if (u_rainbow > 0.5) {
    hue = mod(baseHsl.x * 360.0 + (idx / bars) * 360.0, 360.0);
  }
  // Round-tripping a muted swatch through HSL would shift it, so an unlit
  // rainbow leaves the colour exactly as the user picked it.
  vec3 base = u_rainbow > 0.5
    ? hsl2rgb(vec3(hue / 360.0, max(0.7, baseHsl.y), baseHsl.z))
    : u_color;

  // ------------------------------------------------------------------
  // Blocks mode: quantise each column into LED cells with a fading mirror.
  // ------------------------------------------------------------------
  if (u_mode > 0.5) {
    // Same baseline and reflection strip as the smooth bars, so switching the
    // Variant only changes how the column is drawn, not where it stands.
    float baseline = 1.0 - REFLECTION;
    float cellPx = max(2.0, u_cell);
    // A cell plus a 1px blank row is one pitch. Without the gap the rows butt
    // against each other and the column draws as a solid bar - which is exactly
    // a bar, not an LED stack. The blank is what makes this a separate style.
    float gapPx = 1.0;
    float pitchPx = cellPx + gapPx;
    float pitchFrac = pitchPx / py;
    // The stack can only grow into the room above the baseline; sizing it by
    // the baseline instead (as this first did) sent the tallest columns past
    // the top of the box, where they were clipped into a flat wall while the
    // mirror below still reached the floor - the "main overflows, reflection
    // fits" look.
    float maxBlocks = REFLECTION * py / pitchPx;
    float activeFloat = h * maxBlocks;
    int fullBlocks = int(floor(activeFloat));
    float fraction = activeFloat - float(fullBlocks);

    bool above = uv.y >= baseline;
    float dist = above ? (uv.y - baseline) : (baseline - uv.y);
    int cellIndex = int(floor(dist / pitchFrac));
    if (cellIndex < 0) discard;

    // skip the partial top cell when it is negligible
    if (cellIndex == fullBlocks && fraction < 0.05) discard;
    if (cellIndex > fullBlocks) discard;

    // blank the trailing gap inside each pitch, leaving the cell body only
    float withinCell = fract(dist / pitchFrac) * pitchPx;
    if (withinCell > cellPx) discard;

    float cellOpacity = 1.0;
    if (cellIndex == fullBlocks) cellOpacity = max(fraction, 0.05);

    if (!above) {
      cellOpacity *= u_reflection * (1.0 - float(cellIndex) / max(1.0, activeFloat + 1.0));
      if (cellOpacity < 0.01) discard;
    }

    // Columns fill more of their slot than the slim bars do, so a block stack
    // reads as an equalizer. Width still scales them, just from a wider base.
    float hwBlock = 0.5 * slotPx * clamp(u_width * 2.0, 0.05, 0.98);
    float xMask = smoothstep(hwBlock + 0.5, hwBlock - 0.5, abs(dxPx));
    if (xMask < 0.01) discard;

    float vertRatio = float(cellIndex) / max(1.0, maxBlocks);
    float lightness = clamp(baseHsl.z + vertRatio * 0.15, 0.4, 0.9);
    vec3 blockColor = u_rainbow > 0.5
      ? hsl2rgb(vec3(hue / 360.0, max(0.7, baseHsl.y), lightness))
      : hsl2rgb(vec3(baseHsl.x, baseHsl.y, lightness));

    // glossy highlight across the leading edge of each cell
    float gloss = smoothstep(cellPx * 0.55, cellPx, withinCell) * 0.28;
    blockColor = mix(blockColor, vec3(1.0), gloss);

    float alpha = cellOpacity * xMask;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(blockColor * (1.0 + u_glow * 0.3), clamp(alpha, 0.0, 1.0));
    return;
  }

  // ------------------------------------------------------------------
  // Bars mode: solid columns with rounded caps and a peak hold.
  // ------------------------------------------------------------------
  float baseline = 1.0 - REFLECTION;
  bool mirrored = uv.y < baseline;
  float y = mirrored ? 2.0 * baseline - uv.y : uv.y;
  float yPx = (y - baseline) * py;

  float barH = max(h, MIN_BAR) * REFLECTION;
  float top = baseline + barH;

  float halfH = 0.5 * barH * py;
  float barD = roundedBox(vec2(dxPx, yPx - halfH), vec2(hw, halfH), min(hw, halfH));
  float barA = smoothstep(0.5, -0.5, barD);
  float maskX = smoothstep(0.5, -0.5, hw - abs(dxPx));

  // Peak cap: a thin pill at the height this band recently reached. It only
  // draws once the band has fallen back below that, so a sustained loud passage
  // shows bars and no caps - the same courtesy a hardware analyser offers.
  float peakLevel = clamp(pow(held, clamp(u_curve, 0.25, 8.0)) * u_intensity, 0.0, 1.0);
  float capHalfH = max(0.75, 0.0035 * py);
  // A loud passage pushes every band to full scale at once. Left alone the caps
  // then sit half outside the quad along its top edge and, merged across the
  // width, read as a border above the bars rather than as caps. So keep the pill
  // inside the box, and fade it out as the band approaches the ceiling.
  float capRoom = max(barH, REFLECTION - (capHalfH + 1.0) / py);
  float peakH = min(max(peakLevel * REFLECTION, barH), capRoom);
  float capD = roundedBox(vec2(dxPx, yPx - peakH * py), vec2(hw, capHalfH), min(hw, capHalfH));
  float capA = smoothstep(0.5, -0.5, capD) * step(0.004, peakH - barH);
  if (mirrored) capA = 0.0;
  capA *= clamp(u_peak, 0.0, 1.0) * smoothstep(1.0, 0.88, peakLevel);

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
  vec3 col = mix(base, vec3(1.0), tip * 0.5) + base * tip * u_glow;
  col = mix(col, mix(base, vec3(1.0), 0.9), capA / max(alpha, 0.001));

  if (mirrored) {
    alpha *= (1.0 - (baseline - uv.y) / REFLECTION) * u_reflection;
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
    mode: "0",
    bars: 64,
    intensity: 1.35,
    width: 0.42,
    centre: true,
    detail: 0.4,
    curve: 1.9,
    peak: 0.9,
    cell: 4,
    reflection: 0.7,
    glow: 0.5,
    rainbow: false,
    color: "#3b82f6",
    opacity: 1,
  },
  fields: [
    {
      kind: "select",
      key: "mode",
      label: "Variant",
      options: [
        { value: "0", label: "Bars" },
        { value: "1", label: "Blocks (LED)" },
      ],
    },
    { kind: "slider", key: "bars", label: "Bars", min: 4, max: 160, step: 1 },
    {
      kind: "slider",
      key: "intensity",
      label: "Intensity",
      min: 0.1,
      max: 4,
      step: 0.05,
    },
    // Fraction of the slot a column fills. Applies to both modes: well under 1
    // reads as a spectrum, all the way up reads as a solid block.
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
    // Bars only: the thin falling caps above each column.
    {
      kind: "slider",
      key: "peak",
      label: "Peak Hold",
      min: 0,
      max: 1,
      step: 0.01,
    },
    // Blocks only: the height of one LED cell, in pixels.
    { kind: "slider", key: "cell", label: "Cell Size", min: 2, max: 12, step: 1 },
    {
      kind: "slider",
      key: "reflection",
      label: "Reflection",
      min: 0,
      max: 1,
      step: 0.01,
      scale: 100,
      unit: "%",
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
};
