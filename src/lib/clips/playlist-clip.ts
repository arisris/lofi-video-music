import { editorStore } from "../../store/editor-store";
import { getClipsToSearch } from "../../utils/helpers";
import { PlaylistSettingsView } from "../../components/clip-settings/playlist";
import { drawEmojiText, measureEmojiText } from "../emoji-render";

export const PlaylistClip = {
  id: "playlist",
  name: "Playlist Overlay",
  icon: "icon-[ri--list-unordered]",

  settings: {
    maxItems: 12,
    truncateText: false,
    fontFamily: "'Inter', sans-serif",
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
  },

  getBoundingBox(ctx: CanvasRenderingContext2D, w: number, _h: number) {
    const margin = 30;
    const settings = this.settings;
    const innerPadding = settings.bgPadding || 25;
    const itemHeight = Math.max(30, settings.fontSize * 1.6);

    ctx.save();
    ctx.font = `${settings.fontWeight} ${settings.fontSize}px ${settings.fontFamily}`;
    const indexWidth = ctx.measureText("00. ").width + 10;
    ctx.restore();

    // Dynamic EQ width
    const barW = Math.max(2, settings.fontSize * 0.15);
    const barGap = Math.max(2, settings.fontSize * 0.1);
    const eqWidth = barW * 3 + barGap * 2 + 5; // +5 for extra breathing room

    const clipsToSearch = getClipsToSearch(editorStore.getState());
    const musicClips = clipsToSearch
      .filter((c: any) => c.type === "music" && c.settings?.enabled !== false)
      .sort((a: any, b: any) => a.start - b.start);
    const activeIndex = musicClips.findIndex(
      (c: any) =>
        editorStore.getState().currentTime >= c.start &&
        editorStore.getState().currentTime <= c.start + c.duration,
    );

    const displayCount = Math.min(musicClips.length, settings.maxItems);
    if (displayCount === 0) return { x: 0, y: 0, width: 0, height: 0 };

    ctx.save();
    let startIndex = 0;
    if (
      musicClips.length > settings.maxItems &&
      activeIndex > settings.maxItems / 2
    ) {
      startIndex = activeIndex - Math.floor(settings.maxItems / 2);
      if (startIndex + settings.maxItems > musicClips.length) {
        startIndex = musicClips.length - settings.maxItems;
      }
    }
    let endIndex = Math.min(musicClips.length, startIndex + settings.maxItems);

    // Calculate required width based on text
    let maxTextW = 0;
    for (let i = startIndex; i < endIndex; i++) {
      const isCurrent = i === activeIndex;
      const weight = isCurrent ? "bold" : settings.fontWeight;
      ctx.font = `${weight} ${settings.fontSize}px ${settings.fontFamily}`;
      const nameStr = musicClips[i].settings?.name || "Music";

      let tw;
      const actualWidth = measureEmojiText(ctx, nameStr, settings.fontSize);
      if (settings.truncateText) {
        tw = Math.min(220, actualWidth);
      } else {
        tw = actualWidth;
      }
      if (tw > maxTextW) maxTextW = tw;
    }
    ctx.restore();

    // Box Width = Left Padding + Index + Text + EQ Space + Right Padding
    let boxW = innerPadding + indexWidth + maxTextW + eqWidth + innerPadding;
    boxW = Math.max(260, boxW);

    let boxX: number, boxY: number, boxH: number;

    if (editorStore.getState().aspectRatio === "16:9") {
      boxX = w - boxW - margin;
      boxY = margin;
    } else {
      boxX = (w - boxW) / 2;
      boxY = margin;
    }

    boxH = innerPadding * 2 + displayCount * itemHeight;

    return { x: boxX, y: boxY, width: boxW, height: boxH };
  },

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const clipsToSearch = getClipsToSearch(editorStore.getState());
    const musicClips = clipsToSearch
      .filter((c: any) => c.type === "music" && c.settings?.enabled !== false)
      .sort((a: any, b: any) => a.start - b.start);
    if (musicClips.length === 0) return;

    const activeIndex = musicClips.findIndex(
      (c: any) =>
        editorStore.getState().currentTime >= c.start &&
        editorStore.getState().currentTime <= c.start + c.duration,
    );

    const settings = this.settings;
    const bbox = this.getBoundingBox(ctx, w, h);
    if (bbox.width === 0) return;

    const { x: boxX, y: boxY, width: boxW, height: boxH } = bbox;
    const innerPadding = settings.bgPadding || 25;
    const itemHeight = Math.max(30, settings.fontSize * 1.6);

    ctx.save();
    ctx.font = `${settings.fontWeight} ${settings.fontSize}px ${settings.fontFamily}`;
    const indexWidth = ctx.measureText("00. ").width + 10;
    ctx.restore();

    ctx.save();

    // 1. Background box
    if (settings.bgColor && settings.bgColor !== "transparent") {
      ctx.fillStyle = settings.bgColor;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";

      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, settings.bgRadius || 16);
        ctx.fill();
      } else {
        ctx.fillRect(boxX, boxY, boxW, boxH);
      }
    }

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 2. Indices
    let startIndex = 0;
    if (
      musicClips.length > settings.maxItems &&
      activeIndex > settings.maxItems / 2
    ) {
      startIndex = activeIndex - Math.floor(settings.maxItems / 2);
      if (startIndex + settings.maxItems > musicClips.length) {
        startIndex = musicClips.length - settings.maxItems;
      }
    }
    let endIndex = Math.min(musicClips.length, startIndex + settings.maxItems);

    // 3. Render Items
    let listY = boxY + innerPadding;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    for (let i = startIndex; i < endIndex; i++) {
      const clip = musicClips[i];
      const track = clip.settings;
      const isCurrent = i === activeIndex;

      ctx.save();
      const weight = isCurrent ? "bold" : settings.fontWeight;
      ctx.font = `${weight} ${settings.fontSize}px ${settings.fontFamily}`;

      if (
        settings.shadowBlur > 0 ||
        settings.shadowOffsetX !== 0 ||
        settings.shadowOffsetY !== 0
      ) {
        ctx.shadowColor = settings.shadowColor;
        ctx.shadowBlur = settings.shadowBlur;
        ctx.shadowOffsetX = settings.shadowOffsetX;
        ctx.shadowOffsetY = settings.shadowOffsetY;
      }

      if (isCurrent) {
        ctx.shadowBlur = Math.max(ctx.shadowBlur, 15);
        ctx.shadowColor =
          (editorStore.getState().clipSettings.visualizer?.color as string) ||
          "#3b82f6";
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = settings.textColor || "#ffffff";
      }

      // Draw Index (Left side balanced by innerPadding)
      const indexStr = `${(i + 1).toString().padStart(2, "0")}.`;
      ctx.fillText(indexStr, boxX + innerPadding, listY);

      // Draw Name
      let nameStr = track.name || "Music";
      const eqSpace = 25;
      if (settings.truncateText) {
        const maxNameW = boxW - (innerPadding * 2 + indexWidth + eqSpace);
        while (
          measureEmojiText(ctx, nameStr, settings.fontSize) > maxNameW &&
          nameStr.length > 0
        ) {
          nameStr = nameStr.slice(0, -1);
        }
        if (nameStr !== track.name) nameStr = nameStr.trim() + "...";
      }

      drawEmojiText(
        ctx,
        nameStr,
        boxX + innerPadding + indexWidth,
        listY,
        settings.fontSize,
        isCurrent ? "#ffffff" : settings.textColor || "#ffffff",
        settings.strokeColor || "#000000",
        settings.strokeWidth || 0,
      );

      // Equalizer animation (Right side balanced by innerPadding)
      if (isCurrent && editorStore.getState().isPlaying) {
        ctx.shadowBlur = 0;
        ctx.fillStyle =
          (editorStore.getState().clipSettings.visualizer?.color as string) ||
          "#3b82f6";
        const time = Date.now() * 0.005;

        // Scale dimensions based on font size
        const barW = Math.max(2, settings.fontSize * 0.15);
        const barGap = Math.max(2, settings.fontSize * 0.1);
        const baseH = settings.fontSize * 0.4;
        const varH = settings.fontSize * 0.3;

        const h1 = baseH + Math.sin(time) * varH;
        const h2 = baseH + Math.sin(time + 2) * varH;
        const h3 = baseH + Math.sin(time + 4) * varH;

        const totalEqW = barW * 3 + barGap * 2;
        const eqX = boxX + boxW - innerPadding - totalEqW;
        const baseline = listY + settings.fontSize / 2 + baseH / 2;

        ctx.fillRect(eqX, baseline - h1, barW, h1);
        ctx.fillRect(eqX + barW + barGap, baseline - h2, barW, h2);
        ctx.fillRect(eqX + (barW + barGap) * 2, baseline - h3, barW, h3);
      }

      ctx.restore();
      listY += itemHeight;
    }

    ctx.restore();
  },

  onSettings: PlaylistSettingsView,
};
