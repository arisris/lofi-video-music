import type { ClipDefinition } from "../../../shared/types/clip";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import {
  drawEmojiText,
  measureEmojiText,
} from "../../../shared/lib/emoji-render";
import { useEditorStore } from "../../../store/editor-store";

// Playlist overlay
// Reads music clips from the new store (no enabled/global clipSettings).
function musicClips() {
  const { clips, currentTime } = useEditorStore.getState();
  const musics = clips
    .filter((c) => c.type === "music")
    .sort((a, b) => a.start - b.start);
  const activeIndex = musics.findIndex(
    (c) => currentTime >= c.start && currentTime <= c.start + c.duration,
  );
  return { musics, activeIndex, currentTime };
}

export const playlistClip: ClipDefinition = {
  type: "playlist",
  name: "Playlist",
  icon: "mdi:playlist-music",
  defaultDuration: 60,
  defaultSettings: {
    ...DEFAULT_TRANSFORM,
    maxItems: 12,
    truncateText: false,
    fontFamily: "sans-serif",
    fontSize: 18,
    fontWeight: "bold",
    textColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 0,
    shadowColor: "rgba(0,0,0,0.6)",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    bgColor: "transparent",
    bgPadding: 25,
    bgRadius: 16,
    accentColor: "#3b82f6",
  },
  schema: [
    {
      key: "maxItems",
      label: "Max items",
      kind: "slider",
      min: 1,
      max: 30,
      step: 1,
    },
    { key: "fontSize", label: "Size", kind: "slider", min: 10, max: 48 },
    { key: "textColor", label: "Color", kind: "color" },
    { key: "accentColor", label: "Accent", kind: "color" },
    { key: "truncateText", label: "Truncate", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings }) {
    const { musics, activeIndex } = musicClips();
    const { playing } = useEditorStore.getState();
    if (musics.length === 0) return;

    const maxItems =
      typeof settings.maxItems === "number" ? settings.maxItems : 12;
    const fontSize =
      typeof settings.fontSize === "number" ? settings.fontSize : 18;
    const fontWeight =
      typeof settings.fontWeight === "string" ? settings.fontWeight : "bold";
    const fontFamily =
      typeof settings.fontFamily === "string"
        ? settings.fontFamily
        : "sans-serif";
    const textColor =
      typeof settings.textColor === "string" ? settings.textColor : "#ffffff";
    const accent =
      typeof settings.accentColor === "string"
        ? settings.accentColor
        : "#3b82f6";
    const innerPadding =
      typeof settings.bgPadding === "number" ? settings.bgPadding : 25;
    const itemHeight = Math.max(30, fontSize * 1.6);
    const margin = 30;

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const indexWidth = ctx.measureText("00. ").width + 10;
    ctx.restore();

    const barW = Math.max(2, fontSize * 0.15);
    const barGap = Math.max(2, fontSize * 0.1);
    const eqWidth = barW * 3 + barGap * 2 + 5;

    let startIndex = 0;
    if (musics.length > maxItems && activeIndex > maxItems / 2) {
      startIndex = activeIndex - Math.floor(maxItems / 2);
      if (startIndex + maxItems > musics.length)
        startIndex = musics.length - maxItems;
    }
    const endIndex = Math.min(musics.length, startIndex + maxItems);
    const displayCount = endIndex - startIndex;
    if (displayCount <= 0) return;

    ctx.save();
    let maxTextW = 0;
    for (let i = startIndex; i < endIndex; i++) {
      const isCurrent = i === activeIndex;
      ctx.font = `${isCurrent ? "bold" : fontWeight} ${fontSize}px ${fontFamily}`;
      const name =
        typeof musics[i].settings.name === "string"
          ? (musics[i].settings.name as string)
          : "Music";
      const actual = measureEmojiText(ctx, name, fontSize);
      const tw = settings.truncateText ? Math.min(220, actual) : actual;
      if (tw > maxTextW) maxTextW = tw;
    }
    ctx.restore();

    const boxW = Math.max(
      260,
      innerPadding + indexWidth + maxTextW + eqWidth + innerPadding,
    );
    // Legacy app mirror: landscape docks top-right, portrait top-center.
    const portrait = h > w;
    const boxX = portrait ? (w - boxW) / 2 : w - boxW - margin;
    const boxY = margin;
    const boxH = innerPadding * 2 + displayCount * itemHeight;

    ctx.save();
    const bgColor =
      typeof settings.bgColor === "string" ? settings.bgColor : "transparent";
    if (bgColor && bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(
          boxX,
          boxY,
          boxW,
          boxH,
          typeof settings.bgRadius === "number" ? settings.bgRadius : 16,
        );
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxW, boxH);
      }
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const shadowBlur =
      typeof settings.shadowBlur === "number" ? settings.shadowBlur : 0;
    let listY = boxY + innerPadding;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    for (let i = startIndex; i < endIndex; i++) {
      const clip = musics[i];
      const isCurrent = i === activeIndex;
      ctx.save();
      ctx.font = `${isCurrent ? "bold" : fontWeight} ${fontSize}px ${fontFamily}`;
      if (shadowBlur > 0) {
        ctx.shadowColor =
          typeof settings.shadowColor === "string"
            ? settings.shadowColor
            : "rgba(0,0,0,0.6)";
        ctx.shadowBlur = isCurrent ? Math.max(shadowBlur, 15) : shadowBlur;
        ctx.shadowOffsetX =
          typeof settings.shadowOffsetX === "number"
            ? settings.shadowOffsetX
            : 0;
        ctx.shadowOffsetY =
          typeof settings.shadowOffsetY === "number"
            ? settings.shadowOffsetY
            : 0;
      }
      ctx.fillStyle = "#ffffff";
      if (!isCurrent) ctx.fillStyle = textColor;
      const indexStr = `${(i + 1).toString().padStart(2, "0")}.`;
      ctx.fillText(indexStr, boxX + innerPadding, listY);

      let nameStr =
        typeof clip.settings.name === "string"
          ? (clip.settings.name as string)
          : "Music";
      if (settings.truncateText) {
        const maxNameW = boxW - (innerPadding * 2 + indexWidth + 25);
        while (
          measureEmojiText(ctx, nameStr, fontSize) > maxNameW &&
          nameStr.length > 0
        ) {
          nameStr = nameStr.slice(0, -1);
        }
        const orig =
          typeof clip.settings.name === "string"
            ? (clip.settings.name as string)
            : "Music";
        if (nameStr !== orig) nameStr = `${nameStr.trim()}...`;
      }
      drawEmojiText(
        ctx,
        nameStr,
        boxX + innerPadding + indexWidth,
        listY,
        fontSize,
        isCurrent ? "#ffffff" : textColor,
        typeof settings.strokeColor === "string"
          ? settings.strokeColor
          : "#000000",
        typeof settings.strokeWidth === "number" ? settings.strokeWidth : 0,
      );

      if (isCurrent && playing) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = accent;
        const time = Date.now() * 0.005;
        const baseH = fontSize * 0.4;
        const varH = fontSize * 0.3;
        const h1 = baseH + Math.sin(time) * varH;
        const h2 = baseH + Math.sin(time + 2) * varH;
        const h3 = baseH + Math.sin(time + 4) * varH;
        const totalEqW = barW * 3 + barGap * 2;
        const eqX = boxX + boxW - innerPadding - totalEqW;
        const baseline = listY + fontSize / 2 + baseH / 2;
        ctx.fillRect(eqX, baseline - h1, barW, h1);
        ctx.fillRect(eqX + barW + barGap, baseline - h2, barW, h2);
        ctx.fillRect(eqX + (barW + barGap) * 2, baseline - h3, barW, h3);
      }
      ctx.restore();
      listY += itemHeight;
    }
    ctx.restore();
  },
  getItemBoundingBox(ctx, w, _h, settings) {
    const { musics, activeIndex } = musicClips();
    if (musics.length === 0) return null;
    const maxItems =
      typeof settings.maxItems === "number" ? settings.maxItems : 12;
    const fontSize =
      typeof settings.fontSize === "number" ? settings.fontSize : 18;
    const fontWeight =
      typeof settings.fontWeight === "string" ? settings.fontWeight : "bold";
    const fontFamily =
      typeof settings.fontFamily === "string"
        ? settings.fontFamily
        : "sans-serif";
    const innerPadding =
      typeof settings.bgPadding === "number" ? settings.bgPadding : 25;
    const itemHeight = Math.max(30, fontSize * 1.6);
    const margin = 30;

    let startIndex = 0;
    if (musics.length > maxItems && activeIndex > maxItems / 2) {
      startIndex = activeIndex - Math.floor(maxItems / 2);
      if (startIndex + maxItems > musics.length)
        startIndex = musics.length - maxItems;
    }
    const endIndex = Math.min(musics.length, startIndex + maxItems);
    const displayCount = endIndex - startIndex;
    if (displayCount <= 0) return null;

    ctx.save();
    let maxTextW = 0;
    for (let i = startIndex; i < endIndex; i++) {
      const isCurrent = i === activeIndex;
      ctx.font = `${isCurrent ? "bold" : fontWeight} ${fontSize}px ${fontFamily}`;
      const name =
        typeof musics[i].settings.name === "string"
          ? (musics[i].settings.name as string)
          : "Music";
      const tw = measureEmojiText(ctx, name, fontSize);
      if (tw > maxTextW) maxTextW = tw;
    }
    const indexWidth = ctx.measureText("00. ").width + 10;
    ctx.restore();

    const barW = Math.max(2, fontSize * 0.15);
    const barGap = Math.max(2, fontSize * 0.1);
    const eqWidth = barW * 3 + barGap * 2 + 5;
    const boxW = Math.max(
      260,
      innerPadding + indexWidth + maxTextW + eqWidth + innerPadding,
    );
    const boxH = innerPadding * 2 + displayCount * itemHeight;
    const portrait = _h > w;
    return {
      x: portrait ? (w - boxW) / 2 : w - boxW - margin,
      y: margin,
      width: boxW,
      height: boxH,
    };
  },
};
