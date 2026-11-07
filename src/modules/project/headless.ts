// Headless render: draw any project to any canvas without the store.
// Used by batch exporter/preview — the editor is not involved at all.
import { designSize } from "../../shared/lib/canvas-space";
import type { TimelineClip } from "../../shared/types/clip";
import { renderProjectFrame } from "../../engine/render-loop";

export interface HeadlessRenderOptions {
  /** Target canvas width/height (default: active 16:9 design space). */
  width?: number;
  height?: number;
  /** Project aspect when width/height are omitted (default "16:9"). */
  aspectRatio?: "16:9" | "9:16";
  /** Background color before the frame is drawn (default black). */
  background?: string;
}

/**
 * Render one frame from an already-rehydrated clip list
 * (see rehydrateClip) into any 2D context.
 */
export function renderHeadlessFrame(
  ctx: CanvasRenderingContext2D,
  clips: TimelineClip[],
  time: number,
  opts: HeadlessRenderOptions = {},
): void {
  const design = designSize(opts.aspectRatio ?? "16:9");
  renderProjectFrame(ctx, clips, time, {
    overlays: false,
    width: opts.width ?? design.w,
    height: opts.height ?? design.h,
  });
}

/** Prepare a canvas then render one frame; return the canvas for toDataURL/etc. */
export function renderProjectToCanvas(
  canvas: HTMLCanvasElement,
  clips: TimelineClip[],
  time: number,
  opts: HeadlessRenderOptions = {},
): HTMLCanvasElement {
  const design = designSize(opts.aspectRatio ?? "16:9");
  const w = opts.width ?? design.w;
  const h = opts.height ?? design.h;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available.");
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  renderHeadlessFrame(ctx, clips, time, { width: w, height: h });
  return canvas;
}
