/** Contracts shared by every background transition definition. */
import type { TimelineClip } from "../../../shared/types/clip";
import type {
  BgTransition,
  BgTransitionType,
} from "../../../shared/lib/transitions";

/** Drawable effects. `none` is the absence of an effect, so it has no entry. */
export type TransitionKind = Exclude<BgTransitionType, "none">;

/** Paints one clip with the given (transition-adjusted) settings. */
export type PaintBackground = (
  clip: TimelineClip,
  settings: Record<string, unknown>,
) => void;

export interface PaintArgs {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  clip: TimelineClip;
  /** Settings before the transition adjustment (never mutate the original). */
  base: Record<string, unknown>;
  /** 0 → 1 for a head ramp, 1 → 0 for a tail ramp. */
  phase: number;
  kind: "head" | "tail";
  paint: PaintBackground;
}

export interface Prepared {
  clip: TimelineClip;
  tr: BgTransition;
  /** Effective duration, clamped to the clip length. */
  D: number;
  end: number;
}

/** How the OUTGOING clip reacts while this effect plays. */
export interface OutgoingResponse {
  /** Multiplier on the clip's own scale (1 = unchanged). */
  scale?: number;
  /** Extra full-frame blur in px. */
  blur?: number;
}

export interface BgTransitionDefinition {
  type: TransitionKind;
  /** Head/tail treatment for a single clip. */
  paint: (args: PaintArgs) => void;
  /**
   * Pair effect across an abutting boundary (e.g. a fold). Supplied instead
   * of a head ramp: the definition receives both paint callbacks, so it owns
   * the composition order (incoming page underneath, outgoing sheet on top).
   */
  pair?: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    progress: number,
    paintIncoming: () => void,
    paintOutgoing: () => void,
  ) => void;
  /** Optional reaction applied to the preceding clip. */
  outgoing?: (phase: number) => OutgoingResponse;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function baseOpacity(base: Record<string, unknown>): number {
  return typeof base.opacity === "number" ? base.opacity : 1;
}

export function scaleSettings(
  base: Record<string, unknown>,
  opacity: number,
  scale: number,
): Record<string, unknown> {
  const sx = typeof base.scaleX === "number" ? base.scaleX : 1;
  const sy = typeof base.scaleY === "number" ? base.scaleY : 1;
  return { ...base, opacity, scaleX: sx * scale, scaleY: sy * scale };
}
