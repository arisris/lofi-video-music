import type { ClipDefinition } from "../../../shared/types/clip";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import {
  endsByLine,
  resolveActiveLineIndex,
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
 * New model (rewrite): lyrics live on the lyrics clip itself
 * (`settings.lines`), drawn from the clip's localTime.
 * Old model attached lyrics to the music clip — see
 * src_old/lib/clips/lyrics-clip.ts (getActiveLyricTrack) if migrating.
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
    { key: "contextLines", label: "Context lines", kind: "slider", min: 0, max: 5, step: 1 },
    { key: "offsetSeconds", label: "Offset (s)", kind: "number" },
  ],
  draw({ ctx, w, h, settings, localTime }) {
    const lines = linesOf(settings);
    if (lines.length === 0) return;
    const offset = typeof settings.offsetSeconds === "number" ? settings.offsetSeconds : 0;
    const index = resolveActiveLineIndex(lines, localTime - offset, {
      fallbackLineDuration:
        typeof settings.fallbackLineDuration === "number"
          ? settings.fallbackLineDuration
          : 4,
      autoAdvanceUnstamped: settings.unstampedAutoAdvance === true,
    });
    if (index < 0) return;

    const size = typeof settings.fontSize === "number" ? settings.fontSize : 48;
    // Legacy app key (`activeColor`) wins; rewrite alias `color` still honored.
    const color =
      typeof settings.activeColor === "string"
        ? settings.activeColor
        : typeof settings.color === "string"
          ? settings.color
          : "#ffffff";
    const inactive =
      typeof settings.inactiveColor === "string" ? settings.inactiveColor : "#94a3b8";
    const inOpacity =
      typeof settings.inactiveOpacity === "number" ? settings.inactiveOpacity : 0.45;
    const context =
      typeof settings.contextLines === "number" ? Math.round(settings.contextLines) : 0;
    const boost =
      typeof settings.activeSizeBoost === "number" ? settings.activeSizeBoost : 1;
    const gap = typeof settings.lineGap === "number" ? settings.lineGap : 8;
    const fontFamily = typeof settings.fontFamily === "string" ? settings.fontFamily : "sans-serif";
    const fontWeight = typeof settings.fontWeight === "string" ? settings.fontWeight : "normal";
    const strokeColor = typeof settings.strokeColor === "string" ? settings.strokeColor : "#000000";
    const strokeWidth = typeof settings.strokeWidth === "number" ? settings.strokeWidth : 0;
    const shadowBlur = typeof settings.shadowBlur === "number" ? settings.shadowBlur : 0;
    const shadowOX = typeof settings.shadowOffsetX === "number" ? settings.shadowOffsetX : 0;
    const shadowOY = typeof settings.shadowOffsetY === "number" ? settings.shadowOffsetY : 0;
    const hasShadow = shadowBlur > 0 || shadowOX !== 0 || shadowOY !== 0;

    // Active-line transition — mirrors src_old/lib/clips/lyrics-clip.ts.
    const enterType = resolveEnterTransition(settings.lineTransitionIn ?? settings.lineTransition);
    const exitType = resolveExitTransition(settings.lineTransitionOut);
    const transitionSeconds =
      typeof settings.lineTransitionDuration === "number" ? settings.lineTransitionDuration : 0.3;
    const animates = transitionSeconds > 0;
    const ends = endsByLine(lines);
    const aStart = lines[index].start;
    const aEnd = ends[index];
    const span =
      typeof aStart === "number" && typeof aEnd === "number" && Number.isFinite(aEnd)
        ? aEnd - aStart
        : transitionSeconds;
    const tWindow = Math.min(transitionSeconds, Math.max(0.05, span * 0.5));
    const t = localTime - offset;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const enterProgress =
      animates && typeof aStart === "number" ? clamp01((t - aStart) / tWindow) : 1;
    const exitProgress =
      animates && typeof aEnd === "number" && Number.isFinite(aEnd) ? clamp01((aEnd - t) / tWindow) : 1;

    const visible: number[] = [];
    for (let i = Math.max(0, index - context); i < index; i++) {
      if (lines[i].text) visible.push(i);
    }
    visible.push(index);
    for (let i = index + 1; i <= Math.min(lines.length - 1, index + context); i++) {
      if (lines[i].text) visible.push(i);
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = w / 2;
    // Legacy app mirror: portrait uses a 16% height margin so it is not
    // covered by bottom elements on a 720x1280 canvas.
    const bottomMargin = h > w ? Math.round(h * 0.16) : 140;
    const baseY = h - bottomMargin;
    let y = baseY - (visible.indexOf(index) * (size + gap));
    for (const vi of visible) {
      const active = vi === index;
      const fs = active ? size * boost : size * 0.85;
      const lineY = y;
      y += fs + gap;
      ctx.save();
      ctx.globalAlpha = active ? 1 : inOpacity;
      if (active && animates && (enterProgress < 1 || exitProgress < 1)) {
        const enter = enterTransition(enterType, enterProgress);
        const exit = exitTransition(exitType, exitProgress);
        ctx.globalAlpha *= Math.min(enter.opacity, exit.opacity);
        const offY = (enter.offsetY + exit.offsetY) * fs * 0.5;
        const sc = enter.scale * exit.scale;
        ctx.translate(cx, lineY + offY);
        ctx.scale(sc, sc);
        ctx.translate(-cx, -lineY);
      }
      ctx.font = `${active ? "bold" : fontWeight} ${fs}px ${fontFamily}`;
      if (active && hasShadow) {
        ctx.shadowColor = typeof settings.shadowColor === "string" ? settings.shadowColor : "rgba(0,0,0,0.8)";
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOX;
        ctx.shadowOffsetY = shadowOY;
      }
      ctx.fillStyle = active ? color : inactive;
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
    const offset = typeof settings.offsetSeconds === "number" ? settings.offsetSeconds : 0;
    const index = resolveActiveLineIndex(lines, localTime - offset, {
      fallbackLineDuration:
        typeof settings.fallbackLineDuration === "number"
          ? settings.fallbackLineDuration
          : 4,
      autoAdvanceUnstamped: settings.unstampedAutoAdvance === true,
    });
    if (index < 0) return null;
    const size = typeof settings.fontSize === "number" ? settings.fontSize : 48;
    const gap = typeof settings.lineGap === "number" ? settings.lineGap : 8;
    const context =
      typeof settings.contextLines === "number" ? Math.round(settings.contextLines) : 0;
    const bottomMargin = h > w ? Math.round(h * 0.16) : 140;
    const baseY = h - bottomMargin;
    let before = 0;
    let after = 0;
    for (let i = Math.max(0, index - context); i < index; i++) {
      if (lines[i].text) before++;
    }
    for (let i = index + 1; i <= Math.min(lines.length - 1, index + context); i++) {
      if (lines[i].text) after++;
    }
    const top = baseY - before * (size + gap) - size / 2 - 8;
    const bottom = baseY + after * (size + gap) + size / 2 + 8;
    return { x: 0, y: top, width: w, height: bottom - top };
  },
};
