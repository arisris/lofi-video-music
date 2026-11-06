// Vinyl: a spinning record on a turntable - procedural grooves, a rotating
// label (which can carry a picture), a spindle, and an optional tonearm.
//
// The most on-brand lo-fi visual in the set. The record body is built from
// concentric groove lines in polar space; a fixed screen-space sheen gives the
// glossy-vinyl read while a rotating specular streak and the turning label are
// what make the spin visible. Bass sends a ring out from the spindle and lifts
// the edge glow, so the platter breathes with the track.
//
// The label honours the image's aspect and alpha (a cut-out logo shows the
// platter through it) and is drawn last, so it sits on top of the grooves.

import { AUDIO_LIVE_V, type VisualizerDef } from "../types";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;
uniform sampler2D u_image;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_imageAspect;
uniform float u_rpm;
uniform float u_label;
uniform float u_groove;
uniform float u_sheen;
uniform float u_glow;
uniform float u_beat;
uniform float u_tonearm;
uniform vec3  u_color;
uniform vec4  u_background;

const float TAU = 6.2831853;
const float RECORD = 0.46;

// Distance to a line segment, inflated by r - the tonearm is one of these.
float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

void main() {
  vec2 p = (v_texCoord - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);

  float bass = texture2D(u_audio, vec2(0.005, ${AUDIO_LIVE_V})).r;
  float rot = u_time * u_rpm;

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // ------------------------------------------------------------------
  // Record body: fine grooves plus a fixed sheen and a rotating streak.
  // ------------------------------------------------------------------
  float body = smoothstep(RECORD + 0.004, RECORD - 0.004, r);
  if (body > 0.0) {
    float groove = sin(r * 420.0) * 0.5 + 0.5;
    float groove2 = sin(r * 130.0 + 1.0) * 0.5 + 0.5;
    float g = mix(0.5, 1.0, u_groove);
    float base = 0.045 + (groove * 0.5 + groove2 * 0.5) * 0.06 * g;

    // The sheen is fixed in screen space (a light source does not rotate with
    // the platter); the spin streak is fixed to the record, so the two together
    // are the visible rotation cue.
    float sheen = pow(max(0.0, cos(a - 2.3)), 6.0) * u_sheen;
    float spin = pow(max(0.0, cos(a + rot)), 12.0) * 0.6 * u_sheen;

    // A ring expands outward from the spindle on each bass hit.
    float ringR = 0.14 + (1.0 - bass) * 0.32;
    float ring = exp(-abs(r - ringR) * 42.0) * bass * u_beat;

    base += sheen * 0.12 + spin * 0.10 + ring * 0.16 + u_audioLevel * 0.03;
    col = vec3(base) * (0.85 + 0.35 * u_color);
    alpha = body;
  }

  // ------------------------------------------------------------------
  // Label: the centre disc, optionally a rotating picture.
  // ------------------------------------------------------------------
  float labelR = max(0.05, u_label);
  float labelMask = smoothstep(labelR + 0.003, labelR - 0.003, r);
  if (labelMask > 0.0) {
    vec3 labCol = u_color;
    if (u_imageAspect > 0.0) {
      // Rotate the sample space with the platter, fit the image to the label
      // without stretching, and honour its alpha.
      float ca = cos(rot), sa = sin(rot);
      vec2 lp = mat2(ca, -sa, sa, ca) * (p / labelR) * 0.5;
      if (u_imageAspect >= 1.0) lp.x *= u_imageAspect;
      else lp.y /= u_imageAspect;
      vec2 rel = lp + 0.5;
      if (rel.x > 0.0 && rel.x < 1.0 && rel.y > 0.0 && rel.y < 1.0) {
        vec4 t = texture2D(u_image, vec2(rel.x, 1.0 - rel.y));
        labCol = t.rgb;
        labelMask *= t.a;
      }
    }
    col = mix(col, labCol, labelMask);
    alpha = max(alpha, labelMask);
  }

  // Spindle hole.
  float spindle = smoothstep(0.012, 0.007, r);
  col = mix(col, vec3(0.02), spindle);
  alpha = max(alpha, spindle);

  // ------------------------------------------------------------------
  // Tonearm: pivot, arm, cartridge and counterweight, drawn over the platter.
  // ------------------------------------------------------------------
  if (u_tonearm > 0.5) {
    // A tiny beat-driven wobble keeps it from reading as a frozen prop.
    vec2 pivot = vec2(0.42, 0.40);
    vec2 tip = vec2(0.02, 0.16) + vec2(sin(rot * 0.3), 0.0) * 0.004 * bass;
    vec2 dirn = normalize(tip - pivot);
    vec2 shellEnd = tip + dirn * 0.05;
    vec2 counter = pivot - dirn * 0.07;

    float arm = smoothstep(0.004, 0.0, sdSegment(p, pivot, tip, 0.010));
    float shell = smoothstep(0.004, 0.0, sdSegment(p, tip, shellEnd, 0.020));
    float pivotCap = smoothstep(0.030, 0.024, length(p - pivot));
    float counterCap = smoothstep(0.026, 0.020, length(p - counter));
    float armMask = max(max(arm, shell), max(pivotCap, counterCap));
    col = mix(col, vec3(0.13), armMask);
    alpha = max(alpha, armMask);
  }

  // Edge glow, lifted by the overall level.
  float edgeGlow = exp(-abs(r - RECORD) * 30.0) * (0.2 + u_audioLevel * 0.5) * u_glow;
  col += u_color * edgeGlow;
  alpha = max(alpha, edgeGlow);

  // Composite over the chosen background.
  col = mix(u_background.rgb, col, alpha);
  float aOut = mix(u_background.a, 1.0, alpha);
  gl_FragColor = vec4(col, aOut);
}
`;

export const VinylVisualizer: VisualizerDef = {
  id: "vinyl",
  name: "Vinyl",
  icon: "icon-[ri--disc-line]",
  audio: "fft",
  fragment: FRAGMENT,
  settings: {
    rpm: 0.8,
    label: 0.16,
    groove: 0.5,
    sheen: 0.6,
    glow: 0.5,
    beat: 0.8,
    tonearm: true,
    color: "#f59e0b",
    // Transparent by default: the platter floats over whatever is behind it.
    background: "#00000000",
    image: "",
    opacity: 1,
  },
  fields: [
    {
      kind: "slider",
      key: "rpm",
      label: "Spin",
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "label",
      label: "Label size",
      min: 0.08,
      max: 0.3,
      step: 0.005,
    },
    {
      kind: "slider",
      key: "groove",
      label: "Groove contrast",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "sheen",
      label: "Sheen",
      min: 0,
      max: 1,
      step: 0.01,
    },
    { kind: "slider", key: "glow", label: "Edge glow", min: 0, max: 2, step: 0.05 },
    {
      kind: "slider",
      key: "beat",
      label: "Bass ring",
      min: 0,
      max: 2,
      step: 0.05,
    },
    { kind: "toggle", key: "tonearm", label: "Tonearm" },
    { kind: "color", key: "color", label: "Accent Color" },
    { kind: "color", key: "background", label: "Background", alpha: true },
    {
      kind: "image",
      key: "image",
      label: "Label image",
      hint: "Optional. Spins on the record's centre; without one the label uses the accent colour.",
    },
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
  // A platter is round, so it wants a square box.
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.95;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};
