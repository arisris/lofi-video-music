import { runtime } from "../runtime";
import { hexToHSL } from "../../utils/helpers";

export const BlocksVisualizer = {
  id: "blocks",
  name: "Blocks (Equalizer)",
  hasReflection: true,
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, settings: Record<string, any>) {
    const { color, intensity, density, rainbow, reflectionOpacity } = settings;
    const refOpacity = reflectionOpacity !== undefined ? reflectionOpacity : 0.25;

    // Parse the custom base color HSL
    const baseHsl = hexToHSL(color || "#3b82f6");
    const freqCount = Math.floor(runtime.analyser.frequencyBinCount * 0.7);
    const bars = Math.max(8, Math.floor(100 / (density / 1.5)));

    const blockHeight = 4;
    const gapY = 1;
    const gapX = 1;
    const colWidth = w / bars;
    const baselineY = h - 40; // baseline shifted up to make room for bottom reflection
    const maxHeight = baselineY * 0.8;
    const maxBlocks = Math.floor(maxHeight / (blockHeight + gapY));

    const originalAlpha = ctx.globalAlpha;

    for (let i = 0; i < bars; i++) {
      const idx = Math.floor(i * (freqCount / bars));
      const rawVal = runtime.dataArray[idx] / 255;

      // Exponential dynamic scaling for beats to pop out punchily
      const dynamicVal = Math.pow(rawVal, 1.5);
      const activeBlocksFloat = dynamicVal * intensity * maxBlocks;

      const fullBlocks = Math.floor(activeBlocksFloat);
      const fraction = activeBlocksFloat - fullBlocks;

      const x = i * colWidth + gapX / 2;
      const drawWidth = colWidth - gapX;

      for (let j = 0; j <= fullBlocks; j++) {
        if (j === fullBlocks && fraction < 0.05) continue;

        const y = baselineY - (j * (blockHeight + gapY)) - blockHeight;
        const opacity = j === fullBlocks ? fraction : 1.0;

        let blockColor;
        const verticalRatio = j / maxBlocks;
        const blockLightness = Math.min(90, Math.max(40, baseHsl.l + (verticalRatio * 15)));

        if (rainbow) {
          const horizontalRatio = i / bars;
          const colHue = (baseHsl.h + (horizontalRatio * 360)) % 360;
          blockColor = `hsl(${colHue}, ${baseHsl.s}%, ${blockLightness}%)`;
        } else {
          blockColor = `hsl(${baseHsl.h}, ${baseHsl.s}%, ${blockLightness}%)`;
        }

        // 1. Draw Main LED Block (No save/restore, no shadowBlur to keep it high performance)
        ctx.globalAlpha = originalAlpha * opacity;
        ctx.fillStyle = blockColor;
        ctx.fillRect(x, y, drawWidth, blockHeight);

        // Glossy highlight overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(x, y, drawWidth, Math.max(1, blockHeight * 0.25));

        // 2. Draw Mirrored Reflection Block (fades out downwards)
        const yReflect = baselineY + (j * (blockHeight + gapY));
        const reflectOpacity = opacity * refOpacity * (1 - (j / Math.max(1, activeBlocksFloat)));
        if (reflectOpacity > 0.01) {
          ctx.globalAlpha = originalAlpha * reflectOpacity;
          ctx.fillStyle = blockColor;
          ctx.fillRect(x, yReflect, drawWidth, blockHeight);

          // Glossy highlight overlay
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          ctx.fillRect(x, yReflect, drawWidth, Math.max(1, blockHeight * 0.25));
        }
      }
    }

    // Restore original global alpha state
    ctx.globalAlpha = originalAlpha;
  },
};
