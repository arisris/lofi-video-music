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
  if (p.version !== PROJECT_VERSION) return false;
  if (typeof p.meta !== "object" || !p.meta) return false;
  if (typeof p.output !== "object" || !p.output) return false;
  const routes = p.routes as Record<string, unknown> | undefined;
  if (typeof routes?.video !== "object" || typeof routes?.thumb !== "object")
    return false;
  if (!Array.isArray(p.mediaPool)) return false;
  const validRoute = (r: unknown): boolean => {
    if (!r || typeof r !== "object") return false;
    const clips = (r as Record<string, unknown>).clips;
    if (!Array.isArray(clips)) return false;
    return clips.every((c) => {
      if (!c || typeof c !== "object") return false;
      const o = c as Record<string, unknown>;
      return (
        typeof o.id === "string" &&
        !!o.id &&
        typeof o.type === "string" &&
        typeof o.start === "number" &&
        Number.isFinite(o.start) &&
        typeof o.duration === "number" &&
        Number.isFinite(o.duration) &&
        typeof o.settings === "object" &&
        o.settings !== null
      );
    });
  };
  const validPool = (p.mediaPool as unknown[]).every((m) => {
    if (!m || typeof m !== "object") return false;
    const o = m as Record<string, unknown>;
    const src = o.source as Record<string, unknown> | undefined;
    return (
      typeof o.id === "string" &&
      !!o.id &&
      !!src &&
      typeof src.value === "string"
    );
  });
  return validRoute(routes.video) && validRoute(routes.thumb) && validPool;
}
