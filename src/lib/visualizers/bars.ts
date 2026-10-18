import { runtime } from "../runtime";
import { hexToHSL } from "../../utils/helpers";

export const BarsVisualizer = {
  id: "bars",
  name: "Bars",
  hasReflection: true,
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
  ) {
    const { color, intensity, density, rainbow, reflectionOpacity } = settings;
    const refOpacity =
      reflectionOpacity !== undefined ? reflectionOpacity : 0.25;
    const freqCount = Math.floor(runtime.analyser.frequencyBinCount * 0.8);
    const bars = Math.max(4, Math.floor(freqCount / density));
    const baseHsl = hexToHSL(color || "#3b82f6");
    const baselineY = h - 40; // baseline shifted up to make room for bottom reflection

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor(i * (freqCount / bars));
      const val = runtime.dataArray[idx] * intensity;
      const barHeight = Math.min(baselineY * 0.8, val);

      const x = (i / bars) * w;
      const nextX = ((i + 1) / bars) * w;
      const currentBarWidth = Math.max(1, nextX - x);
      const gap = currentBarWidth > 4 ? 2 : 0;

      let drawColor;
      if (rainbow) {
        // Horizontal spectrum anchored by the custom base color
        const hue = (baseHsl.h + (i / bars) * 360) % 360;
        const s = Math.max(70, baseHsl.s);
        const l = Math.max(45, Math.min(65, baseHsl.l));
        drawColor = `hsl(${hue}, ${s}%, ${l}%)`;
      } else {
        drawColor = color;
      }

      // 1. Draw Main Bar (upwards from baseline)
      ctx.save();
      ctx.fillStyle = drawColor;
      ctx.shadowColor = drawColor;
      ctx.shadowBlur = 10;
      ctx.fillRect(x, baselineY - barHeight, currentBarWidth - gap, barHeight);
      ctx.restore();

      // 2. Draw Reflection Bar (downwards from baseline, fading out)
      ctx.save();
      const reflectionHeight = barHeight * refOpacity;
      const reflectGrad = ctx.createLinearGradient(
        0,
        baselineY,
        0,
        baselineY + reflectionHeight,
      );

      if (rainbow) {
        const hue = (baseHsl.h + (i / bars) * 360) % 360;
        const s = Math.max(70, baseHsl.s);
        const l = Math.max(45, Math.min(65, baseHsl.l));
        reflectGrad.addColorStop(
          0,
          `hsla(${hue}, ${s}%, ${l}%, ${refOpacity})`,
        );
        reflectGrad.addColorStop(1, `hsla(${hue}, ${s}%, ${l}%, 0.0)`);
      } else {
        // Safe HSL mapping to avoid slicing bugs
        reflectGrad.addColorStop(
          0,
          `hsla(${baseHsl.h}, ${baseHsl.s}%, ${baseHsl.l}%, ${refOpacity})`,
        );
        reflectGrad.addColorStop(
          1,
          `hsla(${baseHsl.h}, ${baseHsl.s}%, ${baseHsl.l}%, 0.0)`,
        );
      }

      ctx.fillStyle = reflectGrad;

      // Apply parent shadow glow matching the opacity level
      ctx.shadowColor = drawColor;
      ctx.shadowBlur = 10 * refOpacity;

      ctx.fillRect(x, baselineY, currentBarWidth - gap, reflectionHeight);
      ctx.restore();
    }
  },
};
