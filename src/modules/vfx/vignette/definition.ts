import { getAudioLevel } from "../../audio/audio-engine";
import { hexToRGB } from "../../../shared/lib/format";
import type { VfxDefinition } from "../_core/types";

// Beat-reactive vignette.
export const vignetteVfx: VfxDefinition = {
  type: "vignette",
  name: "Beat Vignette",
  icon: "icon-[ri--circle-line]",
  defaultSettings: { opacity: 0.4, color: "#000000", audioReactive: false },
  schema: [
    {
      key: "opacity",
      label: "Opacity",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: "color", label: "Color", kind: "color" },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings }) {
    const opacity =
      typeof settings.opacity === "number" ? settings.opacity : 0.4;
    const rawColor =
      typeof settings.color === "string" ? settings.color : "#000000";
    // Invalid colors fall back to black (hexToRGB would return blue).
    const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawColor)
      ? rawColor
      : "#000000";
    const audioLevel = settings.audioReactive ? getAudioLevel("bass") : 0;
    const activeOpacity = Math.max(0, Math.min(1, opacity + audioLevel * 0.45));
    const maxRadius = Math.sqrt(w * w + h * h) / 2;
    const outer =
      maxRadius *
      (settings.audioReactive ? Math.max(0.5, 1.1 - audioLevel * 0.45) : 1.0);
    const [r, g, b] = hexToRGB(color);
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);
    ctx.save();
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, outer);
    grad.addColorStop(0, `rgba(${R}, ${G}, ${B}, 0)`);
    grad.addColorStop(1, `rgba(${R}, ${G}, ${B}, ${activeOpacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};
