import type { ClipSettings } from "./clips";

/** Source of a media asset in the media pool. */
export type MediaSource = "upload" | "pexels" | "pixabay" | "stock";

export interface MediaItem {
  id?: string;
  type?: string;
  url: string;
  name?: string;
  source?: MediaSource | string;
  thumbnail?: string | null;
  duration?: number;
  gifDuration?: number;
  videoDuration?: number;
  /** Loaded HTMLVideoElement / HTMLImageElement (single media). */
  element?: unknown;
  /** Multiple variants (e.g. dual Pexels renditions). */
  elements?: unknown[] | null;

  [key: string]: unknown;
}

/** Playlist entry for the continuous music generator. */
export interface PlaylistItem {
  [key: string]: unknown;
}

/** Shared definition of per-clip settings for the current phase. */
export type { ClipSettings };
