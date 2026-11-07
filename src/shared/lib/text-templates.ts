export interface TextTemplate {
  name: string;
  settings: Record<string, unknown>;
  /** Inline style string for the preview swatch. */
  cssStyle: string;
}

/**
 * Built-in text styles shared by the Text panel and the Lyrics panel, so a
 * style picked for a lyric renders exactly like the same style on a text clip.
 */
export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    name: "Neon Glow",
    settings: {
      content: "Neon Glow",
      fontFamily: "'Bungee', cursive",
      textColor: "#ff007f",
      strokeColor: "#ffffff",
      strokeWidth: 1.5,
      shadowColor: "#ff007f",
      shadowBlur: 15,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontSize: 36,
    },
    cssStyle:
      "font-family: 'Bungee', cursive; color: #ff007f; text-shadow: 0 0 10px #ff007f; -webkit-text-stroke: 0.5px #fff;",
  },
  {
    name: "Cyberpunk",
    settings: {
      content: "Cyberpunk",
      fontFamily: "'Press Start 2P', cursive",
      textColor: "#facc15",
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowColor: "#00ffff",
      shadowBlur: 0,
      shadowOffsetX: -3,
      shadowOffsetY: 3,
      fontSize: 20,
    },
    cssStyle:
      "font-family: 'Press Start 2P', cursive; color: #facc15; text-shadow: -2px 2px 0px #00ffff; -webkit-text-stroke: 1.5px #000; font-size: 10px; font-weight: bold;",
  },
  {
    name: "VHS Retro",
    settings: {
      content: "VHS Retro",
      fontFamily: "'Roboto Mono', monospace",
      textColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowColor: "#ff0000",
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 1,
      fontSize: 32,
    },
    cssStyle:
      "font-family: 'Roboto Mono', monospace; color: #fff; text-shadow: 2px 1px 0px #ff0000; -webkit-text-stroke: 1px #000; font-weight: bold;",
  },
  {
    name: "Soft Badge",
    settings: {
      content: "Soft Badge",
      fontFamily: "'Lexend', sans-serif",
      textColor: "#1e293b",
      bgColor: "#fed7aa",
      bgPadding: 10,
      bgRadius: 16,
      fontWeight: "bold",
      fontSize: 24,
    },
    cssStyle:
      "font-family: 'Lexend', sans-serif; color: #1e293b; background-color: #fed7aa; border-radius: 12px; padding: 4px 12px; font-weight: bold;",
  },
  {
    name: "Retro Arcade",
    settings: {
      content: "Retro Arcade",
      fontFamily: "'VT323', monospace",
      textColor: "#22c55e",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "#22c55e",
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontSize: 48,
    },
    cssStyle:
      "font-family: 'VT323', monospace; color: #22c55e; text-shadow: 0 0 8px #22c55e; font-size: 16px;",
  },
  {
    name: "Cozy Pillow",
    settings: {
      content: "Cozy Pillow",
      fontFamily: "'Comfortaa', cursive",
      textColor: "#475569",
      bgColor: "#ffedd5",
      bgPadding: 12,
      bgRadius: 24,
      fontWeight: "bold",
      fontSize: 24,
    },
    cssStyle:
      "font-family: 'Comfortaa', cursive; color: #475569; background-color: #ffedd5; border-radius: 24px; padding: 4px 12px; font-weight: bold; font-size: 10px;",
  },
  {
    name: "Vapor Wave",
    settings: {
      content: "Vapor Wave",
      fontFamily: "'Syne', sans-serif",
      textColor: "#c084fc",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "#3b82f6",
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontWeight: "800",
      fontSize: 32,
    },
    cssStyle:
      "font-family: 'Syne', sans-serif; color: #c084fc; text-shadow: 0 0 6px #3b82f6; font-weight: 800; text-transform: uppercase; font-size: 11px;",
  },
  {
    name: "Ink Script",
    settings: {
      content: "Ink Script",
      fontFamily: "'Satisfy', cursive",
      textColor: "#f43f5e",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.4)",
      shadowBlur: 4,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      fontSize: 36,
    },
    cssStyle:
      "font-family: 'Satisfy', cursive; color: #f43f5e; font-size: 14px;",
  },
  {
    name: "Typewriter",
    settings: {
      content: "Typewriter",
      fontFamily: "'Courier Prime', monospace",
      textColor: "#ffffff",
      bgColor: "#1e293b",
      bgPadding: 8,
      bgRadius: 2,
      fontSize: 24,
    },
    cssStyle:
      "font-family: 'Courier Prime', monospace; color: #fff; background-color: #1e293b; border-radius: 2px; padding: 3px 8px; font-size: 10px;",
  },
  {
    name: "Editorial",
    settings: {
      content: "Editorial",
      fontFamily: "'Abril Fatface', serif",
      textColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowBlur: 6,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      fontSize: 38,
    },
    cssStyle:
      "font-family: 'Abril Fatface', serif; color: #ffffff; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); font-size: 12px;",
  },
  {
    name: "Pop Banger",
    settings: {
      content: "Pop Banger",
      fontFamily: "'Bangers', cursive",
      textColor: "#ffffff",
      strokeColor: "#0284c7",
      strokeWidth: 3,
      shadowColor: "rgba(0,0,0,0.8)",
      shadowBlur: 5,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      fontSize: 36,
    },
    cssStyle:
      "font-family: 'Bangers', cursive; color: #fff; -webkit-text-stroke: 1px #0284c7; text-shadow: 2px 2px 2px rgba(0,0,0,0.8);",
  },
  {
    name: "Sweet Hand",
    settings: {
      content: "Sweet Hand",
      fontFamily: "'Pacifico', cursive",
      textColor: "#fda4af",
      strokeColor: "#881337",
      strokeWidth: 1.5,
      shadowColor: "rgba(0,0,0,0.3)",
      shadowBlur: 4,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      fontSize: 32,
    },
    cssStyle:
      "font-family: 'Pacifico', cursive; color: #fda4af; -webkit-text-stroke: 0.5px #881337;",
  },
  {
    name: "Glass Subtitle",
    settings: {
      content: "Glass Subtitle",
      fontFamily: "'Inter', sans-serif",
      textColor: "#ffffff",
      bgColor: "rgba(15, 23, 42, 0.75)",
      bgPadding: 8,
      bgRadius: 6,
      fontSize: 24,
    },
    cssStyle:
      "font-family: 'Inter', sans-serif; color: #fff; background-color: rgba(15, 23, 42, 0.75); border-radius: 6px; padding: 4px 10px; border: 1px solid rgba(255,255,255,0.1);",
  },
  {
    name: "Luxury Gold",
    settings: {
      content: "Luxury Gold",
      fontFamily: "'Playfair Display', serif",
      textColor: "#fbbf24",
      strokeColor: "#78350f",
      strokeWidth: 1.5,
      shadowColor: "rgba(251, 191, 36, 0.3)",
      shadowBlur: 8,
      fontWeight: "bold",
      fontSize: 32,
    },
    cssStyle:
      "font-family: 'Playfair Display', serif; color: #fbbf24; -webkit-text-stroke: 0.5px #78350f; font-weight: bold; text-shadow: 0 0 5px rgba(251, 191, 36, 0.3);",
  },
];

/**
 * Fallbacks for every style key a template is allowed to set.
 *
 * Applying a template has to replace the style, not layer onto whatever was
 * there before, or the same template renders differently depending on what it
 * followed. The old code merged only the keys the new template happened to
 * carry, so switching from a badge back to a plain style had no `bgColor` to
 * overwrite the badge's background with and the badge colour came along for
 * the ride. These defaults are what clears those leftovers.
 */
const TEMPLATE_STYLE_BASE = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 48,
  fontWeight: "bold",
  textColor: "#ffffff",
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowColor: "rgba(0,0,0,0.8)",
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  bgColor: "transparent",
  bgPadding: 10,
  bgRadius: 8,
} as const;

/**
 * A template's complete style patch - every key it can touch, with the demo
 * copy removed. Text clips keep `content`; the lyrics layer has no content of
 * its own.
 */
export const templateStyle = (template: TextTemplate) => {
  const { content: _content, ...style } = template.settings;
  return { ...TEMPLATE_STYLE_BASE, ...style };
};