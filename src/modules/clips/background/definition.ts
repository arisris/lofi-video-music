import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { drawBackground } from "../../../shared/lib/draw-bg";

// Background: color/gradient + image/video (Ken Burns) — media settings
// are filled via MediaPanel. See src_old/lib/clips/draw-bg.ts.
export const backgroundClip: ClipDefinition = {
  type: "background",
  name: "Background",
  icon: "mdi:image",
  defaultDuration: 60,
  defaultSettings: {
    ...DEFAULT_TRANSFORM,
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
      // Seamless loop: ping-pong the element pair with a short crossfade at
      // each loop seam (mirrors src_old/lib/render.ts). media-helper always
      // provisions two elements; fall back to single when it didn't.
      const vids = settings.mediaElements as HTMLVideoElement[];
      const trackObj = settings as Record<string, unknown>;
      const videoDuration = typeof settings.videoDuration === "number" ? settings.videoDuration : 0;
      const speed = typeof settings.speed === "number" ? settings.speed : 1;
      if (videoDuration > 0 && vids.length >= 2 && vids[1]) {
        const crossfadeDur = Math.min(1.5, videoDuration / 4);
        const period = videoDuration - crossfadeDur;
        if (period > 0) {
          const virtualTime = Math.max(0, localTime * speed);
          const loopIndex = Math.floor(virtualTime / period);
          const loopTime = virtualTime % period;
          const primary = vids[loopIndex % 2];
          const secondary = vids[(loopIndex + 1) % 2];
          if (loopTime < crossfadeDur && loopIndex > 0 && primary && secondary) {
            drawBackground(secondary, w, h, Math.max(0, localTime), opacity, 0, 1, trackObj, ctx);
            drawBackground(primary, w, h, Math.max(0, localTime), opacity * (loopTime / crossfadeDur), 0, 1, trackObj, ctx);
          } else if (primary) {
            drawBackground(primary, w, h, Math.max(0, localTime), opacity, 0, 1, trackObj, ctx);
          }
        } else {
          drawBackground(vids[0], w, h, Math.max(0, localTime), opacity, 0, 1, trackObj, ctx);
        }
      } else {
        drawBackground(vids[0], w, h, localTime, opacity, 0, 1, trackObj, ctx);
      }
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
