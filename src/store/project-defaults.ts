import type { TimelineClip, TimelineTrack } from "../shared/types/clip";
import { cloneClipSettings } from "../shared/lib/media-urls";

/** max(60, ceil(maxEnd)) */
export function getTotalDuration(clips: TimelineClip[]): number {
  if (!clips || clips.length === 0) return 60;
  const maxEnd = clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  return Math.max(60, Math.ceil(maxEnd));
}

export const BG_TRACK_ID = "track-bg";
export const MUSIC_TRACK_ID = "track-1";
export const CONTENT_TRACK_ID = "track-2";

/** Tracks whose content is locked by type (mirrors the music track). */
export const DEDICATED_TRACK_IDS: ReadonlySet<string> = new Set([
  BG_TRACK_ID,
  MUSIC_TRACK_ID,
]);

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: BG_TRACK_ID, name: "Background" },
  { id: MUSIC_TRACK_ID, name: "Track 1 (Music)" },
  { id: CONTENT_TRACK_ID, name: "Track 2" },
];

/** First editable content track (never a dedicated lane). */
export function contentTrackId(tracks: Array<{ id: string }>): string {
  return (
    tracks.find((t) => !DEDICATED_TRACK_IDS.has(t.id))?.id ??
    tracks[0]?.id ??
    CONTENT_TRACK_ID
  );
}

/**
 * Hard lane rule: background always resolves to the bg lane, music to the
 * music lane — stored trackIds are ignored for those types so a clip can
 * never strand outside its lane (old projects included).
 */
export function resolveTrackId(
  c: { type: string; trackId?: string },
  tracks: Array<{ id: string }>,
): string {
  const has = (id: string) => tracks.some((t) => t.id === id);
  if (c.type === "background" && has(BG_TRACK_ID)) return BG_TRACK_ID;
  if (c.type === "music" && has(MUSIC_TRACK_ID)) return MUSIC_TRACK_ID;
  if (c.trackId && has(c.trackId)) return c.trackId;
  return contentTrackId(tracks);
}

/** Insert missing dedicated lanes (old bundles predate the bg lane). */
export function ensureDedicatedTracks(
  tracks: TimelineTrack[],
): TimelineTrack[] {  const has = (id: string) => tracks.some((t) => t.id === id);
  const out = tracks.map((t) => ({ ...t }));
  if (!has(BG_TRACK_ID)) out.unshift({ id: BG_TRACK_ID, name: "Background" });
  if (!has(MUSIC_TRACK_ID)) {
    const at = out.findIndex((t) => t.id === BG_TRACK_ID);
    out.splice(at >= 0 ? at + 1 : 0, 0, {
      id: MUSIC_TRACK_ID,
      name: "Track 1 (Music)",
    });
  }
  return out;
}

/**
 * Seal the background lane: sorted bg clips abut one another with no gaps
 * and no overlaps. The first clip keeps its start (a black intro is not a
 * gap); every follower starts exactly where its predecessor ends.
 * `tieId` wins exact-start ties (the dropped clip goes first).
 * `trimHeadId`: a resize-start gesture — the clip keeps its dropped head
 * and an overlapping predecessor is trimmed back instead.
 */
export function packBackgroundLane(
  clips: TimelineClip[],
  tieId?: string,
  trimHeadId?: string,
): TimelineClip[] {
  const bgs = clips
    .filter((c) => c.type === "background")
    .sort(
      (a, b) =>
        a.start - b.start ||
        (a.id === tieId ? -1 : b.id === tieId ? 1 : a.id < b.id ? -1 : 1),
    );
  if (bgs.length === 0) return clips;
  // Work on copies: never mutate store objects outside set().
  const order = bgs.map((c) => ({ id: c.id, start: c.start }));
  const dur = new Map<string, number>(bgs.map((c) => [c.id, c.duration]));
  if (trimHeadId) {
    const idx = order.findIndex((c) => c.id === trimHeadId);
    const clip = idx >= 0 ? order[idx] : undefined;
    const prev = idx > 0 ? order[idx - 1] : undefined;
    const clipEnd = clip ? clip.start + (dur.get(clip.id) ?? 0) : 0;
    if (clip && prev && prev.start + (dur.get(prev.id) ?? 0) > clip.start) {
      const trimmed = clip.start - prev.start;
      if (trimmed >= 0.1) {
        dur.set(prev.id, Math.round(trimmed * 100) / 100);
      } else if (clipEnd - (prev.start + 0.1) >= 0.1) {
        // Head pushed past the predecessor's head: floor predecessor to
        // 0.1s and re-anchor the clip after it.
        dur.set(prev.id, 0.1);
        clip.start = Math.round((prev.start + 0.1) * 100) / 100;
        dur.set(clip.id, Math.round((clipEnd - clip.start) * 100) / 100);
      } else {
        // Degenerate sliver: fall back to abutting the predecessor's end.
        const pe = prev.start + (dur.get(prev.id) ?? 0);
        clip.start = Math.round(pe * 100) / 100;
        dur.set(clip.id, Math.max(0.1, Math.round((clipEnd - pe) * 100) / 100));
      }
    }
  }
  const packed = new Map<string, number>();
  let cursor = order[0].start;
  for (const c of order) {
    packed.set(c.id, Math.round(cursor * 100) / 100);
    cursor += dur.get(c.id) ?? 0;
  }
  const changed = order.some(
    (c) =>
      packed.get(c.id) !== bgs.find((b) => b.id === c.id)?.start ||
      dur.get(c.id) !== bgs.find((b) => b.id === c.id)?.duration,
  );
  if (!changed) return clips;
  return clips.map((c) =>
    packed.has(c.id)
      ? {
          ...c,
          start: packed.get(c.id) as number,
          duration: dur.get(c.id) as number,
        }
      : c,
  );
}

/** Initial sidebar width follows the viewport. */
export function defaultPanelWidth(kind: "left" | "right"): number {
  const min = kind === "left" ? 300 : 320;
  if (typeof window === "undefined") return min;
  return Math.max(min, Math.floor(window.innerWidth * 0.22));
}

/** Default timeline height in px (matches the old h-64). */
export const DEFAULT_TIMELINE_HEIGHT = 256;

export function defaultTimelineHeight(): number {
  return DEFAULT_TIMELINE_HEIGHT;
}

const THUMB_CLIP_DEFAULTS: TimelineClip[] = [
  {
    id: "thumb-text-1",
    type: "text",
    start: 0,
    duration: 60,
    settings: {
      content: "LOFI CHILL VIBES",
      fontFamily: "sans-serif",
      fontWeight: "bold",
      fontSize: 70,
      textColor: "#ffffff",
      strokeColor: "#f43f5e",
      strokeWidth: 6,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      bgColor: "transparent",
      textEffect: "none",
    },
  },
  {
    id: "thumb-text-2",
    type: "text",
    start: 0,
    duration: 60,
    settings: {
      content: "Late Night Study & Code",
      fontFamily: "sans-serif",
      fontWeight: "normal",
      fontSize: 36,
      textColor: "#ffffff",
      strokeColor: "#0f172a",
      strokeWidth: 4,
      shadowColor: "#000000",
      shadowBlur: 5,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      bgColor: "rgba(15, 23, 42, 0.75)",
      bgPadding: 10,
      bgRadius: 10,
      textEffect: "none",
    },
  },
];

/** Fresh copy per caller — settings must never be shared between routes. */
export function createDefaultThumbClips(): TimelineClip[] {
  return THUMB_CLIP_DEFAULTS.map((c) => ({
    ...c,
    settings: cloneClipSettings(c.settings),
  }));
}

export const DEFAULT_LYRICS_SETTINGS: Record<string, unknown> = {
  enabled: true,
  // Bottom-center anchor so the gizmo/box follows the text (as before).
  originX: 0.5,
  originY: 1,
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  fontFamily: "sans-serif",
  fontSize: 48,
  fontWeight: "bold",
  lineHeight: 1.2,
  textAlign: "center",
  textColor: "#ffffff",
  activeColor: "#ffffff",
  inactiveColor: "#94a3b8",
  inactiveOpacity: 0.45,
  activeSizeBoost: 1,
  lineTransitionIn: "fade",
  lineTransitionOut: "fade",
  lineTransitionDuration: 0.3,
  lineTransitionEnabled: true,
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowColor: "rgba(0,0,0,0.8)",
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  bgColor: "transparent",
  bgPadding: 10,
  bgRadius: 8,
  lineGap: 8,
  // Stack neighbour counts (used only in stack mode; single shows one line).
  // `contextLines` stays as the legacy fallback for older projects.
  contextLines: 0,
  contextBefore: 1,
  contextAfter: 1,
  karaokeMode: false,
  offsetSeconds: 0,
  fallbackLineDuration: 4,
  unstampedAutoAdvance: false,
};
