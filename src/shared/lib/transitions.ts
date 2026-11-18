/**
 * Shared transition curves for anything the canvas paints over time.
 *
 * Whole clips use these through `applyClipAnimations`, and the lyrics overlay
 * uses them per line, because a lyric changes every few seconds while a clip
 * appears once. Keeping the curves here means a "slide-up" lyric and a
 * "slide-up" clip move the same way, and a new clip type only has to call
 * `enterTransition` instead of growing another copy of the easing maths.
 *
 * The states are unitless: `offsetY` is a fraction of whatever slide distance
 * the caller chooses, so a full-frame clip can travel 50px while a caption
 * travels 20px using the same numbers.
 */

export type EnterTransition =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "bounce";

export type ExitTransition =
  | "none"
  | "fade"
  | "slide-up"
  | "slide-down"
  | "zoom-out";

export interface TransitionOption<T extends string> {
  id: T;
  label: string;
}

/** In effects, in the order the pickers list them. */
export const ENTER_TRANSITIONS: TransitionOption<EnterTransition>[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-down", label: "Slide Down" },
  { id: "zoom-in", label: "Zoom In" },
  { id: "bounce", label: "Bounce" },
];

/** Out effects. There is no `bounce` out - overshooting on the way out reads as a glitch. */
export const EXIT_TRANSITIONS: TransitionOption<ExitTransition>[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-down", label: "Slide Down" },
  { id: "zoom-out", label: "Zoom Out" },
];

/** Effect used when nothing has been chosen yet, or when a stored id is unknown. */
export const DEFAULT_ENTER_TRANSITION: EnterTransition = "fade";
export const DEFAULT_EXIT_TRANSITION: ExitTransition = "fade";

const ENTER_IDS = new Set<string>(ENTER_TRANSITIONS.map((option) => option.id));
const EXIT_IDS = new Set<string>(EXIT_TRANSITIONS.map((option) => option.id));

/**
 * Ids from the first cut of the lyric line effect. A project saved while those
 * names existed still carries them, so map each onto the shared effect that
 * replaced it rather than letting it fall through to "none".
 */
const LEGACY_ENTER_IDS: Record<string, EnterTransition> = {
  rise: "slide-up",
  drop: "slide-down",
  pop: "zoom-in",
};

/**
 * Coerces a stored value into a known in effect. Empty or unrecognised values
 * become the default, which is what keeps a line or clip from going static
 * after an effect is renamed.
 */
export function resolveEnterTransition(value: unknown): EnterTransition {
  if (typeof value === "string") {
    const legacy = LEGACY_ENTER_IDS[value];
    if (legacy) return legacy;
    if (ENTER_IDS.has(value)) return value as EnterTransition;
  }
  return DEFAULT_ENTER_TRANSITION;
}

/** Same coercion for the effect a line or clip leaves with. */
export function resolveExitTransition(value: unknown): ExitTransition {
  if (typeof value === "string" && EXIT_IDS.has(value)) {
    return value as ExitTransition;
  }
  return DEFAULT_EXIT_TRANSITION;
}

/** How long a clip's own in/out transition runs, in seconds. */
export const CLIP_TRANSITION_SECONDS = 0.6;

/** Background-to-background transition: owned by the incoming clip. */
export type BgTransitionType = "fade" | "zoom" | "blur" | "fold" | "none";

export const BG_TRANSITION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "fade", label: "Fade" },
  { value: "zoom", label: "Cross Zoom" },
  { value: "blur", label: "Blur Dissolve" },
  { value: "fold", label: "Page Fold" },
  { value: "none", label: "None" },
];

export const BG_TRANSITION_DEFAULT_DURATION = 1;
export const BG_TRANSITION_MAX_DURATION = 3;

export interface BgTransition {
  type: BgTransitionType;
  /** Seconds, clamped to [0, MAX]. Zero = hard cut even when type is fade. */
  duration: number;
}

/** Coerce stored background transition settings (unknown-tolerant). */
export function resolveBgTransition(
  settings: Record<string, unknown>,
): BgTransition {
  const rawType = settings.transitionType;
  const type: BgTransitionType =
    rawType === "none"
      ? "none"
      : rawType === "zoom"
        ? "zoom"
        : rawType === "blur"
          ? "blur"
          : rawType === "fold"
            ? "fold"
            : "fade";
  const raw = settings.transitionDuration;
  const duration =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.min(Math.max(0, raw), BG_TRANSITION_MAX_DURATION)
      : BG_TRANSITION_DEFAULT_DURATION;
  return { type, duration };
}

export interface TransitionState {
  opacity: number;
  /** Vertical offset as a fraction of the caller's slide distance; + is down. */
  offsetY: number;
  scale: number;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeInCubic = (t: number) => t * t * t;

export const easeOutBack = (t: number) =>
  1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const RESTING: TransitionState = { opacity: 1, offsetY: 0, scale: 1 };

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * State of something entering, where `progress` runs 0 (just appeared) to 1
 * (settled). Unknown ids fall back to "none" so a renamed effect cannot leave
 * a clip invisible.
 */
export function enterTransition(
  type: EnterTransition | string,
  progress: number,
): TransitionState {
  const p = clamp01(progress);
  if (p >= 1) return { ...RESTING };

  const eased = easeOutCubic(p);
  switch (type) {
    case "fade":
      return { opacity: eased, offsetY: 0, scale: 1 };
    case "slide-up":
      // Starts `distance` below its slot and rises into it.
      return { opacity: eased, offsetY: 1 - eased, scale: 1 };
    case "slide-down":
      return { opacity: eased, offsetY: eased - 1, scale: 1 };
    case "zoom-in":
      return { opacity: eased, offsetY: 0, scale: 0.5 + easeOutBack(p) * 0.5 };
    case "bounce":
      return { opacity: eased, offsetY: 0, scale: easeOutBack(p) };
    default:
      return { ...RESTING };
  }
}

/**
 * State of something exiting, where `remaining` runs 1 (untouched) down to 0
 * (gone). The caller combines it with the enter state when a clip is short
 * enough that both run at once.
 */
export function exitTransition(
  type: ExitTransition | string,
  remaining: number,
): TransitionState {
  const p = clamp01(remaining);
  if (p >= 1) return { ...RESTING };

  const eased = easeInCubic(p);
  switch (type) {
    case "fade":
      return { opacity: eased, offsetY: 0, scale: 1 };
    case "slide-up":
      return { opacity: eased, offsetY: eased - 1, scale: 1 };
    case "slide-down":
      return { opacity: eased, offsetY: 1 - eased, scale: 1 };
    case "zoom-out":
      return { opacity: eased, offsetY: 0, scale: 0.5 + eased * 0.5 };
    default:
      return { ...RESTING };
  }
}
