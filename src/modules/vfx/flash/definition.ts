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
    // Fully scrub-stable: the flash is a pure function of the frame index.
    // A trigger stores its frame + peak; brightness decays linearly from
    // there, so seeking anywhere (back or forth) renders the exact frame.
    const frame = frameOf(time);
    const t0 = typeof state.t0 === "number" ? state.t0 : -1e9;
    const peak = typeof state.peak === "number" ? state.peak : 0;
    const coolUntil = typeof state.coolUntil === "number" ? state.coolUntil : 0;
    const age = frame - t0;
    const resting = age < 0 || peak - 0.04 * age <= 0;

    const frequency =
      typeof settings.frequency === "number" ? settings.frequency : 0.5;
    if (settings.audioReactive) {
      const bass = getAudioLevel("bass");
      const threshold = 0.85 - frequency * 0.35;
      if (bass > threshold && resting && frame >= coolUntil) {
        state.t0 = frame;
        state.peak = 0.2 + hash01(frame * 104729 + 7) * 0.3;
        state.coolUntil = frame + 30;
      }
    } else if (
      // Deterministic trigger: the same frame always flashes. Rate matches
      // ~60fps playback of the old random check (0.01 * frequency / frame).
      hash01(frame * 7919 + 13) < 0.01 * frequency &&
      resting
    ) {
      state.t0 = frame;
      state.peak = 0.2 + hash01(frame * 104729 + 7) * 0.3;
    }

    const ft0 = typeof state.t0 === "number" ? state.t0 : -1e9;
    const fpeak = typeof state.peak === "number" ? state.peak : 0;
    const fage = frame - ft0;
    const brightness = fage < 0 ? 0 : Math.max(0, fpeak - 0.04 * fage);
    if (brightness > 0) {
      ctx.save();
      const master = finiteSetting(settings, "opacity", 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness * master})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};
