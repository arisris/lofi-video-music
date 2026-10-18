import { runtime } from "../runtime";
import { VisualizerSettingsView } from "../../components/clip-settings/visualizer";
import { getVisualizer } from "../visualizers/index";

export const VisualizerClip = {
  id: "visualizer",
  name: "Visualizer",
  icon: "icon-[ri--pulse-line]",

  settings: {
    style: "bars",
    color: "#3b82f6",
    intensity: 0.5,
    opacity: 1,
    density: 1.5,
    rainbow: false,
    reflectionOpacity: 0.25,
    size: 1.0,
  },

  getItemBoundingBox(
    _ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
  ) {
    if (settings.style === "circle") {
      const radius = Math.min(w, h) * 0.25;
      const size = (radius + 50) * 2;
      return {
        x: w / 2 - size / 2,
        y: h / 2 - size / 2,
        width: size,
        height: size,
      };
    }
    if (settings.style === "waveform") {
      return { x: 0, y: h / 2 - 100, width: w, height: 200 };
    }
    return { x: 0, y: h / 2, width: w, height: h / 2 };
  },

  getBoundingBox(ctx: CanvasRenderingContext2D, w: number, h: number) {
    return this.getItemBoundingBox(ctx, w, h, this.settings);
  },

  drawItem(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
  ) {
    if (!runtime.analyser) return;

    const { style, color, opacity } = settings;
    const visualizer = getVisualizer(style);

    const size = settings.size !== undefined ? settings.size : 1.0;

    ctx.save();
    ctx.globalAlpha = opacity !== undefined ? opacity : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    if (size !== 1.0) {
      let anchorX = w / 2;
      let anchorY = h / 2;
      if (style === "bars" || style === "blocks") {
        anchorY = h - 40; // scale relative to the reflection baseline anchor
      }
      ctx.translate(anchorX, anchorY);
      ctx.scale(size, size);
      ctx.translate(-anchorX, -anchorY);
    }

    visualizer.draw(ctx, w, h, settings);

    ctx.restore();
  },

  draw(_ctx: CanvasRenderingContext2D, _w: number, _h: number) {},

  onSettings: VisualizerSettingsView,
};
