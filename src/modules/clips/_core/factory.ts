import type { ClipType, TimelineClip } from "../../../shared/types/clip";

let seq = 0;

export function defaultTrackFor(type: ClipType): string {
  return type === "music" ? "track-1" : "track-2";
}

export function createTimelineClip(
  type: ClipType,
  start: number,
  defaults: Record<string, unknown>,
  defaultDuration: number,
  trackId?: string,
): TimelineClip {
  seq += 1;
  return {
    id: `${type}-${Date.now()}-${seq}`,
    type,
    trackId: trackId ?? defaultTrackFor(type),
    start,
    duration: defaultDuration,
    settings: { ...defaults },
  };
}
