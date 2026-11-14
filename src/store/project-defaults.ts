import type { TimelineClip, TimelineTrack } from "../shared/types/clip";
import { cloneClipSettings } from "../shared/lib/media-urls";

/** max(60, ceil(maxEnd)) */
export function getTotalDuration(clips: TimelineClip[]): number {
  if (!clips || clips.length === 0) return 60;
  const maxEnd = clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  return Math.max(60, Math.ceil(maxEnd));
}

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "track-1", name: "Track 1 (Music)" },
  { id: "track-2", name: "Track 2" },
];

/** Initial sidebar width follows the viewport. */
export function defaultPanelWidth(kind: "left" | "right"): number {
  const min = kind === "left" ? 300 : 320;
  if (typeof window === "undefined") return min;
  return Math.max(min, Math.floor(window.innerWidth * 0.22));
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
