import type { ClipDefinition } from "../../../shared/types/clip";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import {
  endsByLine,
  resolveActiveLineIndex,
  resolveHeldLineIndex,
  type LyricLine,
} from "../../lyrics/lyrics";
import {
  enterTransition,
  exitTransition,
  resolveEnterTransition,
  resolveExitTransition,
} from "../../../shared/lib/transitions";

function linesOf(settings: Record<string, unknown>): LyricLine[] {
  const v = settings.lines;
  return Array.isArray(v) ? (v as LyricLine[]) : [];
}

/**
 * Neighbour counts for stack mode. Single mode always shows one line.
 *
 * Legacy projects only carry the symmetric `contextLines` — it feeds both
 * sides (floored at one, mirroring the old `Math.max(1, …)` force). Fresh
 * stacks store `contextBefore`/`contextAfter` explicitly and may use 0+0 for
 * a persistent single line with hold.
 */
function stackCounts(
  settings: Record<string, unknown>,
  karaoke: boolean,
): { before: number; after: number } {
  if (!karaoke) return { before: 0, after: 0 };
  const legacy =
    typeof settings.contextLines === "number"
      ? Math.round(settings.contextLines)
      : 1;
  const fallback = Math.max(1, legacy);
  const before =
    typeof settings.contextBefore === "number"
      ? Math.round(settings.contextBefore)
      : fallback;
  const after =
    typeof settings.contextAfter === "number"
      ? Math.round(settings.contextAfter)
      : fallback;
  return { before: Math.max(0, before), after: Math.max(0, after) };
}

/**
 * New model (rewrite): lyrics live on the lyrics clip itself
 * (`settings.lines`), drawn from the clip's localTime.
 * Old model attached lyrics to the music clip (see getActiveLyricTrack
 * if migrating from that layout).
 */
export const lyricsClip: ClipDefinition = {
  type: "lyrics",
  name: "Lyrics",
  icon: "mdi:music-note",
  defaultDuration: 30,
  defaultSettings: {
    ...DEFAULT_TRANSFORM,
    lines: [],
    fontSize: 48,
    color: "#ffffff",
    inactiveColor: "#94a3b8",
    inactiveOpacity: 0.45,
    contextLines: 0,
    karaokeMode: false,
    activeSizeBoost: 1,
    lineGap: 8,
    offsetSeconds: 0,
    fallbackLineDuration: 4,
    unstampedAutoAdvance: false,
  },
  schema: [
    { key: "fontSize", label: "Size", kind: "slider", min: 16, max: 120 },
    { key: "color", label: "Active color", kind: "color" },
    { key: "inactiveColor", label: "Inactive color", kind: "color" },
    {
      key: "contextBefore",
      label: "Lines before",
      kind: "slider",
      min: 0,
      max: 5,
      step: 1,
    },
    {
      key: "contextAfter",
      label: "Lines after",
      kind: "slider",
      min: 0,
      max: 5,
      step: 1,
    },
    { key: "offsetSeconds", label: "Offset (s)", kind: "number" },
  ],
  draw({ ctx, w, h, settings, localTime }) {
    const lines = linesOf(settings);
    if (lines.length === 0) return;
    const offset =
      typeof settings.offsetSeconds === "number" ? settings.offsetSeconds : 0;
    const t = localTime - offset;
    // Karaoke mode: neighbours stay on screen and the stack never blanks
    // once the first line has started (gaps hold the last line, fully
    // settled). Off = classic single line that may appear/disappear.
    const karaoke = settings.karaokeMode === true;
    let index = resolveActiveLineIndex(lines, t, {
      fallbackLineDuration:
        typeof settings.fallbackLineDuration === "number"
          ? settings.fallbackLineDuration
          : 4,
      autoAdvanceUnstamped: settings.unstampedAutoAdvance === true,
    });
    let heldBeyondEnd = false;
    if (karaoke && index < 0) {
      const held = resolveHeldLineIndex(lines, t);
      if (held >= 0) {
        index = held;
        heldBeyondEnd = true;
      }
    }
    if (index < 0) return;

    const size = typeof settings.fontSize === "number" ? settings.fontSize : 48;
    // Three aliases feed the active line: the dedicated control writes
    // `activeColor`, legacy projects use `color`, and the shared Typography
    // section writes `textColor`. Honor all three so no color control is dead.
    const color =
      typeof settings.activeColor === "string"
        ? settings.activeColor
        : typeof settings.color === "string"
          ? settings.color
          : typeof settings.textColor === "string"
            ? settings.textColor
            : "#ffffff";
    const inactive =
      typeof settings.inactiveColor === "string"
        ? settings.inactiveColor
        : "#94a3b8";
    const inOpacity =
      typeof settings.inactiveOpacity === "number"
        ? settings.inactiveOpacity
        : 0.45;
    // Edge melt: neighbours fade AND shrink per step away from the active
    // line, so a tall stack dissolves at the tips instead of ending on a
    // hard cut. Distance 1 keeps exactly `inactiveOpacity` / 0.85 size, so
    // the default 3-line stack renders identically to before — only deeper
    // stacks melt.
    const EDGE_FADE = 0.6;
    const EDGE_SIZE = 0.9;
    const edgeAlpha = (dist: number) =>
      dist <= 1 ? inOpacity : inOpacity * Math.pow(EDGE_FADE, dist - 1);
    const edgeSize = (dist: number) =>
      dist <= 1 ? 0.85 : 0.85 * Math.pow(EDGE_SIZE, dist - 1);
    // Before/after neighbour counts (single mode shows one line; legacy
    // `contextLines` feeds both sides — see stackCounts).
    const { before: nBefore, after: nAfter } = stackCounts(settings, karaoke);
    const boost =
      typeof settings.activeSizeBoost === "number"
        ? settings.activeSizeBoost
        : 1;
    const gap = typeof settings.lineGap === "number" ? settings.lineGap : 8;
    const fontFamily =
      typeof settings.fontFamily === "string"
        ? settings.fontFamily
        : "sans-serif";
    const fontWeight =
      typeof settings.fontWeight === "string" ? settings.fontWeight : "normal";
    // Active lines default to bold (legacy look); an explicit Weight choice
    // applies to both states so the control is never dead on the active line.
    const activeWeight =
      typeof settings.fontWeight === "string" ? settings.fontWeight : "bold";
    const strokeColor =
      typeof settings.strokeColor === "string"
        ? settings.strokeColor
        : "#000000";
    const strokeWidth =
      typeof settings.strokeWidth === "number" ? settings.strokeWidth : 0;
    const shadowBlur =
      typeof settings.shadowBlur === "number" ? settings.shadowBlur : 0;
    const shadowOX =
      typeof settings.shadowOffsetX === "number" ? settings.shadowOffsetX : 0;
    const shadowOY =
      typeof settings.shadowOffsetY === "number" ? settings.shadowOffsetY : 0;
    const hasShadow = shadowBlur > 0 || shadowOX !== 0 || shadowOY !== 0;

    // Active-line transition
    const enterType = resolveEnterTransition(
      settings.lineTransitionIn ?? settings.lineTransition,
    );
    const exitType = resolveExitTransition(settings.lineTransitionOut);
    const transitionSeconds =
      typeof settings.lineTransitionDuration === "number"
        ? settings.lineTransitionDuration
        : 0.3;
    // Master switch from the Lyric Display panel (defaults on for legacy projects).
    const transOn = settings.lineTransitionEnabled !== false;
    const animates = transOn && transitionSeconds > 0;
    const ends = endsByLine(lines);
    const fallbackLineDuration =
      typeof settings.fallbackLineDuration === "number"
        ? settings.fallbackLineDuration
        : 4;
    const autoAdvanceUnstamped = settings.unstampedAutoAdvance === true;
    const aStart = lines[index].start;
    // A held line has run past its end — treat it as open-ended so it stays
    // fully settled instead of playing its exit fade to invisible.
    const aEnd = heldBeyondEnd ? Number.POSITIVE_INFINITY : ends[index];
    const span =
      typeof aStart === "number" &&
      typeof aEnd === "number" &&
      Number.isFinite(aEnd)
        ? aEnd - aStart
        : transitionSeconds;
    const tWindow = Math.min(transitionSeconds, Math.max(0.05, span * 0.5));
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const enterProgress =
      animates && typeof aStart === "number"
        ? clamp01((t - aStart) / tWindow)
        : 1;
    // In stack mode the outgoing line is held on screen, so an exit fade
    // would dip out and snap back — the handoff interpolation below covers
    // the takeover instead. Single mode keeps its disappear-at-end.
    const exitProgress =
      !karaoke && animates && typeof aEnd === "number" && Number.isFinite(aEnd)
        ? clamp01((aEnd - t) / tWindow)
        : 1;
    const enter = enterTransition(enterType, enterProgress);
    const exit = exitTransition(exitType, exitProgress);

    const visible: number[] = [];
    for (let i = Math.max(0, index - nBefore); i < index; i++) {
      if (lines[i].text) visible.push(i);
    }
    visible.push(index);
    for (
      let i = index + 1;
      i <= Math.min(lines.length - 1, index + nAfter);
      i++
    ) {
      if (lines[i].text) visible.push(i);
    }

    // Stack handoff: the line shown just before this one took over. Morphed
    // active→inactive across the enter window instead of snapping in one
    // frame. Single mode never hits this: the previous line is not in its
    // one-line visible set.
    let prevIndex = -1;
    if (
      karaoke &&
      animates &&
      enterProgress < 1 &&
      typeof aStart === "number"
    ) {
      const prev = resolveActiveLineIndex(lines, aStart - 0.001, {
        fallbackLineDuration,
        autoAdvanceUnstamped,
      });
      if (prev >= 0 && prev !== index && visible.includes(prev))
        prevIndex = prev;
    }
    // A slide moves the whole stack together — a per-line offset would
    // detach the active line from its frozen neighbours.
    const stackShiftY = karaoke ? enter.offsetY * size * boost * 0.5 : 0;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = w / 2;
    // Legacy app mirror: portrait uses a 16% height margin so it is not
    // covered by bottom elements on a 720x1280 canvas.
    const bottomMargin = h > w ? Math.round(h * 0.16) : 140;
    const baseY = h - bottomMargin;
    if (stackShiftY !== 0) ctx.translate(0, stackShiftY);
    let y = baseY - visible.indexOf(index) * (size + gap);
    for (const vi of visible) {
      const active = vi === index;
      const handingOff = vi === prevIndex;
      // The handoff pair morphs across the enter window; the rest is settled.
      const e = handingOff ? enterProgress : 1;
      const dist = Math.abs(vi - index);
      const settledInactive = edgeAlpha(dist);
      const settledSize = edgeSize(dist);
      const fs = active
        ? size * boost
        : handingOff
          ? size * (boost + (settledSize - boost) * e)
          : size * settledSize;
      const lineY = y;
      y += fs + gap;
      ctx.save();
      if (active) ctx.globalAlpha = Math.min(enter.opacity, exit.opacity);
      else if (handingOff)
        ctx.globalAlpha = settledInactive + (1 - settledInactive) * (1 - e);
      else ctx.globalAlpha = settledInactive;
      // Midpoint style swap: the morph is quick enough that a hard color
      // cut reads as a crossfade, and font weight cannot interpolate.
      const useActiveStyle = active || (handingOff && e < 0.5);
      if (
        (active || handingOff) &&
        animates &&
        (enterProgress < 1 || exitProgress < 1)
      ) {
        const sc = active ? enter.scale * exit.scale : 1;
        if (karaoke) {
          if (sc !== 1) {
            ctx.translate(cx, lineY);
            ctx.scale(sc, sc);
            ctx.translate(-cx, -lineY);
          }
        } else if (active) {
          const offY = (enter.offsetY + exit.offsetY) * fs * 0.5;
          ctx.translate(cx, lineY + offY);
          ctx.scale(sc, sc);
          ctx.translate(-cx, -lineY);
        }
      }
      ctx.font = `${useActiveStyle ? activeWeight : fontWeight} ${fs}px ${fontFamily}`;
      if (useActiveStyle && hasShadow) {
        ctx.shadowColor =
          typeof settings.shadowColor === "string"
            ? settings.shadowColor
            : "rgba(0,0,0,0.8)";
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOX;
        ctx.shadowOffsetY = shadowOY;
      }
      ctx.fillStyle = useActiveStyle ? color : inactive;
      ctx.fillText(lines[vi].text, cx, lineY);
      if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(lines[vi].text, cx, lineY);
      }
      ctx.restore();
    }
    ctx.restore();
  },
  getItemBoundingBox(_ctx, w, h, settings, localTime = 0) {
    const lines = linesOf(settings);
    if (lines.length === 0) return null;
    const offset =
      typeof settings.offsetSeconds === "number" ? settings.offsetSeconds : 0;
    const t = localTime - offset;
    const karaoke = settings.karaokeMode === true;
    let index = resolveActiveLineIndex(lines, t, {
      fallbackLineDuration:
        typeof settings.fallbackLineDuration === "number"
          ? settings.fallbackLineDuration
          : 4,
      autoAdvanceUnstamped: settings.unstampedAutoAdvance === true,
    });
    if (karaoke && index < 0) index = resolveHeldLineIndex(lines, t);
    if (index < 0) return null;
    const size = typeof settings.fontSize === "number" ? settings.fontSize : 48;
    const gap = typeof settings.lineGap === "number" ? settings.lineGap : 8;
    const { before: nBefore, after: nAfter } = stackCounts(settings, karaoke);
    const bottomMargin = h > w ? Math.round(h * 0.16) : 140;
    const baseY = h - bottomMargin;
    let before = 0;
    let after = 0;
    for (let i = Math.max(0, index - nBefore); i < index; i++) {
      if (lines[i].text) before++;
    }
    for (
      let i = index + 1;
      i <= Math.min(lines.length - 1, index + nAfter);
      i++
    ) {
      if (lines[i].text) after++;
    }
    const top = baseY - before * (size + gap) - size / 2 - 8;
    const bottom = baseY + after * (size + gap) + size / 2 + 8;
    return { x: 0, y: top, width: w, height: bottom - top };
  },
};
