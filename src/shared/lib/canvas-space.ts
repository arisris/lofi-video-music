// Design coordinate space: every clip is laid out, hit-tested, and dragged here.
// Fixed (landscape 1280x720, portrait 720x1280) — only the canvas backing store
// grows during recording, and the render loop scales design space up
// to fill it. Old reference: src_old/lib/canvas-space.ts
//
// Cycle note: the store only imports *types* from this module (import type,
// erased at build), so the runtime import of the store here is one-way safe.
import { useEditorStore } from "../../store/editor-store";
import { runtime } from "./runtime";

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;
export const PORTRAIT_WIDTH = 720;
export const PORTRAIT_HEIGHT = 1280;

export interface DesignSize {
  w: number;
  h: number;
}

/** Design size for an aspect ratio, without touching store/runtime. */
export function designSize(aspectRatio: string): DesignSize {
  return aspectRatio === "16:9"
    ? { w: DESIGN_WIDTH, h: DESIGN_HEIGHT }
    : { w: PORTRAIT_WIDTH, h: PORTRAIT_HEIGHT };
}

/** Active design size from the store (landscape default when unset). */
export function getDesignSize(): DesignSize {
  try {
    const aspect = useEditorStore.getState().aspectRatio as string | undefined;
    return designSize(aspect || "16:9");
  } catch {
    return { w: DESIGN_WIDTH, h: DESIGN_HEIGHT };
  }
}

export function designSizeFor(aspectRatio: "16:9" | "9:16"): DesignSize {
  return designSize(aspectRatio);
}

export function fitScale(
  containerW: number,
  containerH: number,
): { scale: number; outW: number; outH: number } {
  const { w, h } = getDesignSize();
  const scale = Math.min(containerW / w, containerH / h);
  return { scale, outW: w * scale, outH: h * scale };
}

export type RecordResolution = "720p" | "1080p" | "1440p";

/** Canvas backing-store size for preview vs recording. */
export function getDesignSizeLegacy(): { w: number; h: number } {
  return getDesignSize();
}

/** Backing store captured by MediaRecorder for resolution + orientation. */
export function recordSize(
  aspectRatio: string,
  resolution: RecordResolution,
): DesignSize {
  const portrait = aspectRatio !== "16:9";
  if (resolution === "1080p")
    return portrait ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
  if (resolution === "1440p")
    return portrait ? { w: 1440, h: 2560 } : { w: 2560, h: 1440 };
  return portrait ? { w: 720, h: 1280 } : { w: 1280, h: 720 };
}

/**
 * Backing-store pixels per design pixel, plus the design size itself.
 * Scale is 1 outside recording, when backing store = preview size.
 */
export function getOutputScale(): DesignSize & { sx: number; sy: number } {
  const { w, h } = getDesignSize();
  const canvas = runtime.canvas;
  const sx = canvas && canvas.width ? canvas.width / w : 1;
  const sy = canvas && canvas.height ? canvas.height / h : 1;
  return { w, h, sx, sy };
}

/** Backing-store position (pointer events) -> design space. */
export function toDesignPos(x: number, y: number) {
  const { sx, sy } = getOutputScale();
  return { x: x / (sx || 1), y: y / (sy || 1) };
}
