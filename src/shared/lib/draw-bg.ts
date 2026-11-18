import {
  resolveMotionAt,
  sanitizeMotionKeyframes,
} from "./motion-keyframes";
import { getAudioLevel } from "../../modules/audio/audio-engine";

export type BgMediaElement =
  HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export const drawBackground = (
  mediaEl: BgMediaElement,
  cw: number,
  ch: number,
  time: number,
  alpha: number,
  trackObj: Record<string, unknown> | null = null,
  ctx: CanvasRenderingContext2D,
) => {
  if (!mediaEl) return;
  if (!Number.isFinite(alpha)) return;
  ctx.save();
  // Multiply so clip in/out transitions (applied by the caller) survive.
  ctx.globalAlpha *= alpha;

  let scale = 1.0;
  let translateX = cw / 2;
  let translateY = ch / 2;
  /** Degrees; non-zero only when motion keyframes drive the frame. */
  let rotation = 0;
  // The single motion system: explicit user-editable keyframes.
  // No presets, no fallback — a clip without 2+ keyframes is static.
  // Clip duration is unknown here, so sanitize without an upper time bound.
  const keyframes = sanitizeMotionKeyframes(
    (trackObj as Record<string, unknown> | null)?.motionKeyframes,
    0,
  );
  const keyedMotion =
    keyframes.length >= 2 ? resolveMotionAt(keyframes, time) : null;

  if (keyedMotion) {
    scale = keyedMotion.scale;
    translateX += keyedMotion.x;
    translateY += keyedMotion.y;
    rotation = keyedMotion.rotation;
  }

  // Audio pulse: zoom breathes with the bass while playing. getAudioLevel
  // returns 0 when paused/scrubbing/headless, so the frame stays static
  // there. Scale-only (max +8%) so edges stay covered.
  const pulseAmt =
    typeof (trackObj as Record<string, unknown> | null)?.audioPulse ===
    "number"
      ? ((trackObj as Record<string, unknown>).audioPulse as number)
      : 0;
  if (pulseAmt > 0) {
    const level = getAudioLevel("bass");
    if (level > 0) scale *= 1 + Math.min(pulseAmt, 1) * level * 0.08;
  }

  if (trackObj) {
    translateX += (trackObj as Record<string, any>).bgOffsetX || 0;
    translateY += (trackObj as Record<string, any>).bgOffsetY || 0;
  }

  const isVideoEl = "videoWidth" in mediaEl;
  const imgDims = mediaEl as Partial<HTMLImageElement>;
  const canvasDims = mediaEl as Partial<HTMLCanvasElement>;
  const mediaWidth = isVideoEl
    ? (mediaEl as HTMLVideoElement).videoWidth
    : imgDims.naturalWidth || canvasDims.width || 0;
  const mediaHeight = isVideoEl
    ? (mediaEl as HTMLVideoElement).videoHeight
    : imgDims.naturalHeight || canvasDims.height || 0;

  if (!mediaWidth || !mediaHeight) {
    ctx.restore();
    return;
  }
  // A mid-seek video (readyState 1) still presents its last frame, so keep
  // drawing it: skipping would flash the fallback/base instead (scrub flicker).
  // Never-loaded media has no dimensions and already returned above.
  if (isVideoEl && (mediaEl as HTMLVideoElement).readyState < 1) {
    ctx.restore();
    return;
  }

  const mediaRatio = mediaWidth / mediaHeight;
  const canvasRatio = cw / ch;
  let drawWidth, drawHeight;

  if (mediaRatio > canvasRatio) {
    drawHeight = ch;
    drawWidth = mediaWidth * (ch / mediaHeight);
  } else {
    drawWidth = cw;
    drawHeight = mediaHeight * (cw / mediaWidth);
  }

  let minTx = cw - (drawWidth * scale) / 2;
  let maxTx = (drawWidth * scale) / 2;
  let minTy = ch - (drawHeight * scale) / 2;
  let maxTy = (drawHeight * scale) / 2;

  if (minTx > maxTx) {
    minTx = cw / 2;
    maxTx = cw / 2;
  }
  if (minTy > maxTy) {
    minTy = ch / 2;
    maxTy = ch / 2;
  }

  const clampedTx = Math.max(minTx, Math.min(maxTx, translateX));
  const clampedTy = Math.max(minTy, Math.min(maxTy, translateY));

  ctx.translate(clampedTx, clampedTy);
  if (rotation !== 0) {
    const rad = (rotation * Math.PI) / 180;
    // Rotating a cover-fit rect exposes corners; over-zoom conservatively
    // (|cos| + |sin| <= 1.42) so edges stay covered. The solid color base
    // painted by the caller hides any sub-pixel remainder.
    const cover = Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad));
    ctx.rotate(rad);
    ctx.scale(scale * cover, scale * cover);
  } else {
    ctx.scale(scale, scale);
  }
  ctx.drawImage(
    mediaEl,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
};
