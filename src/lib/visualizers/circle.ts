import { runtime } from "../runtime";
import { hexToHSL } from "../../utils/helpers";

export const CircleVisualizer = {
  id: "circle",
  name: "Circle",
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
  ) {
    const { color, intensity, density, rainbow } = settings;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) * 0.25;
    const baseHsl = hexToHSL(color || "#3b82f6");

    const freqCount = Math.floor(runtime.analyser.frequencyBinCount * 0.8);
    const bars = Math.max(8, Math.floor(freqCount / density));
    const angleStep = (Math.PI * 2) / bars;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor(i * (freqCount / bars));
      const val = runtime.dataArray[idx] * intensity * 0.7;
      const angle = i * angleStep - Math.PI / 2;
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + val);
      const y2 = centerY + Math.sin(angle) * (radius + val);

      if (rainbow) {
        // Radial spectrum anchored by the custom base color
        const hue = (baseHsl.h + (i / bars) * 360) % 360;
        const s = Math.max(70, baseHsl.s);
        const l = Math.max(45, Math.min(65, baseHsl.l));
        ctx.strokeStyle = `hsl(${hue}, ${s}%, ${l}%)`;
        ctx.shadowColor = `hsl(${hue}, ${s}%, ${l}%)`;
      } else {
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
      }

      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (runtime.dataArray[10]) {
      const pulse = (runtime.dataArray[10] / 255) * 20;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 5 + pulse * intensity, 0, Math.PI * 2);
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * 0.3;
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  },
};
