import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { drawTextItem, getTextBoundingBox } from "./draw-text";

export const textClip: ClipDefinition = {
  type: "text",
  name: "Text",
  icon: "mdi:text",
  defaultDuration: 5,
  defaultSettings: {
    content: "Hello lofi",
    ...DEFAULT_TRANSFORM,
    offsetY: -100,
    opacity: 1,
    fontFamily: "sans-serif",
    fontWeight: "normal",
    fontSize: 64,
    lineHeight: 1.2,
    textAlign: "center",
    textColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 0,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    bgColor: "transparent",
    bgPadding: 10,
    bgRadius: 8,
    textEffect: "none",
    typewriterSpeed: 15,
    typewriterOut: true,
    wavyAmplitude: 6,
    wavyFrequency: 4,
    wavySpacing: 0.15,
  },
  schema: [
    { key: "content", label: "Content", kind: "text" },
    { key: "fontSize", label: "Size", kind: "slider", min: 12, max: 200 },
    { key: "textColor", label: "Color", kind: "color" },
    { key: "textEffect", label: "Effect", kind: "select", options: ["none", "typewriter", "wavy"] },
    { key: "opacity", label: "Opacity", kind: "slider", min: 0, max: 1, step: 0.05 },
    { key: "offsetY", label: "Base Y offset", kind: "slider", min: -500, max: 500, step: 1 },
  ],
  draw({ ctx, w, h, settings, localTime, duration }) {
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "text");
    const opacity = typeof settings.opacity === "number" ? settings.opacity : 1;
    ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
    drawTextItem(ctx, w, h, settings, localTime, duration);
    ctx.restore();
  },
  getItemBoundingBox(ctx, w, h, settings) {
    return getTextBoundingBox(ctx, w, h, settings);
  },
};
