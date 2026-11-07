// Single project bundle schema (project.json inside the .zip).
// This single file is the source of truth for export/import/headless.
import type { ClipType, TimelineTrack } from "../../shared/types/clip";

export const PROJECT_VERSION = 1;

/** Media inside the bundle: external URL or file in the assets/ folder. */
export interface ProjectMediaSource {
  type: "url" | "asset";
  value: string;
}

export interface ProjectMedia {
  id: string;
  name: string;
  /** image | video | gif | audio */
  kind: string;
  /** upload | url | pexels | pixabay | emoji ... (origin info, preserved) */
  origin: string;
  source: ProjectMediaSource;
  thumbnail?: string | null;
  duration: number;
  width?: number;
  height?: number;
}

/** Clip → media pool link (for re-attaching DOM elements on import). */
export interface ProjectClipMedia {
  mediaId: string;
  fileName?: string;
  mediaType?: string;
}

export interface ProjectClip {
  id: string;
  type: ClipType;
  trackId?: string;
  start: number;
  duration: number;
  /** JSON-safe settings (DOM/canvas elements already stripped). */
  settings: Record<string, unknown>;
  media?: ProjectClipMedia | null;
}

export interface ProjectRouteState {
  clips: ProjectClip[];
  selectedClipId: string | null;
}

export interface ProjectMeta {
  name: string;
  createdAt: string;
  appVersion: string;
}

export interface ProjectOutput {
  aspectRatio: "16:9" | "9:16";
  recordResolution: string;
  recordFps: number;
}

export interface ProjectV1 {
  version: typeof PROJECT_VERSION;
  meta: ProjectMeta;
  output: ProjectOutput;
  tracks: TimelineTrack[];
  routes: {
    video: ProjectRouteState;
    thumb: ProjectRouteState;
  };
  mediaPool: ProjectMedia[];
  /** Global lyrics style (optional; defaults apply when absent). */
  lyricsSettings?: Record<string, unknown>;
}

export function isProjectV1(v: unknown): v is ProjectV1 {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    p.version === PROJECT_VERSION &&
    typeof p.meta === "object" &&
    typeof p.output === "object" &&
    typeof (p.routes as Record<string, unknown> | undefined)?.video === "object" &&
    typeof (p.routes as Record<string, unknown> | undefined)?.thumb === "object" &&
    Array.isArray(p.mediaPool)
  );
}
