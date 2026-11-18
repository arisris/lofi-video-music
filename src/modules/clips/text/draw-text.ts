// Full text renderer
// `item` = flat clip settings. Supports: multiline, emoji, typewriter, wavy,
// shadow, background box.
import {
  drawEmojiText,
  drawWavyEmojiText,
  measureEmojiText,
} from "../../../shared/lib/emoji-render";
import type { ClipBBox } from "../../../shared/types/clip";

/** Measure a text block for hit-testing — metrics exactly matching drawTextItem. */
export function getTextBoundingBox(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  item: Record<string, unknown>,
  centerYOffset = -100,
): ClipBBox {
  const family =
    typeof item.fontFamily === "string" ? item.fontFamily : "sans-serif";
  const weight =
    typeof item.fontWeight === "string" ? item.fontWeight : "normal";
  const fontSize = typeof item.fontSize === "number" ? item.fontSize : 32;
  const lineHeight =
    typeof item.lineHeight === "number" ? item.lineHeight : 1.2;
  const content = typeof item.content === "string" ? item.content : "";
  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${family}`;
  const lines: string[] = content.split(/\n|\\n/);
  let maxWidth = 0;
  for (const line of lines) {
    const width = measureEmojiText(ctx, line, fontSize);
    if (width > maxWidth) maxWidth = width;
  }
  ctx.restore();
  const padding = typeof item.bgPadding === "number" ? item.bgPadding : 0;
  const strokePad = typeof item.strokeWidth === "number" ? item.strokeWidth : 0;
  const wavyPad =
    item.textEffect === "wavy" && typeof item.wavyAmplitude === "number"
      ? Math.abs(item.wavyAmplitude)
      : 0;
  const width = maxWidth + padding * 2 + strokePad * 2;
  const height =
    lines.length * fontSize * lineHeight +
    padding * 2 +
    strokePad * 2 +
    wavyPad * 2;
  const yBase = typeof item.offsetY === "number" ? item.offsetY : centerYOffset;
  return {
    x: w / 2 - width / 2,
    y: h / 2 + yBase - height / 2,
    width,
    height,
  };
}

/**
 * Slice content for the typewriter effect without breaking emoji (code-point
 * slice) or literal "\n" sequences (treated as one atomic newline unit).
 */
function typewriterSlice(content: string, charCount: number): string {
  if (charCount <= 0) return "";
  const units: string[] = [];
  const cps = Array.from(content);
  for (let i = 0; i < cps.length; i++) {
    if (cps[i] === "\\" && cps[i + 1] === "n") {
      units.push("\\n");
      i++;
    } else {
      units.push(cps[i]);
    }
    if (units.length >= charCount) break;
  }
  return units.join("");
}

export function drawTextItem(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  item: Record<string, unknown>,
  localTime: number,
  duration: number,
  centerYOffset = -100,
) {
  const content = typeof item.content === "string" ? item.content : "";
  if (!content) return;

  ctx.save();

  const family =
    typeof item.fontFamily === "string" ? item.fontFamily : "sans-serif";
  const weight =
    typeof item.fontWeight === "string" ? item.fontWeight : "normal";
  const fontSize = typeof item.fontSize === "number" ? item.fontSize : 32;
  const lineHeight =
    typeof item.lineHeight === "number" ? item.lineHeight : 1.2;
  const textAlign =
    typeof item.textAlign === "string" ? item.textAlign : "center";

  ctx.font = `${weight} ${fontSize}px ${family}`;
  ctx.textBaseline = "top";

  const lines: string[] = content.split(/\n|\\n/);
  const lineInfo = lines.map((line) => ({
    content: line,
    width: measureEmojiText(ctx, line, fontSize),
  }));
  const maxWidth = Math.max(1, ...lineInfo.map((l) => l.width));
  const totalHeight = lines.length * fontSize * lineHeight;
  const padding = typeof item.bgPadding === "number" ? item.bgPadding : 0;
  const bgWidth = maxWidth + padding * 2;
  const bgHeight = totalHeight + padding * 2;

  const centerX = w / 2;
  const yBase = typeof item.offsetY === "number" ? item.offsetY : centerYOffset;
  const centerY = h / 2 + yBase;
  const bgX = centerX - bgWidth / 2;
  const bgY = centerY - bgHeight / 2;

  const shadowBlur = typeof item.shadowBlur === "number" ? item.shadowBlur : 0;
  const shadowOX =
    typeof item.shadowOffsetX === "number" ? item.shadowOffsetX : 0;
  const shadowOY =
    typeof item.shadowOffsetY === "number" ? item.shadowOffsetY : 0;
  const hasShadow = shadowBlur > 0 || shadowOX !== 0 || shadowOY !== 0;
  const shadowColor =
    typeof item.shadowColor === "string" ? item.shadowColor : "rgba(0,0,0,0.8)";

  const bgColor =
    typeof item.bgColor === "string" ? item.bgColor : "transparent";
  if (bgColor && bgColor !== "transparent") {
    // Background box stays crisp: no text shadow bleeds onto it.
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(
        bgX,
        bgY,
        bgWidth,
        bgHeight,
        typeof item.bgRadius === "number" ? item.bgRadius : 0,
      );
    } else {
      ctx.rect(bgX, bgY, bgWidth, bgHeight);
    }
    ctx.fill();
    ctx.restore();
  }

  if (hasShadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOX;
    ctx.shadowOffsetY = shadowOY;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  let contentToDraw = content;
  if (item.textEffect === "typewriter") {
    const speed =
      typeof item.typewriterSpeed === "number" &&
      Number.isFinite(item.typewriterSpeed)
        ? item.typewriterSpeed
        : 15;
    const t = Number.isFinite(localTime) ? Math.max(0, localTime) : 0;
    let charCount = Math.floor(t * speed);
    if (item.typewriterOut !== false && Number.isFinite(duration)) {
      charCount = Math.min(charCount, Math.floor((duration - t) * speed));
    }
    charCount = Math.max(0, charCount);
    // Atomic "\n" handling lives in typewriterSlice so a literal newline is
    // never split mid-sequence while typing.
    contentToDraw = typewriterSlice(contentToDraw, charCount);
  }
  const linesToDraw: string[] = contentToDraw.split(/\n|\\n/);

  linesToDraw.forEach((lineText, i) => {
    const lineWidth = measureEmojiText(ctx, lineText, fontSize);
    let x = centerX - maxWidth / 2;
    if (textAlign === "center") x = centerX - lineWidth / 2;
    else if (textAlign === "right") x = centerX + maxWidth / 2 - lineWidth;
    const y = bgY + padding + i * fontSize * lineHeight;
    if (item.textEffect === "wavy") {
      // Deterministic: driven by clip localTime (pauses + exports are stable).
      const time = Number.isFinite(localTime) ? Math.max(0, localTime) : 0;
      drawWavyEmojiText(
        ctx,
        lineText,
        x,
        y,
        fontSize,
        typeof item.textColor === "string" ? item.textColor : "#ffffff",
        typeof item.strokeColor === "string" ? item.strokeColor : "#000000",
        typeof item.strokeWidth === "number" ? item.strokeWidth : 0,
        time,
        typeof item.wavyAmplitude === "number" ? item.wavyAmplitude : 6,
        typeof item.wavyFrequency === "number" ? item.wavyFrequency : 4,
        typeof item.wavySpacing === "number" ? item.wavySpacing : 0.15,
      );
    } else {
      drawEmojiText(
        ctx,
        lineText,
        x,
        y,
        fontSize,
        typeof item.textColor === "string" ? item.textColor : "#ffffff",
        typeof item.strokeColor === "string" ? item.strokeColor : "#000000",
        typeof item.strokeWidth === "number" ? item.strokeWidth : 0,
      );
    }
  });

  ctx.restore();
}
