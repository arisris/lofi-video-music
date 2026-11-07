import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { drawBackground } from "../../../shared/lib/draw-bg";

// Background: color/gradient + image/video (Ken Burns) — media settings
// are filled via MediaPanel. See src_old/lib/clips/draw-bg.ts.
export const backgroundClip: ClipDefinition = {
  type: "background",
  name: "Background",
  icon: "mdi:image",
  defaultDuration: 60,
  defaultSettings: {
    color: "#0f172a",
    style: "solid",
    mediaType: "none",
    mediaElement: null,
    mediaElements: null,
    currentEffect: "none",
    opacity: 1,
    speed: 1,
    loop: true,
  },
  schema: [
    { key: "color", label: "Color", kind: "color" },
    { key: "style", label: "Style", kind: "select", options: ["solid", "gradient", "media"] },
    { key: "currentEffect", label: "Motion", kind: "select", options: ["none", "random", "zoomIn", "zoomOut", "panRight", "panLeft", "panUp", "panDown"] },
    { key: "opacity", label: "Opacity", kind: "slider", min: 0, max: 1, step: 0.05 },
  ],
  draw({ ctx, w, h, settings, localTime, duration }) {
    const opacity = typeof settings.opacity === "number" ? settings.opacity : 1;
    // In/Out/loop animations — legacy engine mirror (central drawWithTransform).
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "background");
    if (settings.mediaType === "image" && settings.mediaElement) {
      drawBackground(settings.mediaElement as HTMLImageElement, w, h, localTime, opacity, 0, 1, settings as Record<string, unknown>, ctx);
    } else if (settings.mediaType === "video" && Array.isArray(settings.mediaElements) && (settings.mediaElements as unknown[])[0]) {
      drawBackground((settings.mediaElements as HTMLVideoElement[])[0], w, h, localTime, opacity, 0, 1, settings as Record<string, unknown>, ctx);
    } else {
      const color = typeof settings.color === "string" ? settings.color : "#0f172a";
      ctx.save();
      ctx.globalAlpha = opacity;
      if (settings.style === "gradient") {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, color);
        g.addColorStop(1, "#000000");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = color;
      }
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    ctx.restore();
  },
};
