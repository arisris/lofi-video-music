// Canvas transform geometry — port of src_old/utils/helpers.ts
// (transformPoint/inverseTransformPoint) + the transform-only part of
// src_old/lib/render.ts drawWithTransform (no animation; each clip
// still handles its own animation via applyClipAnimations).
import type { ClipBBox } from "../types/clip";

export interface TransformSettings {
  x?: unknown;
  y?: unknown;
  scaleX?: unknown;
  scaleY?: unknown;
  rotation?: unknown;
  originX?: unknown;
  originY?: unknown;
}

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function transformPoint(
  px: number,
  py: number,
  bbox: ClipBBox,
  settings: TransformSettings,
): { x: number; y: number } {
  const x = num(settings.x, 0);
  const y = num(settings.y, 0);
  const scaleX = num(settings.scaleX, 1);
  const scaleY = num(settings.scaleY, 1);
  const rotation = num(settings.rotation, 0);
  const originX = num(settings.originX, 0.5);
  const originY = num(settings.originY, 0.5);

  const cx = bbox.x + bbox.width * originX;
  const cy = bbox.y + bbox.height * originY;

  const dx = px - cx;
  const dy = py - cy;

  const sx = dx * scaleX;
  const sy = dy * scaleY;

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return { x: cx + sx * cos - sy * sin + x, y: cy + sx * sin + sy * cos + y };
}

export function inverseTransformPoint(
  sx: number,
  sy: number,
  bbox: ClipBBox,
  settings: TransformSettings,
): { x: number; y: number } {
  const x = num(settings.x, 0);
  const y = num(settings.y, 0);
  const scaleX = num(settings.scaleX, 1);
  const scaleY = num(settings.scaleY, 1);
  const rotation = num(settings.rotation, 0);
  const originX = num(settings.originX, 0.5);
  const originY = num(settings.originY, 0.5);

  const cx = bbox.x + bbox.width * originX;
  const cy = bbox.y + bbox.height * originY;

  const rx = sx - cx - x;
  const ry = sy - cy - y;

  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const tx = rx * cos - ry * sin;
  const ty = rx * sin + ry * cos;

  return { x: tx / (scaleX || 0.0001) + cx, y: ty / (scaleY || 0.0001) + cy };
}

/** Apply clip translate/rotate/scale around the bbox origin. */
export function withClipTransform(
  ctx: CanvasRenderingContext2D,
  settings: TransformSettings,
  bbox: ClipBBox,
  drawFn: () => void,
): void {
  const x = num(settings.x, 0);
  const y = num(settings.y, 0);
  const scaleX = num(settings.scaleX, 1);
  const scaleY = num(settings.scaleY, 1);
  const rotation = num(settings.rotation, 0);
  const originX = num(settings.originX, 0.5);
  const originY = num(settings.originY, 0.5);

  ctx.save();
  const cx = bbox.x + bbox.width * originX;
  const cy = bbox.y + bbox.height * originY;
  ctx.translate(cx + x, cy + y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-cx, -cy);
  drawFn();
  ctx.restore();
}

/** Default transform values (mirrors src_old DEFAULT_TRANSFORMS). */
export const DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  originX: 0.5,
  originY: 0.5,
} as const;
