
export const drawBackground = (
  mediaEl: HTMLImageElement | HTMLVideoElement,
  cw: number,
  ch: number,
  time: number,
  alpha: number,
  xTransitionOffset: number,
  scaleMult = 1.0,
  trackObj: Record<string, unknown> | null = null,
  ctx: CanvasRenderingContext2D,
) => {
  if (!mediaEl) return;
  if (!Number.isFinite(alpha)) return;
  if (!Number.isFinite(scaleMult) || scaleMult <= 0) scaleMult = 1.0;
  ctx.save();
  ctx.globalAlpha = alpha;

  let scale = 1.0;
  let translateX = cw / 2;
  let translateY = ch / 2;

  let effect = "none";

  // Force disable Ken Burns for video backgrounds as requested
  const bgKind =
    (trackObj as Record<string, unknown> | null)?.mediaType ??
    (trackObj as Record<string, unknown> | null)?.bgType;
  const isVideo = !!trackObj && bgKind === "video";

  if (trackObj && (trackObj as Record<string, unknown>).currentEffect && !isVideo) {
    effect = (trackObj as Record<string, unknown>).currentEffect as string;
  }

  const speed = 0.2;
  if (effect === "random") {
    // Sweeps between 1.05 and 1.25 using composite sine/cosine frequencies
    scale = 1.15 + 0.08 * Math.sin(time * 0.15) + 0.02 * Math.cos(time * 0.37);
    // Organic pan sweeps
    translateX += Math.sin(time * 0.23) * (cw * 0.06);
    translateY += Math.cos(time * 0.17) * (ch * 0.06);
  } else if (effect === "zoomIn") {
    scale = 1.1 + 0.05 * (1 - Math.cos(time * speed));
  } else if (effect === "zoomOut") {
    scale = 1.1 + 0.05 * (1 + Math.cos(time * speed));
  } else if (effect === "panRight") {
    scale = 1.15;
    translateX += Math.cos(time * speed) * (cw * 0.05);
  } else if (effect === "panLeft") {
    scale = 1.15;
    translateX -= Math.cos(time * speed) * (cw * 0.05);
  } else if (effect === "panUp") {
    scale = 1.15;
    translateY -= Math.cos(time * speed) * (ch * 0.05);
  } else if (effect === "panDown") {
    scale = 1.15;
    translateY += Math.cos(time * speed) * (ch * 0.05);
  }

  scale *= scaleMult;
  translateX += xTransitionOffset;

  if (trackObj) {
    translateX += (trackObj as Record<string, any>).bgOffsetX || 0;
    translateY += (trackObj as Record<string, any>).bgOffsetY || 0;
  }

  const isVideoEl = "videoWidth" in mediaEl;
  const mediaWidth = isVideoEl
    ? (mediaEl as HTMLVideoElement).videoWidth
    : (mediaEl as HTMLImageElement).naturalWidth;
  const mediaHeight = isVideoEl
    ? (mediaEl as HTMLVideoElement).videoHeight
    : (mediaEl as HTMLImageElement).naturalHeight;

  if (!mediaWidth || !mediaHeight) {
    ctx.restore();
    return;
  }
  if (isVideoEl && (mediaEl as HTMLVideoElement).readyState < 2) {
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
  ctx.scale(scale, scale);
  ctx.drawImage(
    mediaEl,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
};
