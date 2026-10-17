/**
 * Core domain types for the editor state.
 * Per-clip settings are intentionally loose ([key: string]: unknown) during the
 * migration; each clip type gets a dedicated settings interface in a later phase.
 */

export interface ClipSettings {
  enabled?: boolean;
  [key: string]: unknown;
}

export const CLIP_TYPES = [
  "music",
  "visualizer",
  "text",
  "background",
  "overlay",
  "shape",
  "playlist",
  "title",
] as const;

export type ClipType = (typeof CLIP_TYPES)[number];

/**
 * Clip type values are currently supplied as plain strings from panels and
 * defaults (see `clip-factory.js`). Kept as `string` until the migration of the
 * factory, then narrowed to `ClipType`.
 */
export interface TimelineClip {
  id: string;
  type: string;
  trackId: string;
  start: number;
  duration: number;
  settings: ClipSettings;
}

export interface TimelineTrack {
  id: string;
  name: string;
  locked: boolean;
}

export interface ThumbnailLayer {
  id: string;
  type: string;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  bgPadding?: number;
  bgRadius?: number;
  bgColor?: string;
  [key: string]: unknown;
}

export interface ThumbnailState {
  layers: ThumbnailLayer[];
  selectedLayerId: string | null;
}

export interface DragPivot {
  x: number;
  y: number;
}

/** Snap guide rendered on the canvas / timeline. */
export interface SnapLine {
  time: number;
  type: string;
}

export interface CanvasSnap {
  type: string;
  value: number;
}
