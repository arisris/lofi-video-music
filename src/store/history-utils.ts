import type { TimelineClip, TimelineTrack } from "../shared/types/clip";
import type { MediaItem } from "../modules/media/media-helper";
import { cloneClipSettings } from "../shared/lib/media-urls";

/** One undo history entry: full clip state for both routes + selection.
 * Settings are shallow-copied (media-pool element references are shared,
 * so undo never disconnects an already-loaded image/video). */
export interface HistoryEntry {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  route: "/" | "/image";
  videoClips: TimelineClip[] | null;
  thumbClips: TimelineClip[] | null;
  videoSel: string | null;
  thumbSel: string | null;
  lyricsSettings: Record<string, unknown>;
}

export interface HistoryNode extends HistoryEntry {
  mergeKey: string | null;
  at: number;
}

export const HISTORY_LIMIT = 50;
/** Drag/slider churns dozens of writes per gesture — merge same-gesture writes. */
export const MERGE_WINDOW_MS = 1200;

export function snapClips(clips: TimelineClip[]): TimelineClip[] {
  return clips.map((c) => {
    const settings = cloneClipSettings(c.settings);
    // Nested arrays (lyrics lines, keyframes) must not be shared with live
    // state, otherwise in-place edits corrupt the undo snapshot.
    if (Array.isArray(settings.lines)) {
      settings.lines = (settings.lines as Array<Record<string, unknown>>).map(
        (l) => (l && typeof l === "object" ? { ...l } : l),
      );
    }
    return { ...c, settings };
  });
}

/** Minimal snapshot source — keeps history-utils independent of the store. */
export interface SnapshotSource {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  route: "/" | "/image";
  videoClips: TimelineClip[] | null;
  thumbClips: TimelineClip[] | null;
  videoSel: string | null;
  thumbSel: string | null;
  lyricsSettings: Record<string, unknown>;
}

export function takeSnapshot(s: SnapshotSource): HistoryEntry {
  return {
    clips: snapClips(s.clips),
    tracks: s.tracks.map((t) => ({ ...t })),
    selectedClipId: s.selectedClipId,
    route: s.route,
    videoClips: s.videoClips ? snapClips(s.videoClips) : null,
    thumbClips: s.thumbClips ? snapClips(s.thumbClips) : null,
    videoSel: s.videoSel,
    thumbSel: s.thumbSel,
    lyricsSettings: { ...s.lyricsSettings },
  };
}

/** Re-link media-pool references (safe if the pool changes mid-flight). */
export function reattachPoolMedia(
  clips: TimelineClip[],
  pool: MediaItem[],
): TimelineClip[] {
  return clips.map((c) => {
    const mid = c.settings.mediaId;
    if (typeof mid !== "string" || !mid) return c;
    const hit = pool.find((m) => m.id === mid);
    if (!hit) return c;
    const next = { ...c, settings: { ...c.settings } };
    if (hit.type === "video" && hit.elements) {
      next.settings.mediaElements = hit.elements;
      next.settings.mediaType = "video";
    } else if (hit.type === "gif") {
      const g = hit as MediaItem & {
        gifFrames?: unknown;
        gifDuration?: number;
      };
      if (g.gifFrames) next.settings.gifFrames = g.gifFrames;
      if (typeof g.gifDuration === "number")
        next.settings.gifDuration = g.gifDuration;
      next.settings.mediaType = "gif";
    } else if (hit.type === "image" && hit.element) {
      next.settings.mediaElement = hit.element;
      next.settings.mediaType = "image";
    }
    return next;
  });
}
