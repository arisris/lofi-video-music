// Tunnel: an endless warp tunnel whose rings light up per spectrum band.
//
// Pure polar math - z = 1/r puts the vanishing point at the centre, scrolling z
// with time flies the camera forward, and each ring (an integer z) is mapped to
// a frequency band so the walls pulse with the track. A twist turns the straight
// tunnel into a spiral, angular spokes add structure, and the speed rises with
// the overall level so loud passages rush.
//
// It is a full-frame background like nebula: it adds the tunnel on top of
// whatever is behind the clip (transparent by default), with a soft glow at
// the vanishing point.

import { AUDIO_LIVE_V, type VisualizerDef } from "../types";

const FRAGMENT = `
precision mediump float;
varying vec2 v_texCoord;

uniform sampler2D u_audio;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_audioLevel;
uniform float u_audioBins;
uniform float u_speed;
uniform float u_zoom;
uniform float u_twist;
uniform float u_spokes;
uniform float u_glow;
uniform float u_rainbow;
uniform vec3  u_color;
uniform vec4  u_background;

const float TAU = 6.2831853;

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
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);

  // Depth: the centre is far away (large z), the edges are near. Scrolling z
  // with time moves the camera down the tunnel. u_zoom sets how many rings are
  // visible at once.
  float z = (1.0 / max(r, 0.015)) * u_zoom - u_time * u_speed;

  // Twist the angle by depth for a spiral.
  float twist = a + z * u_twist;

  float ring = fract(z);
  float ringIdx = floor(z);

  // Each ring reads one spectrum band. mod() keeps the index in range as z
  // scrolls; neighbouring rings get neighbouring bands, so the wall is a moving
  // spectrum.
  float nb = max(1.0, u_audioBins);
  float hi = min(160.0, nb);
  float band = mod(ringIdx, hi) / hi;
  float level = texture2D(u_audio, vec2(band, ${AUDIO_LIVE_V})).r;

  // Ring brightness peaks at each boundary and fades toward the next.
  float glow = pow(1.0 - ring, 2.0) * (0.25 + level * 1.25);

  // Angular spokes add structure; zero gives a plain radial tunnel.
  if (u_spokes > 0.5) {
    float spokes = 0.5 + 0.5 * sin(twist * u_spokes);
    glow *= 0.55 + 0.45 * spokes;
  }

  // Vignette the outer edge so the tunnel sits inside the frame.
  float edgeFade = smoothstep(0.75, 0.45, r);
  // A soft light at the vanishing point, breathing with the level.
  float centre = exp(-r * r * 22.0) * (0.25 + u_audioLevel * 0.6);

  vec3 col;
  if (u_rainbow > 0.5) {
    float hue = mod(band * 360.0 + u_time * 12.0, 360.0);
    col = hsl2rgb(vec3(hue / 360.0, 0.75, 0.55));
  } else {
    col = u_color;
  }
  col *= glow * edgeFade * u_glow;
  col += u_color * centre;

  float alpha = clamp(glow * edgeFade + centre, 0.0, 1.0);

  // Additive over the field.
  vec3 outC = u_background.rgb + col;
  float outA = clamp(u_background.a + alpha, 0.0, 1.0);
  gl_FragColor = vec4(outC, outA);
}
`;

export const TunnelVisualizer: VisualizerDef = {
  id: "tunnel",
  name: "Tunnel",
  icon: "icon-[ri--tunnel-line]",
  audio: "fft",
  bins: 512,
  fragment: FRAGMENT,
  settings: {
    speed: 0.8,
    zoom: 1.2,
    twist: 0.4,
    spokes: 6,
    glow: 1.0,
    rainbow: false,
    color: "#22d3ee",
    // Transparent by default: the tunnel floats over whatever is behind the
    // clip. Raise the alpha to give it its own dark field.
    background: "#00000000",
    opacity: 1,
  },
  fields: [
    { kind: "slider", key: "speed", label: "Speed", min: 0.1, max: 3, step: 0.01 },
    {
      kind: "slider",
      key: "zoom",
      label: "Rings",
      min: 0.5,
      max: 3,
      step: 0.05,
    },
    { kind: "slider", key: "twist", label: "Twist", min: 0, max: 2, step: 0.01 },
    {
      kind: "slider",
      key: "spokes",
      label: "Spokes",
      min: 0,
      max: 12,
      step: 1,
    },
    { kind: "slider", key: "glow", label: "Glow", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "rainbow", label: "Rainbow Mode" },
    { kind: "color", key: "color", label: "Main Color" },
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
  // A full-frame background.
  bbox: (w: number, h: number) => ({ x: 0, y: 0, width: w, height: h }),
};
