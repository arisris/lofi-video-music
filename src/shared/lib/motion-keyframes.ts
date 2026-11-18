// Keyframed background motion: explicit pan/zoom/rotation control points.
//
// A keyframe pins x/y offset (design px), scale multiplier, and rotation
// (degrees) at a clip-local time `t` (seconds). The engine linearly
// interpolates between neighbours and holds the ends, so motion is fully
// deterministic for pause, scrub, and headless export. Two or more valid
// keyframes drive the frame in drawBackground; fewer is stored but inert.
export interface MotionKeyframe {
  /** Clip-local seconds, clamped to [0, clip duration]. */
  t: number;
  /** Pan offset in design px (same unit as bgOffsetX/Y). */
  x: number;
  y: number;
  /** Zoom multiplier. */
  scale: number;
  /** Rotation in degrees (same unit as Transform rotation). */
  rotation: number;
}

export interface ResolvedMotion {
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
}

/** Hard cap so a corrupt project cannot grow an unbounded list. */
export const MAX_MOTION_KEYFRAMES = 64;

/** Default values for a fresh keyframe (1.15 scale leaves pan headroom). */
export const DEFAULT_KEYFRAME_MOTION: ResolvedMotion = {
  x: 0,
  y: 0,
  scale: 1.15,
  rotation: 0,
};

const num = (v: unknown, fb: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fb;

/** Coerce unknown stored data into a sorted, clamped keyframe list. */
export function sanitizeMotionKeyframes(
  value: unknown,
  duration: number,
): MotionKeyframe[] {
  if (!Array.isArray(value)) return [];
  const dur = num(duration, 0);
  const out: MotionKeyframe[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const t = num(r.t, NaN);
    if (!Number.isFinite(t)) continue;
    out.push({
      t: dur > 0 ? Math.min(Math.max(0, t), dur) : Math.max(0, t),
      x: num(r.x, 0),
      y: num(r.y, 0),
      scale: Math.min(Math.max(num(r.scale, 1), 0.05), 8),
      rotation: Math.min(Math.max(num(r.rotation, 0), -45), 45),
    });
    if (out.length >= MAX_MOTION_KEYFRAMES) break;
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Keyframes drive motion only once a segment exists to interpolate. */
export function hasMotionKeyframes(value: unknown, duration: number): boolean {
  return sanitizeMotionKeyframes(value, duration).length >= 2;
}

// ---------------------------------------------------------------------------
// Presets: named templates that expand into editable keyframes. Applying a
// preset writes plain keyframes (plus motionPreset for the picker label), so
// there is exactly one motion system — everything on screen is editable and
// nothing hides behind an opaque procedural effect.
// ---------------------------------------------------------------------------

export type MotionPresetId =
  | "none"
  | "random"
  | "zoomIn"
  | "zoomOut"
  | "panRight"
  | "panLeft"
  | "panUp"
  | "panDown";

export const MOTION_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "none", label: "None" },
  { value: "random", label: "Wander" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "panRight", label: "Pan Right" },
  { value: "panLeft", label: "Pan Left" },
  { value: "panUp", label: "Pan Up" },
  { value: "panDown", label: "Pan Down" },
];

export const MOTION_PRESET_IDS: ReadonlySet<string> = new Set(
  MOTION_PRESET_OPTIONS.map((o) => o.value),
);

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Expand a preset into keyframes for a clip of `duration` seconds on a
 * `w` x `h` canvas. Zoom presets are one-way (unlike the legacy oscillating
 * engine fallback); wander samples the legacy drift formula so old and new
 * projects start from the same look.
 */
export function buildPresetKeyframes(
  preset: string,
  duration: number,
  w: number,
  h: number,
): MotionKeyframe[] {
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 60;
  const W = Number.isFinite(w) && w > 0 ? w : 1280;
  const H = Number.isFinite(h) && h > 0 ? h : 720;
  const kf = (
    t: number,
    x: number,
    y: number,
    scale: number,
    rotation = 0,
  ): MotionKeyframe => ({
    t: r2(t),
    x: r2(x),
    y: r2(y),
    scale: r2(scale),
    rotation: r2(rotation),
  });

  switch (preset) {
    case "zoomIn":
      return [kf(0, 0, 0, 1.1), kf(dur, 0, 0, 1.3)];
    case "zoomOut":
      return [kf(0, 0, 0, 1.3), kf(dur, 0, 0, 1.1)];
    case "panRight":
      return [kf(0, -W * 0.05, 0, 1.15), kf(dur, W * 0.05, 0, 1.15)];
    case "panLeft":
      return [kf(0, W * 0.05, 0, 1.15), kf(dur, -W * 0.05, 0, 1.15)];
    case "panUp":
      return [kf(0, 0, H * 0.05, 1.15), kf(dur, 0, -H * 0.05, 1.15)];
    case "panDown":
      return [kf(0, 0, -H * 0.05, 1.15), kf(dur, 0, H * 0.05, 1.15)];
    case "random": {
      // Sample the legacy wander drift; 4s spacing keeps long clips light.
      const n = Math.min(Math.max(3, Math.ceil(dur / 4) + 1), 9);
      const out: MotionKeyframe[] = [];
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1)) * dur;
        out.push(
          kf(
            t,
            Math.sin(t * 0.23) * (W * 0.06),
            Math.cos(t * 0.17) * (H * 0.06),
            1.15 + 0.08 * Math.sin(t * 0.15) + 0.02 * Math.cos(t * 0.37),
          ),
        );
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * Interpolate motion at clip-local time. Holds the first keyframe before the
 * start (covers the -0.5s crossfade window) and the last one past the end.
 */
export function resolveMotionAt(
  keyframes: MotionKeyframe[],
  localTime: number,
): ResolvedMotion | null {
  if (keyframes.length < 2) return null;
  const t = Number.isFinite(localTime) ? localTime : 0;
  if (t <= keyframes[0].t) {
    const k = keyframes[0];
    return { x: k.x, y: k.y, scale: k.scale, rotation: k.rotation };
  }
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) {
    return { x: last.x, y: last.y, scale: last.scale, rotation: last.rotation };
  }
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const p = span > 0 ? (t - a.t) / span : 0;
      return {
        x: a.x + (b.x - a.x) * p,
        y: a.y + (b.y - a.y) * p,
        scale: a.scale + (b.scale - a.scale) * p,
        rotation: a.rotation + (b.rotation - a.rotation) * p,
      };
    }
  }
  return { x: last.x, y: last.y, scale: last.scale, rotation: last.rotation };
}
