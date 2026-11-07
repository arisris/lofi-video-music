import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";

// Adapted from src_old/lib/vfx/flash.ts (state moved from `clip` to `state`).
export const flashVfx: VfxDefinition = {
  type: "flash",
  name: "Lightning Flash",
  defaultSettings: { frequency: 0.5, audioReactive: false },
  schema: [
    { key: "frequency", label: "Frequency", kind: "slider", min: 0, max: 1, step: 0.05 },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, state }) {
    if (typeof state.opacity !== "number") state.opacity = 0;
    if (typeof state.cooldown !== "number") state.cooldown = 0;
    if ((state.cooldown as number) > 0) state.cooldown = (state.cooldown as number) - 1;

    if (settings.audioReactive) {
      const bass = getAudioLevel("bass");
      const threshold = 0.85 - (typeof settings.frequency === "number" ? settings.frequency : 0.5) * 0.35;
      if (bass > threshold && (state.opacity as number) <= 0 && state.cooldown === 0) {
        state.opacity = 0.2 + Math.random() * 0.3;
        state.cooldown = 30;
      }
    } else if (Math.random() < 0.002 * (typeof settings.frequency === "number" ? settings.frequency : 0.5) * 5 && (state.opacity as number) <= 0) {
      state.opacity = 0.2 + Math.random() * 0.3;
    }

    if ((state.opacity as number) > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${state.opacity as number})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      state.opacity = (state.opacity as number) - 0.04;
    }
  },
};
