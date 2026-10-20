import type { RecordResolution } from "../store/slices/recording";
import { editorStore } from "../store/editor-store";
import { runtime } from "./runtime";

/**
 * Design space: the coordinate system clips are laid out, hit-tested and
 * dragged in. It is fixed (1280x720 landscape, 720x1280 portrait) and never
 * changes - only the canvas backing store grows while recording, and the
 * render loop scales design space up to fill it.
 *
 * Every size/position the store holds is expressed here, so a recording at
 * 1080p/1440p looks exactly like the preview instead of shrinking the clips.
 */
export interface DesignSize {
  w: number;
  h: number;
}

/** Design size for an aspect ratio, independent of store/runtime state. */
export const designSize = (aspectRatio: string): DesignSize =>
  aspectRatio === "16:9" ? { w: 1280, h: 720 } : { w: 720, h: 1280 };

/** Current design size from the store. */
export const getDesignSize = (): DesignSize =>
  designSize(editorStore.getState().aspectRatio || "16:9");

/** Backing-store size MediaRecorder captures for a given resolution. */
export const recordSize = (
  aspectRatio: string,
  resolution: RecordResolution,
): DesignSize => {
  const portrait = aspectRatio !== "16:9";
  if (resolution === "1080p")
    return portrait ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
  if (resolution === "1440p")
    return portrait ? { w: 1440, h: 2560 } : { w: 2560, h: 1440 };
  return portrait ? { w: 720, h: 1280 } : { w: 1280, h: 720 };
};

/**
 * Backing-store pixels per design pixel, plus the design size itself.
 * Scale is 1 outside recording, when the backing store is the preview size.
 */
export const getOutputScale = (): DesignSize & { sx: number; sy: number } => {
  const { w, h } = getDesignSize();
  const canvas = runtime.canvas;
  const sx = canvas && canvas.width ? canvas.width / w : 1;
  const sy = canvas && canvas.height ? canvas.height / h : 1;
  return { w, h, sx, sy };
};

/** Backing-store position (pointer events) -> design space. */
export const toDesignPos = (x: number, y: number) => {
  const { sx, sy } = getOutputScale();
  return { x: x / (sx || 1), y: y / (sy || 1) };
};
