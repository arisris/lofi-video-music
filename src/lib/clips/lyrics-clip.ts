import { editorStore } from "../../store/editor-store";
import { getClipsToSearch } from "../../utils/helpers";
import { LyricsSettingsView } from "../../components/clip-settings/lyrics";
import { drawEmojiText, measureEmojiText } from "../emoji-render";
import {
  endsByLine,
  resolveActiveLineIndex,
  type LyricLine,
} from "../lyrics";
import {
  enterTransition,
  exitTransition,
  resolveEnterTransition,
  resolveExitTransition,
} from "../transitions";

interface ActiveLyricTrack {
  trackTime: number;
  lines: LyricLine[];
}

interface LyricRow {
  text: string;
  active: boolean;
  fontSize: number;
  /** Width of the glyphs, excluding the background box padding. */
  width: number;
  /** Height of the row including padding. */
  height: number;
  x: number;
  y: number;
}

interface LyricLayout {
  rows: LyricRow[];
  box: { x: number; y: number; width: number; height: number };
  /** Index of the line on screen, -1 when nothing is drawn. */
  activeIndex: number;
  /** Where that line starts and stops, in the same time as `track.trackTime`. */
  activeStart: number;
  activeEnd: number;
}

const EMPTY_BOX = { x: 0, y: 0, width: 0, height: 0 };
const EMPTY_LAYOUT: LyricLayout = {
  rows: [],
  box: EMPTY_BOX,
  activeIndex: -1,
  activeStart: 0,
  activeEnd: 0,
};

/** Slide distance for a lyric entrance, relative to the line's own size. */
const SLIDE_RATIO = 0.45;

/**
 * The music clip under the playhead together with its lyrics, or null when
 * there is nothing to draw. Music with no lyrics attached returns null here,
 * which is what keeps an un-annotated track silent on the canvas.
 */
const getActiveLyricTrack = (): ActiveLyricTrack | null => {
  const state = editorStore.getState();
  if (state.currentRoute === "/image") return null;

  const currentTime = state.currentTime || 0;
  // Whichever music clip sits under the playhead wins. The layer's own
  // visibility is not checked here - the render loop has already skipped this
  // whole clip when clipSettings.lyrics.enabled is false, and re-reading a
  // different object here is what let a stale setting through before.
  const clip = getClipsToSearch(state).find(
    (c: any) =>
      c.type === "music" &&
      currentTime >= c.start &&
      currentTime <= c.start + c.duration,
  );
  if (!clip) return null;

  const lyrics = clip.settings?.lyrics;
  const lines = lyrics?.lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;

  return {
    // Position inside the audio file, which is what LRC timestamps refer to.
    // `startOffset` is the head trim applied to the music clip.
    trackTime: currentTime - clip.start + (clip.settings.startOffset || 0),
    lines,
  };
};

/**
 * Measures the visible rows and places them bottom-anchored, honouring
 * textAlign. Shared by getBoundingBox and draw so the transform box always
 * matches what gets painted - both run in the same frame.
 */
const layoutRows = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  settings: Record<string, any>,
  track: ActiveLyricTrack,
): LyricLayout => {
  const index = resolveActiveLineIndex(
    track.lines,
    track.trackTime - (settings.offsetSeconds || 0),
    {
      fallbackLineDuration: settings.fallbackLineDuration,
      autoAdvanceUnstamped: settings.unstampedAutoAdvance === true,
    },
  );
  if (index < 0) return EMPTY_LAYOUT;

  const { lines } = track;
  const ends = endsByLine(lines);
  // Unstamped lines under auto-advance have no `start` of their own; the
  // cadence that picked the line also decides its window.
  const cadence = settings.fallbackLineDuration ?? 4;
  const activeStart = lines[index].start ?? index * cadence;
  const activeEnd =
    lines[index].start !== null ? ends[index] : activeStart + cadence;
  const context = Math.max(0, Math.round(settings.contextLines || 0));

  const visible: number[] = [];
  for (let i = Math.max(0, index - context); i < index; i++) {
    if (lines[i].text) visible.push(i);
  }
  visible.push(index);
  for (let i = index + 1; i <= Math.min(lines.length - 1, index + context); i++) {
    if (lines[i].text) visible.push(i);
  }

  const family = settings.fontFamily || "sans-serif";
  const weight = settings.fontWeight || "normal";
  const lineHeight = settings.lineHeight || 1.2;
  const gap = settings.lineGap ?? 8;
  const padding = settings.bgPadding || 0;
  const boost = settings.activeSizeBoost ?? 1;

  ctx.save();
  const rows = visible.map<LyricRow>((i) => {
    const active = i === index;
    const fontSize = (settings.fontSize || 48) * (active ? boost : 1);
    ctx.font = `${weight} ${fontSize}px ${family}`;
    const text = lines[i].text;
    return {
      text,
      active,
      fontSize,
      width: measureEmojiText(ctx, text, fontSize),
      height: fontSize * lineHeight + padding * 2,
      x: 0,
      y: 0,
    };
  });
  ctx.restore();

  const boxWidth = Math.max(...rows.map((r) => r.width)) + padding * 2;
  const boxHeight =
    rows.reduce((sum, r) => sum + r.height, 0) + gap * (rows.length - 1);

  const portrait = editorStore.getState().aspectRatio !== "16:9";
  const margin = portrait ? Math.round(h * 0.16) : 60;
  const left = (w - boxWidth) / 2;
  let cursorY = h - margin - boxHeight;

  const textAlign = settings.textAlign || "center";
  for (const row of rows) {
    const rowWidth = row.width + padding * 2;
    row.x =
      textAlign === "right"
        ? left + boxWidth - rowWidth
        : textAlign === "center"
          ? left + (boxWidth - rowWidth) / 2
          : left;
    row.y = cursorY;
    cursorY += row.height + gap;
  }

  return {
    rows,
    box: { x: left, y: h - margin - boxHeight, width: boxWidth, height: boxHeight },
    activeIndex: index,
    activeStart,
    activeEnd,
  };
};

/**
 * Global lyrics overlay. A single layer that follows whichever music clip is
 * under the playhead and paints that clip's own lyric lines, so a track with
 * no lyrics simply shows nothing while a neighbour with lyrics carries on.
 */
export const LyricsClip = {
  id: "lyrics",
  name: "Lyrics",
  icon: "icon-[ri--mic-line]",

  settings: {
    // Beats the registry's default transform `enabled: true` - the layer stays
    // hidden until there is a lyric worth showing.
    enabled: false,
    // Anchored bottom-centre so the transform gizmo sits under the text.
    originX: 0.5,
    originY: 1,

    fontFamily: "'Inter', sans-serif",
    fontSize: 48,
    fontWeight: "bold",
    lineHeight: 1.2,
    textAlign: "center",
    textColor: "#ffffff",
    activeColor: "#ffffff",
    inactiveColor: "#94a3b8",
    inactiveOpacity: 0.45,
    activeSizeBoost: 1,
    // A new line eases in, and eases out before its own E. The cut between
    // lines is the one part of a lyric video that looks mechanical otherwise.
    lineTransitionIn: "fade",
    lineTransitionOut: "fade",
    lineTransitionDuration: 0.3,

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
    contextLines: 0,
    offsetSeconds: 0,
    fallbackLineDuration: 4,
    // Manual sync is the primary path, so unstamped lines stay off the canvas
    // until a pause stamps them.
    unstampedAutoAdvance: false,
  },

  getBoundingBox(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const track = getActiveLyricTrack();
    if (!track) return { ...EMPTY_BOX };
    return layoutRows(ctx, w, h, this.settings, track).box;
  },

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const settings = this.settings;
    const track = getActiveLyricTrack();
    if (!track) return;

    const layout = layoutRows(ctx, w, h, settings, track);
    const { rows } = layout;
    if (rows.length === 0) return;

    const padding = settings.bgPadding || 0;
    // Unset, empty, or a name from before the shared effects all land on fade,
    // which is the default the setting ships with. `lineTransition` on its own
    // is the pre-split key - it only ever drove the entrance, so it stays one.
    const enterType = resolveEnterTransition(
      settings.lineTransitionIn ??
        (settings as Record<string, any>).lineTransition,
    );
    const exitType = resolveExitTransition(settings.lineTransitionOut);
    const transitionSeconds = Number(settings.lineTransitionDuration ?? 0.3);
    const animates = transitionSeconds > 0;
    // A line shorter than the transition would never finish arriving, or
    // leaving, before the next one takes over - so both ends stay inside half
    // the line's own window.
    const span = layout.activeEnd - layout.activeStart;
    const transitionWindow = Math.min(
      transitionSeconds,
      Math.max(0.05, span * 0.5),
    );
    const time = track.trackTime - (settings.offsetSeconds || 0);
    const enterProgress = animates
      ? Math.min(1, Math.max(0, (time - layout.activeStart) / transitionWindow))
      : 1;
    const exitProgress = animates
      ? Math.min(1, Math.max(0, (layout.activeEnd - time) / transitionWindow))
      : 1;
    const hasShadow =
      (settings.shadowBlur || 0) > 0 ||
      (settings.shadowOffsetX || 0) !== 0 ||
      (settings.shadowOffsetY || 0) !== 0;

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (const row of rows) {
      const boxWidth = row.width + padding * 2;

      ctx.save();
      // layoutRows measured under its own save/restore, so the font has to be
      // re-applied here - the canvas default is 10px sans-serif, which would
      // otherwise paint every row at that size.
      ctx.font = `${settings.fontWeight || "normal"} ${row.fontSize}px ${settings.fontFamily || "sans-serif"}`;

      if (row.active) {
        if (hasShadow) {
          ctx.shadowColor = settings.shadowColor || "rgba(0,0,0,0.8)";
          ctx.shadowBlur = settings.shadowBlur || 0;
          ctx.shadowOffsetX = settings.shadowOffsetX || 0;
          ctx.shadowOffsetY = settings.shadowOffsetY || 0;
        }
      } else {
        ctx.globalAlpha *= settings.inactiveOpacity ?? 0.45;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Entrance and exit motion is applied to the whole row - background
      // included - so a badge arrives with its line instead of the text
      // sliding out of it. The curves come from the shared transition lib,
      // which is what keeps a "slide-up" lyric identical to a "slide-up" clip.
      if (row.active && animates && (enterProgress < 1 || exitProgress < 1)) {
        const enter = enterTransition(enterType, enterProgress);
        const exit = exitTransition(exitType, exitProgress);
        // The later of the two ends decides the opacity, so a line short
        // enough to be entering and leaving at once never flickers back to
        // full brightness in the middle.
        ctx.globalAlpha *= Math.min(enter.opacity, exit.opacity);
        const offsetY = enter.offsetY + exit.offsetY;
        if (offsetY !== 0) {
          ctx.translate(0, offsetY * row.fontSize * SLIDE_RATIO);
        }
        const scale = enter.scale * exit.scale;
        if (scale !== 1) {
          const cx = row.x + boxWidth / 2;
          const cy = row.y + row.height / 2;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);
        }
      }

      if (settings.bgColor && settings.bgColor !== "transparent") {
        ctx.fillStyle = settings.bgColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(row.x, row.y, boxWidth, row.height, settings.bgRadius || 0);
        } else {
          ctx.rect(row.x, row.y, boxWidth, row.height);
        }
        ctx.fill();
      }

      drawEmojiText(
        ctx,
        row.text,
        row.x + padding,
        row.y + padding,
        row.fontSize,
        row.active
          ? settings.activeColor || settings.textColor || "#ffffff"
          : settings.inactiveColor || settings.textColor || "#94a3b8",
        settings.strokeColor || "#000000",
        settings.strokeWidth || 0,
      );

      ctx.restore();
    }

    ctx.restore();
  },

  onSettings: LyricsSettingsView,
};