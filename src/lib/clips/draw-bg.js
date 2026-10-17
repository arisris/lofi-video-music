import { State } from "../state";
import { runtime } from "../runtime";


export const drawBackground = (mediaEl, cw, ch, time, alpha, xTransitionOffset, scaleMult = 1.0, trackObj = null, ctx = runtime.ctx) => {
  if (!mediaEl) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  let scale = 1.0;
  let translateX = cw / 2;
  let translateY = ch / 2;

  let effect = "none";
  
  // Force disable Ken Burns for video backgrounds as requested
  const isVideo = trackObj && trackObj.bgType === "video";
  const isThumbnailMode = State.currentRoute === "/image";
  
  if (trackObj && trackObj.currentEffect && !isVideo && !isThumbnailMode) {
    effect = trackObj.currentEffect;
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
    translateX += trackObj.bgOffsetX || 0;
    translateY += trackObj.bgOffsetY || 0;
  }

  const mediaWidth = mediaEl.width;
  const mediaHeight = mediaEl.height;

  if (!mediaWidth || !mediaHeight) {
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

  if (minTx > maxTx) { minTx = cw / 2; maxTx = cw / 2; }
  if (minTy > maxTy) { minTy = ch / 2; maxTy = ch / 2; }

  let clampedTx = Math.max(minTx, Math.min(maxTx, translateX));
  let clampedTy = Math.max(minTy, Math.min(maxTy, translateY));

  if (trackObj) {
    if (translateX < minTx) trackObj.bgOffsetX = (trackObj.bgOffsetX || 0) + minTx - translateX;
    if (translateX > maxTx) trackObj.bgOffsetX = (trackObj.bgOffsetX || 0) - (translateX - maxTx);
    if (translateY < minTy) trackObj.bgOffsetY = (trackObj.bgOffsetY || 0) + minTy - translateY;
    if (translateY > maxTy) trackObj.bgOffsetY = (trackObj.bgOffsetY || 0) - (translateY - maxTy);
  }

  ctx.translate(clampedTx, clampedTy);
  ctx.scale(scale, scale);
  ctx.drawImage(mediaEl, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
};
