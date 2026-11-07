import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";

// Adapted from src_old/lib/vfx/film-grain.ts.
// Simplified glitch slice-shear (no getOutputScale): design-space sampling.
export const filmGrainVfx: VfxDefinition = {
  type: "filmgrain",
  name: "Film Grain & VHS",
  defaultSettings: { grainIntensity: 0.15, scanlinesOpacity: 0.08, glitchFrequency: 0.3, audioReactive: false },
  schema: [
    { key: "grainIntensity", label: "Grain", kind: "slider", min: 0, max: 1, step: 0.01 },
    { key: "scanlinesOpacity", label: "Scanlines", kind: "slider", min: 0, max: 0.5, step: 0.01 },
    { key: "glitchFrequency", label: "Glitch", kind: "slider", min: 0, max: 2, step: 0.1 },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, state }) {
    if (!state.noise) {
      const nSize = 128;
      const noise = document.createElement("canvas");
      noise.width = nSize;
      noise.height = nSize;
      const nCtx = noise.getContext("2d")!;
      const img = nCtx.createImageData(nSize, nSize);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 40;
      }
      nCtx.putImageData(img, 0, 0);
      state.noise = noise;
    }
    const scan = typeof settings.scanlinesOpacity === "number" ? settings.scanlinesOpacity : 0.08;
    if (scan > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${scan})`;
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
      ctx.restore();
    }
    const grain = typeof settings.grainIntensity === "number" ? settings.grainIntensity : 0.15;
    if (grain > 0) {
      ctx.save();
      ctx.globalAlpha = grain;
      const nSize = 128;
      const ox = Math.floor(Math.random() * nSize);
      const oy = Math.floor(Math.random() * nSize);
      for (let x = -ox; x < w; x += nSize) {
        for (let y = -oy; y < h; y += nSize) {
          ctx.drawImage(state.noise as HTMLCanvasElement, x, y);
        }
      }
      ctx.restore();
    }
    if (typeof state.active !== "number") state.active = 0;
    if (typeof state.cooldown !== "number") state.cooldown = 0;
    if ((state.cooldown as number) > 0) state.cooldown = (state.cooldown as number) - 1;
    if ((state.active as number) > 0) state.active = (state.active as number) - 1;

    let trigger = false;
    if (settings.audioReactive) {
      const bass = getAudioLevel("bass");
      if (bass > 0.68 && state.active === 0 && state.cooldown === 0) {
        state.active = 3 + Math.floor(Math.random() * 5);
        state.cooldown = 12;
      }
      if (state.active !== 0) trigger = true;
    } else {
      const freq = typeof settings.glitchFrequency === "number" ? settings.glitchFrequency : 0.3;
      if (Math.random() < 0.015 * freq && state.active === 0 && state.cooldown === 0) {
        state.active = 4 + Math.floor(Math.random() * 6);
        state.cooldown = 25;
      }
      if (state.active !== 0) trigger = true;
    }
    if (trigger) {
      ctx.save();
      const slices = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < slices; i++) {
        const sy = Math.random() * h;
        const sh = 5 + Math.random() * 50;
        const offset = (Math.random() - 0.5) * 25 * (typeof settings.glitchFrequency === "number" ? settings.glitchFrequency : 0.3);
        ctx.drawImage(ctx.canvas, 0, sy, w, sh, offset, sy, w, sh);
      }
      if (Math.random() < 0.4) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.06)";
        ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 15);
      }
      ctx.restore();
    }
  },
};
