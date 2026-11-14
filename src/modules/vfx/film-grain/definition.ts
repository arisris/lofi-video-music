import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { frameOf, hash01 } from "../_core/prng";

// Simplified glitch slice-shear (no getOutputScale): design-space sampling.
export const filmGrainVfx: VfxDefinition = {
  type: "filmgrain",
  name: "Film Grain & VHS",
  icon: "icon-[ri--film-line]",
  defaultSettings: {
    grainIntensity: 0.15,
    scanlinesOpacity: 0.08,
    glitchFrequency: 0.3,
    opacity: 1,
    audioReactive: false,
  },
  schema: [
    {
      key: "grainIntensity",
      label: "Grain",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: "scanlinesOpacity",
      label: "Scanlines",
      kind: "slider",
      min: 0,
      max: 0.5,
      step: 0.01,
    },
    {
      key: "glitchFrequency",
      label: "Glitch",
      kind: "slider",
      min: 0,
      max: 2,
      step: 0.1,
    },
    {
      key: "opacity",
      label: "Opacity",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, time, state }) {
    if (typeof state.lastT !== "number") state.lastT = time;
    // Frame-rate independent timers (k = elapsed 60fps-frames).
    const k = Math.min(Math.max((time - (state.lastT as number)) * 60, 0), 3);
    state.lastT = time;
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
    const scan =
      typeof settings.scanlinesOpacity === "number"
        ? settings.scanlinesOpacity
        : 0.08;
    const master = finiteSetting(settings, "opacity", 1);
    if (scan > 0 && master > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${scan * master})`;
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
      ctx.restore();
    }
    const grain =
      typeof settings.grainIntensity === "number"
        ? settings.grainIntensity
        : 0.15;
    if (grain > 0 && master > 0) {
      ctx.save();
      ctx.globalAlpha = grain * master;
      const nSize = 128;
      // Deterministic dither: same frame, same offset (stable scrub/export).
      const frame = frameOf(time);
      const ox = Math.floor(hash01(frame * 2 + 1) * nSize);
      const oy = Math.floor(hash01(frame * 2 + 2) * nSize);
      for (let x = -ox; x < w; x += nSize) {
        for (let y = -oy; y < h; y += nSize) {
          ctx.drawImage(state.noise as HTMLCanvasElement, x, y);
        }
      }
      ctx.restore();
    }
    if (typeof state.active !== "number") state.active = 0;
    if (typeof state.cooldown !== "number") state.cooldown = 0;
    if ((state.cooldown as number) > 0)
      state.cooldown = (state.cooldown as number) - k;
    if ((state.active as number) > 0)
      state.active = (state.active as number) - k;

    let trigger = false;
    // Deterministic triggers: same frame, same glitch (stable scrub/export).
    const gframe = frameOf(time);
    if (settings.audioReactive) {
      const bass = getAudioLevel("bass");
      if (
        bass > 0.68 &&
        (state.active as number) <= 0 &&
        (state.cooldown as number) <= 0
      ) {
        state.active = 3 + Math.floor(hash01(gframe * 3 + 11) * 5);
        state.cooldown = 12;
      }
      if ((state.active as number) > 0) trigger = true;
    } else {
      const freq =
        typeof settings.glitchFrequency === "number"
          ? settings.glitchFrequency
          : 0.3;
      if (
        hash01(gframe * 5 + 7) < 0.015 * freq &&
        (state.active as number) <= 0 &&
        (state.cooldown as number) <= 0
      ) {
        state.active = 4 + Math.floor(hash01(gframe * 7 + 3) * 6);
        state.cooldown = 25;
      }
      if ((state.active as number) > 0) trigger = true;
    }
    if (trigger && master > 0) {
      ctx.save();
      ctx.globalAlpha *= master;
      const slices = 4 + Math.floor(hash01(gframe * 11 + 5) * 5);
      for (let i = 0; i < slices; i++) {
        const sy = hash01(gframe * 13 + i * 101) * h;
        const sh = 5 + hash01(gframe * 17 + i * 103) * 50;
        const offset =
          (hash01(gframe * 19 + i * 107) - 0.5) *
          25 *
          (typeof settings.glitchFrequency === "number"
            ? settings.glitchFrequency
            : 0.3);
        ctx.drawImage(ctx.canvas, 0, sy, w, sh, offset, sy, w, sh);
      }
      if (hash01(gframe * 23 + 9) < 0.4) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.06)";
        ctx.fillRect(
          0,
          hash01(gframe * 29 + 1) * h,
          w,
          2 + hash01(gframe * 31 + 2) * 15,
        );
      }
      ctx.restore();
    }
  },
};
