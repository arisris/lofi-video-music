/**
 * Background transitions: registry + composer.
 *
 * Layout mirrors `modules/vfx`: one definition per effect in
 * `<effect>/definition.ts`, shared contracts in `_core/types.ts`, and this
 * index owning the registry and the per-frame composition order.
 */
import { createRegistry } from "../clips/_core/registry";
import type { TimelineClip } from "../../shared/types/clip";
import { resolveBgTransition } from "../../shared/lib/transitions";
import { blurTransition } from "./blur/definition";
import { fadeTransition } from "./fade/definition";
import { foldTransition } from "./fold/definition";
import { zoomTransition } from "./zoom/definition";
import {
  clamp01,
  scaleSettings,
  baseOpacity,
  type BgTransitionDefinition,
  type PaintArgs,
  type PaintBackground,
  type Prepared,
} from "./_core/types";

export type { PaintBackground } from "./_core/types";

export const bgTransitionRegistry = createRegistry<BgTransitionDefinition>(
  (def) => def.type,
);

for (const def of [fadeTransition, zoomTransition, blurTransition, foldTransition]) {
  bgTransitionRegistry.register(def);
}

/** How long before its own start a clip must be on screen. */
export function bgPreRoll(clip: TimelineClip): number {
  const t = resolveBgTransition(clip.settings as Record<string, unknown>);
  return t.type === "none" ? 0 : Math.min(t.duration, clip.duration);
}

function prepare(clips: TimelineClip[]): Prepared[] {
  return clips
    .map((clip) => {
      const tr = resolveBgTransition(clip.settings as Record<string, unknown>);
      return {
        clip,
        tr,
        D: Math.min(tr.duration, clip.duration),
        end: clip.start + clip.duration,
      };
    })
    .sort((a, b) => a.clip.start - b.clip.start);
}

/** First clip starting at/after `end` (the lane packs, so this is adjacent). */
function successorOf(list: Prepared[], item: Prepared): Prepared | undefined {
  return list.find(
    (c) =>
      c.clip.id !== item.clip.id &&
      c.clip.start >= item.end - 1e-6 &&
      c.clip.start <= item.end + 0.25,
  );
}

/** Visible now: the clip itself plus any head pre-roll. */
function isActive(item: Prepared, time: number): boolean {
  const pre = item.tr.type === "none" ? 0 : Math.min(item.tr.duration, item.clip.duration);
  return (
    time >= item.clip.start - pre &&
    time <= item.clip.start + item.clip.duration
  );
}

/** 0 → 1 across [start - D, start] while the successor's effect is armed. */
function windowPhase(succ: Prepared, time: number): number | null {
  if (succ.D <= 0) return null;
  const from = succ.clip.start - succ.D;
  if (time < from || time >= succ.clip.start) return null;
  return clamp01((time - from) / succ.D);
}

/** Compose the whole background layer for one frame. */
export function renderBackgroundLayers(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  clips: TimelineClip[],
  time: number,
  paint: PaintBackground,
): void {
  // The full lane, not just what is active: a successor must still be found
  // while it is outside its own pre-roll, or the predecessor would fade out
  // before a hard cut.
  const list = prepare(clips);
  const skip = new Set<string>();

  for (const item of list) {
    if (skip.has(item.clip.id) || !isActive(item, time)) continue;
    const succ = successorOf(list, item);
    const succPhase = succ ? windowPhase(succ, time) : null;

    // Pair effect: the successor owns the boundary (e.g. a fold). It paints
    // the incoming page underneath and the outgoing sheet on top, then the
    // successor is skipped later in the loop.
    if (succ && succPhase !== null) {
      const pair = bgTransitionRegistry.get(succ.tr.type)?.pair;
      if (pair) {
        pair(
          ctx,
          w,
          h,
          succPhase,
          () => paint(succ.clip, succ.clip.settings as Record<string, unknown>),
          () => paint(item.clip, item.clip.settings as Record<string, unknown>),
        );
        skip.add(succ.clip.id);
        continue;
      }
    }

    const { clip, tr, D } = item;
    const localTime = time - clip.start;
    const base = clip.settings as Record<string, unknown>;
    const head = localTime < 0 && D > 0;
    const tail = !succ && localTime > clip.duration - D && D > 0;

    // Outgoing reaction to the successor's effect (zoom punch, blur pull).
    let outgoingScale = 1;
    let outgoingBlur = 0;
    if (succPhase !== null && succ) {
      const response = bgTransitionRegistry.get(succ.tr.type)?.outgoing?.(succPhase);
      if (response?.scale) outgoingScale = response.scale;
      if (response?.blur) outgoingBlur = response.blur;
    }
    const effectiveBase =
      outgoingScale !== 1
        ? scaleSettings(base, baseOpacity(base), outgoingScale)
        : base;

    if (head || tail) {
      const def = bgTransitionRegistry.get(tr.type);
      if (def) {
        const args: PaintArgs = {
          ctx,
          w,
          h,
          clip,
          base: effectiveBase,
          phase: head
            ? clamp01((localTime + D) / D)
            : clamp01((clip.duration - localTime) / D),
          kind: tail ? "tail" : "head",
          paint,
        };
        def.paint(args);
      } else {
        paint(clip, effectiveBase);
      }
    } else {
      if (outgoingBlur > 0.05) ctx.filter = `blur(${outgoingBlur.toFixed(1)}px)`;
      try {
        paint(clip, effectiveBase);
      } finally {
        if (outgoingBlur > 0.05) ctx.filter = "none";
      }
    }
  }
}
