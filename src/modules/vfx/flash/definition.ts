import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { frameOf, hash01 } from "../_core/prng";

// Lightning flash (per-clip state lives in VfxState).
export const flashVfx: VfxDefinition = {
  type: "flash",
  name: "Lightning Flash",
  icon: "icon-[ri--flashlight-line]",
  defaultSettings: { frequency: 0.5, opacity: 1, audioReactive: false },
  schema: [
    {
      key: "frequency",
      label: "Frequency",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
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
    if (typeof state.opacity !== "number") state.opacity = 0;
    if (typeof state.cooldown !== "number") state.cooldown = 0;
    if (typeof state.lastT !== "number") state.lastT = time;
    // Frame-rate independent decay (k = elapsed 60fps-frames).
    const k = Math.min(Math.max((time - (state.lastT as number)) * 60, 0), 3);
    state.lastT = time;
    if ((state.cooldown as number) > 0)
      state.cooldown = (state.cooldown as number) - k;

    if (settings.audioReactive) {
      const bass = getAudioLevel("bass");
      const threshold =
        0.85 -
        (typeof settings.frequency === "number" ? settings.frequency : 0.5) *
          0.35;
      if (
        bass > threshold &&
        (state.opacity as number) <= 0 &&
        (state.cooldown as number) <= 0
      ) {
        state.opacity = 0.2 + hash01(frameOf(time) * 104729 + 7) * 0.3;
        state.cooldown = 30;
      }
    } else if (
      // Deterministic trigger: the same frame always flashes, so scrub and
      // export are stable. Rate matches ~60fps playback of the old random
      // check (0.002 * frequency * 5 per frame).
      hash01(frameOf(time) * 7919 + 13) <
        0.01 *
          (typeof settings.frequency === "number" ? settings.frequency : 0.5) &&
      (state.opacity as number) <= 0
    ) {
      state.opacity = 0.2 + hash01(frameOf(time) * 104729 + 7) * 0.3;
    }

    if ((state.opacity as number) > 0) {
      ctx.save();
      const master = finiteSetting(settings, "opacity", 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${(state.opacity as number) * master})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      state.opacity = (state.opacity as number) - 0.04 * k;
    }
  },
};
