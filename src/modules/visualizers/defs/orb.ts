// Orb: a lit sphere whose surface ripples with the spectrum.
//
// The "modern music visualizer" shape - the one Spotify and YouTube lean on.
// It is faked in 2D: the silhouette radius at each angle is displaced by the
// spectrum band mapped to that angle, while the shading uses a true sphere
// normal, so the body still reads as a solid 3D object with a specular hit and
// a fresnel rim. Bass swells the whole sphere; the ripple detail comes from the
// per-angle band plus a slow travelling wave for life between hits.
//
// `freq` folds the spectrum around the sphere, so higher values turn the single
// breathing blob into a spiky ball. The rim colour is separate from the body so
// the edge can carry a different hue.

import { AUDIO_LIVE_V, type VisualizerDef } from "../_core/types";
import { TAU_GLSL, glowField, opacityField } from "../_core/shader";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_audioBins;
uniform float u_radius;
uniform float u_disp;
uniform float u_freq;
uniform float u_spin;
uniform float u_pulse;
uniform float u_ring;
uniform float u_glow;
uniform vec3  u_color;
uniform vec3  u_rim;
uniform vec4  u_background;

${TAU_GLSL}
const float PI = 3.14159265;

void main() {
  vec2 p = (v_texCoord - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);

  float bass = texture2D(u_audio, vec2(0.005, ${AUDIO_LIVE_V})).r;

  // Bass swells the whole figure before the per-angle displacement is applied.
  float R = u_radius * (1.0 + bass * u_pulse * 0.15);

  // Map this angle to a spectrum band, folded u_freq times around the sphere
  // and slowly rotated by u_spin. Three taps keep the ripple smooth.
  float nb = max(1.0, u_audioBins);
  float hi = min(128.0, nb);
  float band = fract((a + PI) / TAU * u_freq + u_time * u_spin * 0.05);
  float idx = band * hi;
  float s0 = texture2D(u_audio, vec2(idx / nb, ${AUDIO_LIVE_V})).r;
  float s1 = texture2D(u_audio, vec2(clamp(idx + 2.0, 0.0, hi) / nb, ${AUDIO_LIVE_V})).r;
  float s2 = texture2D(u_audio, vec2(clamp(idx - 2.0, 0.0, hi) / nb, ${AUDIO_LIVE_V})).r;
  float spec = (s0 + 0.5 * s1 + 0.5 * s2) / 2.0;

  // A slow travelling wave adds motion where the music is quiet.
  float ripple = 0.5 + 0.5 * sin(a * 3.0 - u_time * 1.5);
  float disp = spec * u_disp + ripple * 0.04 * u_audioLevel;
  float rEff = R * (1.0 + disp);

  // Silhouette with a one-pixel anti-aliased edge.
  float aa = 1.5 / u_resolution.y;
  float mask = smoothstep(rEff + aa, rEff - aa, r);
  if (mask < 0.004) discard;

  // True sphere normal from the base radius, for the shading.
  float z = sqrt(max(R * R - r * r, 0.0));
  vec3 N = normalize(vec3(-p.x, -p.y, z));
  vec3 L = normalize(vec3(-0.4, 0.6, 0.8));
  float diff = max(dot(N, L), 0.0);
  float spec2 = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
  float fres = pow(1.0 - N.z, 2.0);

  // Body: lit base colour, brightened by the local spectrum and the specular.
  vec3 col = u_color * (0.22 + 0.78 * diff);
  col += u_color * spec * 0.35;
  col += vec3(1.0) * spec2 * 0.5;
  // Fresnel rim in its own colour, lifted by the glow control.
  col += u_rim * fres * (0.6 + u_glow * 0.8);

  // A soft outer halo so the sphere does not sit hard against the background.
  float halo = exp(-max(r - rEff, 0.0) / max(R * 0.18, 0.001)) * u_glow * 0.25;
  col += u_rim * halo;

  // A thin tilted ring outside the silhouette, Saturn-style. Masked to start
  // past the edge so it never covers the sphere's face.
  float ringM = 0.0;
  if (u_ring > 0.5) {
    vec2 q = mat2(0.9394, 0.3429, -0.3429, 0.9394) * p;
    float rd = abs(length(q * vec2(1.0, 3.4)) - R * 1.55);
    ringM = smoothstep(0.010, 0.004, rd) * smoothstep(rEff - 0.01, rEff + 0.025, r);
    col += u_rim * ringM * (0.45 + u_glow * 0.6);
  }

  float alpha = mask + halo + ringM * 0.85;
  col = mix(u_background.rgb, col, mask);
  alpha = mix(u_background.a, alpha, mask);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

export const OrbVisualizer: VisualizerDef = {
  id: "orb",
  name: "Orb",
  icon: "icon-[ri--planet-line]",
  audio: "fft",
  bins: 256,
  fragment: FRAGMENT,
  settings: {
    radius: 0.3,
    disp: 0.5,
    freq: 3,
    spin: 0.3,
    pulse: 0.5,
    ring: false,
    glow: 0.6,
    color: "#38bdf8",
    rim: "#f472b6",
    background: "#00000000",
    opacity: 1,
  },
  fields: [
    {
      kind: "slider",
      key: "radius",
      label: "Radius",
      min: 0.15,
      max: 0.45,
      step: 0.005,
    },
    {
      kind: "slider",
      key: "disp",
      label: "Displacement",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      kind: "slider",
      key: "freq",
      label: "Detail",
      min: 1,
      max: 8,
      step: 1,
    },
    { kind: "slider", key: "spin", label: "Spin", min: 0, max: 2, step: 0.01 },
    {
      kind: "slider",
      key: "pulse",
      label: "Bass pulse",
      min: 0,
      max: 2,
      step: 0.05,
    },
    { kind: "toggle", key: "ring", label: "Saturn ring" },
    glowField(),
    { kind: "color", key: "color", label: "Body Color" },
    { kind: "color", key: "rim", label: "Rim Color" },
    { kind: "color", key: "background", label: "Background", alpha: true },
    opacityField(),
  ],
  // Radial, so it wants a square box.
  bbox: (w: number, h: number) => {
    const size = Math.min(w, h) * 0.9;
    return { x: (w - size) / 2, y: (h - size) / 2, width: size, height: size };
  },
};
