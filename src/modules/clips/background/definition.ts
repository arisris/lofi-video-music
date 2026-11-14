import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { drawBackground } from "../../../shared/lib/draw-bg";
import { resolveVideoLoop } from "../../../shared/lib/video-loop";

interface GifFrame {
  canvas: HTMLCanvasElement;
  dims: { left: number; top: number };
  delay: number;
}

const canDrawImage = (img: unknown): img is HTMLImageElement =>
  !!img &&
  (img as HTMLImageElement).complete !== false &&
  ((img as HTMLImageElement).naturalWidth || 0) > 0;

const canDrawVideo = (v: unknown): v is HTMLVideoElement =>
  !!v &&
  (v as HTMLVideoElement).readyState >= 2 &&
  (v as HTMLVideoElement).videoWidth > 0;

/** Darken a #rgb/#rrggbb color toward black; non-hex input falls back to black. */
function shadeColor(color: string, factor = 0.35): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return "#000000";
  let hex = m[1];
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(hex, 16);
  const r = Math.round(((num >> 16) & 0xff) * factor);
  const g = Math.round(((num >> 8) & 0xff) * factor);
  const b = Math.round((num & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawColorBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: Record<string, unknown>,
) {
  const color = typeof settings.color === "string" ? settings.color : "#0f172a";
  if (settings.style === "gradient") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color);
    g.addColorStop(1, shadeColor(color));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillRect(0, 0, w, h);
}

// Background: color/gradient + image/gif/video (Ken Burns for images) —
// media settings are filled via MediaPanel.
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
    gifFrames: null,
    gifDuration: 0,
    videoDuration: 0,
    currentEffect: "none",
    opacity: 1,
    speed: 1,
    loop: true,
    bgOffsetX: 0,
    bgOffsetY: 0,
  },
  // Fallback schema only: the editor renders BackgroundSettingsView instead
  // (see modules/editor/clip-settings.ts), so keep this in sync with it.
  schema: [
    { key: "color", label: "Color", kind: "color" },
    {
      key: "style",
      label: "Style",
      kind: "select",
      options: ["solid", "gradient", "media"],
    },
    {
      key: "currentEffect",
      label: "Motion",
      kind: "select",
      options: [
        "none",
        "random",
        "zoomIn",
        "zoomOut",
        "panRight",
        "panLeft",
        "panUp",
        "panDown",
      ],
    },
    {
      key: "opacity",
      label: "Opacity",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
    },
  ],
  draw({ ctx, w, h, settings, localTime, duration }) {
    const opacity = typeof settings.opacity === "number" ? settings.opacity : 1;
    // In/Out/loop animations — legacy engine mirror (central drawWithTransform).
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "background");
    // Multiply (not assign) so in/out transitions survive on every path.
    ctx.globalAlpha *= opacity;
    // Solid base first: unready media falls back to color instead of flashing
    // the dark clear color, and crossfade blends paint over it.
    drawColorBase(ctx, w, h, settings);
    const trackObj = settings as Record<string, unknown>;
    const mediaType =
      typeof settings.mediaType === "string" ? settings.mediaType : "none";
    if (mediaType === "image" && canDrawImage(settings.mediaElement)) {
      drawBackground(
        settings.mediaElement as HTMLImageElement,
        w,
        h,
        localTime,
        1,
        trackObj,
        ctx,
      );
    } else if (
      mediaType === "gif" &&
      Array.isArray(settings.gifFrames) &&
      (settings.gifFrames as GifFrame[]).length > 0
    ) {
      const frames = settings.gifFrames as GifFrame[];
      const total = Math.max(
        1,
        typeof settings.gifDuration === "number" ? settings.gifDuration : 0,
      );
      const t = Math.max(0, localTime * 1000) % total;
      let acc = 0;
      let idx = frames.length - 1;
      for (let i = 0; i < frames.length; i++) {
        acc += frames[i].delay;
        if (t < acc) {
          idx = i;
          break;
        }
      }
      const f = frames[idx];
      if (f?.canvas)
        drawBackground(f.canvas, w, h, localTime, 1, trackObj, ctx);
    } else if (
      mediaType === "video" &&
      Array.isArray(settings.mediaElements) &&
      (settings.mediaElements as unknown[]).length > 0
    ) {
      // Seamless loop: ping-pong the element pair with a short crossfade at
      // each loop seam. media-helper always provisions two elements.
      const vids = settings.mediaElements as HTMLVideoElement[];
      const videoDuration =
        typeof settings.videoDuration === "number" ? settings.videoDuration : 0;
      const speed = typeof settings.speed === "number" ? settings.speed : 1;
      const blend =
        settings.loop !== false
          ? resolveVideoLoop(localTime, speed, videoDuration, vids.length)
          : null;
      if (blend) {
        const primary = vids[blend.loopIndex % vids.length];
        const secondary = vids[(blend.loopIndex + 1) % vids.length];
        if (
          blend.inCrossfade &&
          primary &&
          secondary &&
          canDrawVideo(primary) &&
          canDrawVideo(secondary)
        ) {
          drawBackground(secondary, w, h, localTime, 1, trackObj, ctx);
          drawBackground(
            primary,
            w,
            h,
            localTime,
            blend.loopTime / blend.crossfadeDur,
            trackObj,
            ctx,
          );
        } else if (primary && canDrawVideo(primary)) {
          drawBackground(primary, w, h, localTime, 1, trackObj, ctx);
        } else {
          const fb = vids.find(canDrawVideo);
          if (fb) drawBackground(fb, w, h, localTime, 1, trackObj, ctx);
        }
      } else {
        const fb = vids.find(canDrawVideo);
        if (fb) drawBackground(fb, w, h, localTime, 1, trackObj, ctx);
      }
    }
    ctx.restore();
  },
};
