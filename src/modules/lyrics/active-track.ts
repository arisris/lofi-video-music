// Global lyrics in the production/src_old model: lines owned by the active
// music clip, drawn as one global layer. Pure helper (no store) used by the
// render loop and canvas drag so axis/selection always match.
import type { TimelineClip } from "../../shared/types/clip";

export interface ActiveMusicLyrics {
  music: TimelineClip;
  /** Effective lines (new flat `settings.lines`, or nested legacy). */
  lines: unknown[];
  /** Local time relative to the music start (clip axis; +startOffset when nested). */
  localTime: number;
}

/** Active music + its lines, or null (the thumb route does not draw lyrics). */
export function activeMusicLyrics(
  clips: TimelineClip[],
  time: number,
  route = "/",
): ActiveMusicLyrics | null {
  if (route === "/image") return null;
  const now = time;
  const m = clips.find(
    (c) =>
      c.type === "music" &&
      (c.settings.enabled as boolean | undefined) !== false &&
      now >= c.start &&
      now < c.start + c.duration,
  );
  if (!m) return null;
  const s = m.settings as Record<string, unknown>;
  const flat = Array.isArray(s.lines) ? (s.lines as unknown[]) : null;
  const nested = (s.lyrics as { lines?: unknown } | undefined)?.lines;
  const raw = flat && flat.length > 0 ? flat : nested;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const off =
    !flat && typeof s.startOffset === "number" ? (s.startOffset as number) : 0;
  return { music: m, lines: raw, localTime: now - m.start + off };
}
