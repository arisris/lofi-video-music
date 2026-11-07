// Nebula: drifting bokeh orbs with depth parallax, glowing over a dark field.
//
// The go-to lo-fi backdrop. Each orb is hashed once per frame - no state, no
// FBO - so it stays cheap even full-screen. Depth does three jobs at once:
// nearer orbs are bigger, move faster, and are brighter, which is what sells
// the parallax. Bass swells the near orbs' size and brightness, mids lift the
// whole field, so the cloud breathes with the track instead of floating still.
//
// A full-frame background by design: it adds the orbs on top of whatever is
// behind the clip (transparent by default), so it can sit behind other clips or
// be given its own dark field via the background control.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_density;
uniform float u_size;
uniform float u_speed;
uniform float u_drift;
uniform float u_glow;
uniform float u_bass;
uniform float u_rainbow;
uniform vec3  u_color;
uniform vec4  u_background;

const float TAU = 6.2831853;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
vec2 hash2(float n) { return fract(sin(vec2(n, n + 1.0)) * 43758.5453123); }

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
  // Centred, aspect-corrected, so orbs stay circular on a non-square quad.
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);

  // Two band taps drive the reactivity: a genuine low bin for the pulse and a
  // mid average for the ambient lift.
  float bass = texture2D(u_audio, vec2(0.005, ${AUDIO_LIVE_V})).r;
  float mid = 0.0;
  for (int i = 0; i < 8; i++) {
    mid += texture2D(u_audio, vec2(0.15 + 0.02 * float(i), ${AUDIO_LIVE_V})).r;
  }
  mid /= 8.0;

  vec3 acc = vec3(0.0);
  float accA = 0.0;

  for (int i = 0; i < 160; i++) {
    if (float(i) >= u_density) break;
    float fi = float(i);

    // Per-orb constants, all derived from the index so the field is stable
    // across frames and needs no storage.
    vec2 bp = hash2(fi * 1.37 + 11.0);
    float depth = hash(fi * 2.13 + 5.0);
    float ang = hash(fi * 4.31 + 7.0) * TAU;
    float spd = (0.006 + 0.028 * hash(fi * 3.7 + 9.0)) * u_speed;

    // Drift is parallax-weighted: near orbs travel further, which is the whole
    // point of the depth cue. u_drift scales the effect down to a still field.
    vec2 dir = vec2(cos(ang), sin(ang)) * spd * (0.25 + depth) * u_drift;
    vec2 pos = fract(bp + dir * u_time) - 0.5;
    pos *= vec2(ar, 1.0);

    // Depth sets size and brightness. Nearer = bigger and brighter.
    float size = mix(0.004, 0.05, depth) * u_size;
    float bright = mix(0.12, 0.85, depth) * u_glow;

    // Bass swells the near orbs the most; mids lift everything a little.
    float react = bass * u_bass * (0.35 + depth);
    size *= 1.0 + react * 0.6;
    bright *= 1.0 + react * 1.3 + mid * 0.35 * depth;

    float dist = length(p - pos);
    // A soft disc plus a wider, fainter halo: the bokeh look.
    float disc = smoothstep(size, size * 0.2, dist);
    float halo = exp(-dist * dist / max(size * size * 2.5, 0.0001)) * 0.25;
    float inten = (disc + halo) * bright;

    vec3 col;
    if (u_rainbow > 0.5) {
      float hue = mod(hash(fi * 5.1 + 3.0) * 360.0 + u_time * 6.0, 360.0);
      col = hsl2rgb(vec3(hue / 360.0, 0.7, 0.6));
    } else {
      col = u_color;
    }
    acc += col * inten;
    accA += inten;
  }

  // Additive over the field: orbs glow, the background shows through the gaps.
  vec3 col = u_background.rgb + acc;
  float a = clamp(u_background.a + accA * 0.9, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`;

export const NebulaVisualizer: VisualizerDef = {
  id: "nebula",
  name: "Nebula",
  icon: "icon-[ri--sparkling-2-line]",
  audio: "fft",
  fragment: FRAGMENT,
  settings: {
    density: 70,
    size: 1.0,
    speed: 0.6,
    drift: 0.5,
    glow: 1.0,
    bass: 1.0,
    rainbow: false,
    color: "#fbbf24",
    // Transparent by default: the orbs float over whatever is behind the clip.
    // Raise the alpha to give the field its own dark backdrop.
    background: "#00000000",
    opacity: 1,
  },
  fields: [
    {
      kind: "slider",
      key: "density",
      label: "Density",
      min: 10,
      max: 160,
      step: 1,
    },
    {
      kind: "slider",
      key: "size",
      label: "Orb size",
      min: 0.3,
      max: 3,
      step: 0.05,
    },
    { kind: "slider", key: "speed", label: "Speed", min: 0, max: 2, step: 0.01 },
    {
      kind: "slider",
      key: "drift",
      label: "Drift",
      min: 0,
      max: 1,
      step: 0.01,
    },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
    {
      kind: "slider",
      key: "bass",
      label: "Bass response",
      min: 0,
      max: 2,
      step: 0.05,
    },
    { kind: "toggle", key: "rainbow", label: "Rainbow Mode" },
    { kind: "color", key: "color", label: "Orb Color" },
    { kind: "color", key: "background", label: "Background", alpha: true },
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
  // A backdrop wants the whole frame, not the default lower-half strip.
  bbox: (w: number, h: number) => ({ x: 0, y: 0, width: w, height: h }),
};
