import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { getIconDataAsync, getIconImage } from "./icon-render";

// Full vector shapes — adapted from src_old/lib/clips/shape-clip.ts
// (rectangle/circle/triangle/star/polygon/heart/icon + gradient fill).
function num(s: Record<string, unknown>, key: string, fallback: number): number {
  return typeof s[key] === "number" ? (s[key] as number) : fallback;
}

function str(s: Record<string, unknown>, key: string, fallback: string): string {
  return typeof s[key] === "string" ? (s[key] as string) : fallback;
}

export const shapeClip: ClipDefinition = {
  type: "shape",
  name: "Shape",
  icon: "mdi:shape",
  defaultDuration: 5,
  defaultSettings: {
    ...DEFAULT_TRANSFORM,
    shapeType: "rectangle",
    iconName: "ri:star-fill",
    width: 150,
    height: 150,
    fillType: "solid",
    fillColor: "#3b82f6",
    fillColor2: "#8b5cf6",
    strokeColor: "#ffffff",
    strokeWidth: 0,
    cornerRadius: 8,
    starSpikes: 5,
    starInnerRatio: 0.4,
    polygonSides: 6,
    shadowColor: "rgba(0,0,0,0.5)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    opacity: 1,
  },
  schema: [
    { key: "shapeType", label: "Shape", kind: "select", options: ["rectangle", "circle", "triangle", "star", "polygon", "heart", "icon"] },
    { key: "width", label: "Width", kind: "slider", min: 16, max: 800 },
    { key: "height", label: "Height", kind: "slider", min: 16, max: 800 },
    { key: "fillColor", label: "Fill", kind: "color" },
    { key: "opacity", label: "Opacity", kind: "slider", min: 0, max: 1, step: 0.05 },
  ],
  draw({ ctx, w, h, settings, localTime, duration }) {
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "shape");

    const width = num(settings, "width", 150);
    const height = num(settings, "height", 150);
    const centerX = w / 2;
    const centerY = h / 2 - 100;
    const x = centerX - width / 2;
    const y = centerY - height / 2;

    ctx.globalAlpha *= num(settings, "opacity", 1);

    const shadowBlur = num(settings, "shadowBlur", 0);
    if (shadowBlur > 0 || num(settings, "shadowOffsetX", 0) !== 0 || num(settings, "shadowOffsetY", 0) !== 0) {
      ctx.shadowColor = str(settings, "shadowColor", "rgba(0,0,0,0.5)");
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = num(settings, "shadowOffsetX", 0);
      ctx.shadowOffsetY = num(settings, "shadowOffsetY", 0);
    }

    const type = str(settings, "shapeType", "rectangle");

    if (type === "icon" && settings.iconName) {
      const iconData = getIconDataAsync(str(settings, "iconName", "")) as {
        body: string;
        width: number;
        height: number;
      } | null;
      if (iconData) {
        const state = getIconImage(
          str(settings, "iconName", ""),
          iconData,
          str(settings, "fillColor", "#ffffff"),
          str(settings, "fillColor2", "#8b5cf6"),
          str(settings, "fillType", "solid"),
          str(settings, "strokeColor", "#ffffff"),
          num(settings, "strokeWidth", 0),
          width,
        );
        if (state.loaded) ctx.drawImage(state.img, x, y, width, height);
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.beginPath();
    if (type === "rectangle") {
      if (ctx.roundRect) ctx.roundRect(x, y, width, height, num(settings, "cornerRadius", 0));
      else ctx.rect(x, y, width, height);
    } else if (type === "circle") {
      ctx.arc(centerX, centerY, Math.min(width, height) / 2, 0, Math.PI * 2);
    } else if (type === "triangle") {
      ctx.moveTo(centerX, y);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
    } else if (type === "star") {
      const spikes = Math.max(3, Math.round(num(settings, "starSpikes", 5)));
      const outer = Math.min(width, height) / 2;
      const inner = outer * num(settings, "starInnerRatio", 0.4);
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;
      ctx.moveTo(centerX, centerY - outer);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(centerX + Math.cos(rot) * outer, centerY + Math.sin(rot) * outer);
        rot += step;
        ctx.lineTo(centerX + Math.cos(rot) * inner, centerY + Math.sin(rot) * inner);
        rot += step;
      }
      ctx.closePath();
    } else if (type === "polygon") {
      const sides = Math.max(3, Math.round(num(settings, "polygonSides", 6)));
      const radius = Math.min(width, height) / 2;
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        const sx = centerX + Math.cos(angle) * radius;
        const sy = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
    } else if (type === "heart") {
      const topY = centerY - height * 0.25;
      ctx.moveTo(centerX, centerY + height * 0.35);
      ctx.bezierCurveTo(centerX - width * 0.6, centerY - height * 0.2, centerX - width * 0.35, centerY - height * 0.5, centerX, topY);
      ctx.bezierCurveTo(centerX + width * 0.35, centerY - height * 0.5, centerX + width * 0.6, centerY - height * 0.2, centerX, centerY + height * 0.35);
      ctx.closePath();
    }

    const fillColor = str(settings, "fillColor", "#3b82f6");
    const hasFill = !!fillColor && fillColor !== "transparent";
    if (hasFill) {
      let fillStyle: string | CanvasGradient = fillColor;
      if (str(settings, "fillType", "solid") === "gradient") {
        const grad = ctx.createLinearGradient(x, y, x + width, y + height);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, str(settings, "fillColor2", "#8b5cf6"));
        fillStyle = grad;
      }
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    if (hasFill) {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const strokeWidth = num(settings, "strokeWidth", 0);
    const strokeColor = str(settings, "strokeColor", "#ffffff");
    if (strokeWidth > 0 && strokeColor && strokeColor !== "transparent") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }

    ctx.restore();
  },
  getItemBoundingBox(_ctx, w, h, settings) {
    const width = num(settings, "width", 150);
    const height = num(settings, "height", 150);
    return {
      x: w / 2 - width / 2,
      y: h / 2 - 100 - height / 2,
      width,
      height,
    };
  },
};
