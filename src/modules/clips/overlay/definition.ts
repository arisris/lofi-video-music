import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { resolveVideoLoop } from "../../../shared/lib/video-loop";

interface GifFrame {
  canvas: HTMLCanvasElement;
  dims: { left: number; top: number };
  delay: number;
}

// Image/gif/video overlay
export const overlayClip: ClipDefinition = {
  type: "overlay",
  name: "Overlay",
  icon: "mdi:layers",
  defaultDuration: 5,
  defaultSettings: {
    ...DEFAULT_TRANSFORM,
    mediaType: "none",
    mediaElement: null,
    mediaElements: null,
    gifFrames: null,
    gifDuration: 1000,
    opacity: 1,
    loop: true,
    speed: 1,
  },
  schema: [
    {
      key: "opacity",
      label: "Opacity",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: "loop", label: "Loop video", kind: "toggle" },
    {
      key: "speed",
      label: "Video speed",
      kind: "slider",
      min: 0.25,
      max: 4,
      step: 0.05,
    },
  ],
  draw({ ctx, settings, localTime, duration }) {
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "overlay");
    const opacity = typeof settings.opacity === "number" ? settings.opacity : 1;
    ctx.globalAlpha *= opacity;

    const mediaType =
      typeof settings.mediaType === "string" ? settings.mediaType : "none";
    const canDrawVideo = (v: unknown): v is HTMLVideoElement =>
      !!v &&
      (v as HTMLVideoElement).readyState >= 1 &&
      (v as HTMLVideoElement).videoWidth > 0;
    const canDrawImage = (img: unknown): img is HTMLImageElement =>
      !!img &&
      (img as HTMLImageElement).complete !== false &&
      ((img as HTMLImageElement).naturalWidth || 0) > 0;
    if (mediaType === "image" && canDrawImage(settings.mediaElement)) {
      ctx.drawImage(settings.mediaElement as HTMLImageElement, 0, 0);
    } else if (
      mediaType === "gif" &&
      Array.isArray(settings.gifFrames) &&
      (settings.gifFrames as GifFrame[]).length > 0
    ) {
      const frames = settings.gifFrames as GifFrame[];
      const total = Math.max(
        1,
        typeof settings.gifDuration === "number" ? settings.gifDuration : 1000,
      );
      const t = Math.max(0, (localTime * 1000) % total);
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
      if (f?.canvas) ctx.drawImage(f.canvas, f.dims.left, f.dims.top);
    } else if (mediaType === "video" && Array.isArray(settings.mediaElements)) {
      const vids = (settings.mediaElements as HTMLVideoElement[]).filter(
        canDrawVideo,
      );
      if (vids.length === 0) {
        ctx.restore();
        return;
      }
      const videoDuration =
        typeof settings.videoDuration === "number"
          ? settings.videoDuration
          : vids[0]?.duration;
      if (videoDuration) {
        if (settings.loop !== false) {
          const speed = typeof settings.speed === "number" ? settings.speed : 1;
          const blend = resolveVideoLoop(
            localTime,
            speed,
            videoDuration,
            vids.length,
          );
          if (blend) {
            const primary = vids[blend.loopIndex % vids.length] ?? vids[0];
            const secondary =
              vids[(blend.loopIndex + 1) % vids.length] ?? vids[0];
            if (blend.inCrossfade) {
              ctx.drawImage(secondary, 0, 0);
              ctx.save();
              ctx.globalAlpha *= blend.loopTime / blend.crossfadeDur;
              ctx.drawImage(primary, 0, 0);
              ctx.restore();
            } else {
              ctx.drawImage(primary, 0, 0);
            }
          } else {
            ctx.drawImage(vids[0], 0, 0);
          }
        } else {
          ctx.drawImage(vids[0], 0, 0);
        }
      } else if (vids[0]) {
        ctx.drawImage(vids[0], 0, 0);
      }
    } else if (mediaType === "none") {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Upload media via Media panel", 640, 360);
    }
    ctx.restore();
  },
  getItemBoundingBox(_ctx, _w, _h, settings) {
    if (settings.mediaType === "image" && settings.mediaElement) {
      const img = settings.mediaElement as {
        naturalWidth?: number;
        naturalHeight?: number;
      };
      return {
        x: 0,
        y: 0,
        width: img.naturalWidth || 300,
        height: img.naturalHeight || 200,
      };
    }
    if (
      settings.mediaType === "gif" &&
      Array.isArray(settings.gifFrames) &&
      settings.gifFrames.length > 0
    ) {
      const frame = settings.gifFrames[0] as {
        dims?: { width?: number; height?: number };
      };
      return {
        x: 0,
        y: 0,
        width: frame.dims?.width || 300,
        height: frame.dims?.height || 200,
      };
    }
    if (
      settings.mediaType === "video" &&
      Array.isArray(settings.mediaElements)
    ) {
      const vid = (
        settings.mediaElements as Array<{
          videoWidth?: number;
          videoHeight?: number;
        }>
      )[0];
      return {
        x: 0,
        y: 0,
        width: vid?.videoWidth || 300,
        height: vid?.videoHeight || 200,
      };
    }
    return { x: 0, y: 0, width: 300, height: 200 };
  },
};
