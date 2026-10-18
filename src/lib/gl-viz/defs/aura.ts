// Aura: a picture sitting inside a silhouette, with light bleeding out of the
// silhouette's edge and breathing with the bass.
//
// Deliberately not a kaleidoscope. That folds the whole frame by angle and uses
// the picture as raw material; this leaves the frame alone and treats the
// picture as something to be shown intact. The picture is sampled straight, at
// its own aspect, never folded, masked or cropped - everything reactive lives
// on the shape around it.

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

uniform float u_shape;
uniform float u_size;
uniform float u_glow;
uniform float u_spread;
uniform float u_breath;
uniform float u_rotate;
uniform float u_markSize;
uniform vec3  u_glowColor;
uniform vec4  u_fill;
uniform vec4  u_background;

const float TAU = 6.2831853;

// Distance to a line segment, inflated by \`r\`. Cheaper than a triangle and
// good enough for a soft ear.
float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Signed distance to a triangle. Needed for a pointed ear; a capsule would
// round it off and read as a bear.
float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

float sdRing(vec2 p, float r, float t) {
  return abs(length(p) - r) - t;
}

float sdDiamond(vec2 p, float r) {
  p = abs(p);
  return (p.x + p.y - r) * 0.7071;
}

// Each shape is scaled to roughly fill the same 0..1 box, so switching between
// them changes the silhouette rather than the apparent size.
float shapeDistance(vec2 p) {
  if (u_shape < 0.5) {
    // Cat: a slightly tall head with two pointed ears. Both ends of an ear's base
    // sit inside the head ellipse - start them on or outside its rim and the
    // union reads as two horns floating next to the head instead of growing
    // out of it.
    float head = length(p * vec2(1.0, 0.94)) - 0.62;
    float earL = sdTriangle(p, vec2(-0.58, 0.23), vec2(-0.20, 0.52), vec2(-0.46, 0.80));
    float earR = sdTriangle(p, vec2(0.58, 0.23), vec2(0.20, 0.52), vec2(0.46, 0.80));
    return min(head, min(earL, earR));
  }
  if (u_shape < 1.5) {
    return sdRing(p, 0.58, 0.14);
  }
  return sdDiamond(p, 0.82);
}

void main() {
  // Centred, and aspect-corrected so a square quad does not squash it.
  vec2 p = v_texCoord - 0.5;
  p.x *= u_resolution.x / u_resolution.y;

  float ca = cos(u_rotate), sa = sin(u_rotate);
  vec2 sp = mat2(ca, -sa, sa, ca) * p;

  // A genuinely low bin, about 107 Hz across a 1024-bin texture. The other
  // definitions reach for 0.02, which is bin 20 and roughly 430 Hz - low-mid,
  // not bass, and on material that gates its low-mid it reads as silence.
  float bass = texture2D(u_audio, vec2(0.005, ${AUDIO_LIVE_V})).r;

  // Bass swells the silhouette and drives the halo, so the shape breathes with
  // the track instead of sitting still next to a moving bar chart.
  float swell = 1.0 + bass * u_breath;
  float size = u_size * swell;

  float d = shapeDistance(sp / size) * size;

  // Both glows are gated to the outside. The rim's exponential was left
  // ungated at first and kept bleeding across the interior, which turned the
  // silhouette muddy brown instead of a solid shape with light around it.
  //
  // Written as outward exponentials rather than a blur so the falloff stays
  // smooth at any size.
  float outside = smoothstep(-0.012, 0.012, d);
  float halo = outside * exp(-max(d, 0.0) / max(u_spread * size, 0.001));

  // A tighter rim hugging the edge keeps the silhouette readable when the halo
  // is wide and dim.
  float rim = outside * exp(-max(d, 0.0) / max(u_spread * size * 0.35, 0.001));

  float lit = u_glow * (1.0 + bass * u_breath * 1.6 + u_audioLevel * 0.35);
  vec3 glow = u_glowColor * (halo * 0.9 + rim * 0.55) * lit;

  // Silhouette body, slightly lifted towards the rim so it does not read as a
  // hole punched in the frame.
  float body = 1.0 - smoothstep(-0.004, 0.004, d);
  vec3 col = mix(u_background.rgb, u_fill.rgb, body) + glow;

  // The picture, drawn last and drawn straight. Not folded, not cropped and not
  // clipped to the silhouette - the only thing that changes its proportions is
  // its own aspect, and it scales with the shape so the two stay together.
  float mark = 0.0;
  if (u_imageAspect > 0.0) {
    // Not "half": reserved word in GLSL ES 1.00, and the shader will not compile.
    vec2 halfSize = vec2(u_markSize) * size;
    if (u_imageAspect >= 1.0) halfSize.y /= u_imageAspect;
    else halfSize.x *= u_imageAspect;

    vec2 rel = p / (halfSize * 2.0) + 0.5;
    if (rel.x > 0.0 && rel.x < 1.0 && rel.y > 0.0 && rel.y < 1.0) {
      // Alpha is honoured, so a logo cut out of a transparent PNG still shows
      // the silhouette through it rather than stamping its empty corners down.
      //
      // v is flipped: an uploaded texture is read top-down from its first row,
      // while v_texCoord.y runs bottom-up out of the quad's geometry. Without
      // this the picture comes out upside down.
      vec4 markTex = texture2D(u_image, vec2(rel.x, 1.0 - rel.y));
      col = mix(col, markTex.rgb, markTex.a);
      mark = markTex.a;
    }
  }

  // Alpha follows the same composite as the colour, so a transparent background
  // lets the halo float over whatever is behind the clip.
  float alpha = mix(u_background.a, 1.0, body) + clamp(halo * lit, 0.0, 1.0);
  alpha = mix(alpha, 1.0, mark);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

export const AuraVisualizer: VisualizerDef = {
  id: "aura",
  name: "Aura",
  icon: "icon-[ri--sun-line]",
  audio: "fft",
  fragment: FRAGMENT,
  settings: {
    shape: "0",
    size: 0.3,
    glow: 1,
    spread: 0.35,
    breath: 0.35,
    rotate: 0,
    markSize: 0.35,
    glowColor: "#fbbf24",
    fill: "#0b0b10ff",
    background: "#00000000",
    image: "",
    opacity: 1,
  },
  fields: [
    { kind: "select", key: "shape", label: "Shape", options: [
      { value: "0", label: "Cat head" },
      { value: "1", label: "Ring" },
      { value: "2", label: "Diamond" },
    ] },
    { kind: "slider", key: "size", label: "Shape size", min: 0.05, max: 0.6, step: 0.005 },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 3, step: 0.01 },
    { kind: "slider", key: "spread", label: "Spread", min: 0.05, max: 2, step: 0.01 },
    // Zero hands the reactivity back: the picture stays, the halo goes still.
    { kind: "slider", key: "breath", label: "Bass response", min: 0, max: 1.5, step: 0.01 },
    { kind: "slider", key: "rotate", label: "Rotate", min: -1, max: 1, step: 0.005, unit: "rad" },
    // Relative to the shape, not the frame: the picture sits inside the silhouette
    // and travels with it when Size moves.
    { kind: "slider", key: "markSize", label: "Image size", min: 0.05, max: 1.2, step: 0.005 },
    { kind: "color", key: "glowColor", label: "Glow colour" },
    { kind: "color", key: "fill", label: "Shape colour", alpha: true },
    { kind: "color", key: "background", label: "Background", alpha: true },
    { kind: "image", key: "image", label: "Image", hint: "Optional. Shown as-is inside the shape: never folded, masked or cropped." },
    { kind: "slider", key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01, scale: 100, unit: "%" },
  ],
  // Radial, so it wants a square box - the same reasoning as the kaleidoscope.
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.92;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};