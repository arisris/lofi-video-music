import { State } from "../state";
import { TextSettingsView } from "../../components/clip-settings/text";
import { drawEmojiText, measureEmojiText, drawWavyEmojiText } from "../emoji-render";

export const TextClip = {
  id: "text",
  name: "Text",
  icon: "icon-[ri--text-spacing]",

  settings: {
    items: [],
  },

  getItemBoundingBox(ctx: CanvasRenderingContext2D, w: number, h: number, item: Record<string, any>) {
    ctx.save();
    const family = item.fontFamily || "sans-serif";
    const weight = item.fontWeight || "normal";
    const fontSize = item.fontSize || 32;
    const lineHeight = item.lineHeight || 1.2;
    ctx.font = `${weight} ${fontSize}px ${family}`;
    
    const lines: string[] = (item.content || "").split(/\n|\\n/);
    let maxWidth = 0;
    lines.forEach(line => {
      const width = measureEmojiText(ctx, line, fontSize);
      if (width > maxWidth) maxWidth = width;
    });

    const totalHeight = lines.length * fontSize * lineHeight;
    const padding = item.bgPadding || 0;
    
    const width = maxWidth + padding * 2;
    const height = totalHeight + padding * 2;
    
    ctx.restore();

    return {
      x: w / 2 - width / 2,
      y: h / 2 - 100 - height / 2,
      width,
      height,
    };
  },

  drawItem(ctx: CanvasRenderingContext2D, w: number, h: number, item: Record<string, any>, localTime: number, clip: Record<string, any> | null) {
    if (!item.content) return;
    
    ctx.save();
    
    const family = item.fontFamily || "sans-serif";
    const weight = item.fontWeight || "normal";
    const fontSize = item.fontSize || 32;
    const lineHeight = item.lineHeight || 1.2;
    const textAlign = item.textAlign || "center";
    
    ctx.font = `${weight} ${fontSize}px ${family}`;
    ctx.textBaseline = "top";

    const lines: string[] = (item.content || "").split(/\n|\\n/);
    const lineInfo = lines.map(line => {
      const width = measureEmojiText(ctx, line, fontSize);
      return { content: line, width };
    });

    let maxWidth = Math.max(...lineInfo.map(l => l.width));
    const totalHeight = lines.length * fontSize * lineHeight;
    const padding = item.bgPadding || 0;
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = totalHeight + padding * 2;

    const centerX = w / 2;
    const centerY = h / 2 - 100;
    
    const bgX = centerX - bgWidth / 2;
    const bgY = centerY - bgHeight / 2;

    // Apply Shadow
    if (item.shadowBlur > 0 || item.shadowOffsetX !== 0 || item.shadowOffsetY !== 0) {
      ctx.shadowColor = item.shadowColor || "rgba(0,0,0,0.8)";
      ctx.shadowBlur = item.shadowBlur || 0;
      ctx.shadowOffsetX = item.shadowOffsetX || 0;
      ctx.shadowOffsetY = item.shadowOffsetY || 0;
    }

    // Draw Background
    if (item.bgColor && item.bgColor !== "transparent") {
      ctx.fillStyle = item.bgColor;
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgWidth, bgHeight, item.bgRadius || 0);
      ctx.fill();
    }

    // Keep shadow active for text drawing if shadow is set, otherwise reset it
    if (!(item.shadowBlur > 0 || item.shadowOffsetX !== 0 || item.shadowOffsetY !== 0)) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Slice content if typewriter effect is active
    let contentToDraw: string = item.content || "";
    const isThumbnailMode = State.currentRoute === "/image";
    if (item.textEffect === "typewriter" && !isThumbnailMode) {
      const speed = item.typewriterSpeed || 15;
      let charCount = Math.floor(localTime * speed);
      
      const duration = clip ? clip.duration : Infinity;
      if (item.typewriterOut !== false && isFinite(duration)) {
        const eraseCount = Math.floor((duration - localTime) * speed);
        charCount = Math.min(charCount, eraseCount);
      }
      charCount = Math.max(0, charCount);
      contentToDraw = contentToDraw.slice(0, charCount);
      
      // If we sliced in the middle of a literal "\\n" (leaving a trailing backslash), trim it to avoid showing a stray backslash
      if (contentToDraw.endsWith("\\") && (item.content || "").charAt(charCount) === "n") {
        contentToDraw = contentToDraw.slice(0, -1);
      }
    }
    const linesToDraw: string[] = contentToDraw.split(/\n|\\n/);

    // Draw Lines
    linesToDraw.forEach((lineText, i) => {
      const lineWidth = measureEmojiText(ctx, lineText, fontSize);
      let x = centerX - maxWidth / 2;
      if (textAlign === "center") {
        x = centerX - lineWidth / 2;
      } else if (textAlign === "right") {
        x = centerX + maxWidth / 2 - lineWidth;
      }
      
      const y = bgY + padding + i * fontSize * lineHeight;
      
      if (item.textEffect === "wavy" && !isThumbnailMode) {
        const time = performance.now() / 1000;
        drawWavyEmojiText(
          ctx,
          lineText,
          x,
          y,
          fontSize,
          item.textColor || "#ffffff",
          item.strokeColor || "#000000",
          item.strokeWidth || 0,
          time,
          item.wavyAmplitude !== undefined ? item.wavyAmplitude : 6,
          item.wavyFrequency !== undefined ? item.wavyFrequency : 4,
          item.wavySpacing !== undefined ? item.wavySpacing : 0.15
        );
      } else {
        drawEmojiText(
          ctx, 
          lineText, 
          x, 
          y, 
          fontSize, 
          item.textColor || "#ffffff",
          item.strokeColor || "#000000",
          item.strokeWidth || 0
        );
      }
    });

    ctx.restore();
  },

  draw(_ctx: CanvasRenderingContext2D, _w: number, _h: number) {},

  onSettings: TextSettingsView,
};
