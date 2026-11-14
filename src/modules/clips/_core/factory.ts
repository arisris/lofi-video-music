import type { ClipType, TimelineClip } from "../../../shared/types/clip";
import { VFX_TYPES } from "../../../shared/types/clip";

let seq = 0;

export function defaultTrackFor(type: ClipType): string {
  return type === "music" ? "track-1" : "track-2";
}

/** Deep-clone plain defaults so array/object settings (e.g. lyrics `lines`)
 * are never shared between freshly created clips. DOM values are copied
 * by reference (defaults carry nulls, real elements attach later). */
function cloneDefaults(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneDefaults);
  if (
    value &&
    typeof value === "object" &&
    (value as object).constructor === Object
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = cloneDefaults(v);
    }
    return out;
  }
  return value;
}

export function createTimelineClip(
  type: ClipType,
  start: number,
  defaults: Record<string, unknown>,
  defaultDuration: number,
  trackId?: string,
): TimelineClip {
  seq += 1;
  const settings = cloneDefaults(defaults) as Record<string, unknown>;
  if (
    (VFX_TYPES as readonly string[]).includes(type) &&
    typeof settings.seed !== "number"
  ) {
    // Persisted particle seed: the same project renders the same arrangement
    // across reloads and exports (old clips fall back to a session seed).
    settings.seed = (Math.random() * 0x7fffffff) | 0;
  }
  return {
    id: `${type}-${Date.now()}-${seq}`,
    type,
    trackId: trackId ?? defaultTrackFor(type),
    start,
    duration: defaultDuration,
    settings,
  };
}
