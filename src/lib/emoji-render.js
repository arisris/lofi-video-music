import m from "mithril";
const EMOJI_REGEX = /[\u{1f300}-\u{1f5ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{1f700}-\u{1f77f}\u{1f780}-\u{1f7ff}\u{1f800}-\u{1f8ff}\u{1f900}-\u{1f9ff}\u{1fa00}-\u{1fa6f}\u{1fa70}-\u{1faff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{2300}-\u{23ff}]/gu;

// Cache for loaded emoji images
const emojiCache = new Map();

/**
 * Gets the hex code point string for an emoji character
 * Handles ZWJ sequences by joining them with dashes
 */
function getEmojiHex(emoji) {
  return [...emoji].map(char => 
    char.codePointAt(0).toString(16)
  ).join("-");
}

/**
 * Parses a string into an array of text and emoji parts
 */
export function parseEmojiText(text) {
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    // Add text before emoji
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
    }
    // Add emoji
    parts.push({ type: "emoji", content: match[0], hex: getEmojiHex(match[0]) });
    lastIndex = EMOJI_REGEX.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.substring(lastIndex) });
  }

  return parts;
}

/**
 * Draws single emoji (helper function to avoid duplication)
 */
function drawSingleEmoji(ctx, part, x, y, fontSize, strokeColor, strokeWidth, color) {
  const hex = part.hex;
  const url = `https://fonts.gstatic.com/s/e/notoemoji/latest/${hex}/emoji.svg`;
  
  let img = emojiCache.get(hex);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      m.redraw();
    };
    emojiCache.set(hex, img);
  }

  if (img.complete && img.naturalWidth > 0) {
    const size = fontSize * 1.2;
    const offset = (size - fontSize) / 2;
    
    if (strokeWidth > 0) {
      const sw = strokeWidth / 2;
      ctx.save();
      ctx.filter = `drop-shadow(${sw}px ${sw}px 0 ${strokeColor}) drop-shadow(-${sw}px -${sw}px 0 ${strokeColor}) drop-shadow(${sw}px -${sw}px 0 ${strokeColor}) drop-shadow(-${sw}px ${sw}px 0 ${strokeColor})`;
      ctx.drawImage(img, x, y - offset, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y - offset, size, size);
    }
    return size + (fontSize * 0.1);
  } else {
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(part.content, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(part.content, x, y);
    return ctx.measureText(part.content).width;
  }
}

/**
 * Draws text with emoji fallback on canvas
 */
export function drawEmojiText(ctx, text, x, y, fontSize, color, strokeColor, strokeWidth) {
  const parts = parseEmojiText(text);
  let currentX = x;

  parts.forEach(part => {
    if (part.type === "text") {
      if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(part.content, currentX, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(part.content, currentX, y);
      currentX += ctx.measureText(part.content).width;
    } else {
      currentX += drawSingleEmoji(ctx, part, currentX, y, fontSize, strokeColor, strokeWidth, color);
    }
  });
}

/**
 * Calculates total width of text with emojis
 */
export function measureEmojiText(ctx, text, fontSize) {
  const parts = parseEmojiText(text);
  let totalWidth = 0;
  parts.forEach(part => {
    if (part.type === "text") {
      totalWidth += ctx.measureText(part.content).width;
    } else {
      totalWidth += fontSize * 1.3; // Estimated width
    }
  });
  return totalWidth;
}

export function drawWavyEmojiText(ctx, text, x, y, fontSize, color, strokeColor, strokeWidth, time, amplitude = 6, frequency = 4, spacing = 0.15) {
  const parts = parseEmojiText(text);
  let currentX = x;
  let charIndex = 0;

  parts.forEach(part => {
    if (part.type === "text") {
      const chars = [...part.content];
      chars.forEach(char => {
        const offsetY = Math.sin(time * frequency + charIndex * spacing) * amplitude;
        
        if (strokeWidth > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.strokeText(char, currentX, y + offsetY);
        }
        ctx.fillStyle = color;
        ctx.fillText(char, currentX, y + offsetY);
        
        currentX += ctx.measureText(char).width;
        charIndex++;
      });
    } else {
      const offsetY = Math.sin(time * frequency + charIndex * spacing) * amplitude;
      currentX += drawSingleEmoji(ctx, part, currentX, y + offsetY, fontSize, strokeColor, strokeWidth, color);
      charIndex++;
    }
  });
}
