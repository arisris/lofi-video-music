// Single domain type. No BBox/MediaItem duplicates.
// Old references: src_old/types/clips.ts, src_old/lib/gl-viz/types.ts
import type { JSX } from "react";

export const CLIP_TYPES = [
  "text",
  "shape",
  "title",
  "lyrics",
  "background",
  "overlay",
  "music",
  "playlist",
  "glviz",
  // Visual effects are timeline clips like any other clip
  // (mirror src_old: addClipToTimeline(vfx.id)).
  "rain",
  "rain_gpu",
  "snow",
  "smoke",
  "fireflies",
  "flash",
  "filmgrain",
  "vignette",
] as const;

export type ClipType = (typeof CLIP_TYPES)[number];

export interface ClipBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineClip {
  id: string;
  type: ClipType;
  /** Container track. Old clips without this field fall back: music→track-1. */
  trackId?: string;
  start: number;
  duration: number;
  settings: Record<string, unknown>;
}

export interface TimelineTrack {
  id: string;
  name: string;
  locked?: boolean;
}

export type FieldKind =
  | "text"
  | "number"
  | "slider"
  | "color"
  | "toggle"
  | "select";

export interface FieldSchema {
  key: string;
  label: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  placeholder?: string;
}

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  settings: Record<string, unknown>;
  localTime: number;
  /** Total clip duration (for typewriter-out etc.). */
  duration: number;
  /** Clip id — used by particle effects for per-clip persistent state. */
  clipId: string;
}

/** Canvas snap guide (helper line while dragging position). */
export interface CanvasSnap {
  type: "x" | "y";
  value: number;
}

export interface CanvasSnapTarget {
  value: number;
  label: string;
}

export interface ClipDefinition {
  type: ClipType;
  name: string;
  icon: string;
  defaultDuration: number;
  defaultSettings: Record<string, unknown>;
  /** Schema-driven inspector. Null = clip without settings (e.g. music). */
  schema: FieldSchema[];
  draw: (d: DrawContext) => void;
  /**
   * Hit-test/drag box in design space BEFORE the x/y transform.
   * Null = not clickable/draggable on canvas (e.g. music, background).
   */
  getItemBoundingBox?: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, unknown>,
    localTime?: number,
  ) => ClipBBox | null;
  SettingsView?: (props: { clipId: string }) => JSX.Element | null;
}
