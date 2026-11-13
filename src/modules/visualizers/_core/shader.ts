import type { FieldSchema } from "./types";

/**
 * Shared GLSL snippets + field builders for visualizer definitions.
 *
 * Several fragment shaders independently grew the same HSL helpers and the
 * same trailing controls (Glow / Rainbow Mode / Main Color / Opacity).
 * Centralizing them keeps the compiled output identical while removing the
 * copy-paste drift risk.
 */

/** Circle constant used by the radial/angular shaders. */
export const TAU_GLSL = "const float TAU = 6.2831853;";

/** sRGB <-> HSL helpers shared by the rainbow-mode shaders. */
export const HSL_GLSL = `vec3 rgb2hsl(vec3 c) {
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
}`;

/** Standard glow slider (bars, circle, lissajous, tunnel, waveform). */
export const glowField = (): FieldSchema => ({
  kind: "slider",
  key: "glow",
  label: "Glow",
  min: 0,
  max: 2,
  step: 0.05,
});

/** Standard rainbow toggle (bars, circle, liquid-waves, lissajous, tunnel, waveform). */
export const rainbowField = (): FieldSchema => ({
  kind: "toggle",
  key: "rainbow",
  label: "Rainbow Mode",
});

/** Standard main-color picker (bars, circle, liquid-waves, tunnel, waveform). */
export const mainColorField = (): FieldSchema => ({
  kind: "color",
  key: "color",
  label: "Main Color",
});

/** Standard opacity slider (every definition). Readout is a percentage. */
export const opacityField = (): FieldSchema => ({
  kind: "slider",
  key: "opacity",
  label: "Opacity",
  min: 0,
  max: 1,
  step: 0.01,
  scale: 100,
  unit: "%",
});
