import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { clipSeed, effectClock, mulberry32 } from "../_core/prng";

// Drifting snowball. Stateless: parameters derive from (clipSeed, index),
// positions from the clip clock — same time always renders the same frame.
// The per-ball glow uses a cheap halo fill instead of shadowBlur (shadow
// rendering at 400 balls killed the frame rate).
interface SnowParams {
  x0: number;
  y0: number;
  radius: number;
  speed: number;
  opacity: number;
  swaySpeed: number;
  swayAmount: number;
  swayOffset: number;
}

function makeSnow(seed: number, index: number): SnowParams {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return {
    x0: rng(),
    y0: rng(),
    radius: 2 + rng() * 4,
    speed: 45 + rng() * 70,
    opacity: 0.3 + rng() * 0.5,
    swaySpeed: 0.4 + rng() * 1.2,
    swayAmount: 4 + rng() * 10,
    swayOffset: rng() * Math.PI * 2,
  };
}

function ballsFor(
  state: Record<string, unknown>,
  seed: number,
  intensity: number,
): SnowParams[] {
  let list = state.params as SnowParams[] | undefined;
  if (!list || state.paramsSeed !== seed) {
    list = [];
    state.params = list;
    state.paramsSeed = seed;
  }
  while (list.length < intensity) list.push(makeSnow(seed, list.length));
  if (list.length > intensity) list.length = intensity;
  return list;
}

export const snowVfx: VfxDefinition = {
  type: "snow",
  name: "Snow",
  icon: "icon-[ri--snowy-line]",
  defaultSettings: {
    intensity: 120,
    speed: 1,
    size: 1,
    opacity: 0.8,
    audioReactive: false,
  },
  schema: [
    {
      key: "intensity",
      label: "Intensity",
      kind: "slider",
      min: 0,
      max: 400,
      step: 10,
    },
    {
      key: "speed",
      label: "Speed",
      kind: "slider",
      min: 0.1,
      max: 3,
      step: 0.1,
    },
    { key: "size", label: "Size", kind: "slider", min: 0.2, max: 3, step: 0.1 },
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
    const intensity = Math.max(
      0,
      Math.min(
        800,
        Math.floor(
          typeof settings.intensity === "number" ? settings.intensity : 120,
        ),
      ),
    );
    const seed = clipSeed(state, settings);
    const balls = ballsFor(state, seed, intensity);
    const audioReactive = settings.audioReactive === true;
    const audioLevel = audioReactive ? getAudioLevel("volume") : 0;
    const clock = effectClock(
      state,
      time,
      audioReactive,
      0.4 + audioLevel * 1.6,
    );
    const speedMult = finiteSetting(settings, "speed", 1.0);
    const sizeMult = finiteSetting(settings, "size", 1.0);
    const opacityMult =
      finiteSetting(settings, "opacity", 0.8) *
      (audioReactive ? 0.5 + audioLevel * 0.5 : 1.0);
    const swayGain = audioReactive ? 1.0 + audioLevel * 2.0 : 1.0;
    const sizeGain = audioReactive ? 0.8 + audioLevel * 0.6 : 1.0;
    const span = h + 80;
    const tau = Math.PI * 2;
    for (const b of balls) {
      const y = -70 + ((b.y0 * span + clock * b.speed * speedMult) % span);
      const sway =
        Math.sin(clock * b.swaySpeed + b.swayOffset) * b.swayAmount * swayGain;
      const x = (((b.x0 * w + sway) % w) + w) % w;
      const r = b.radius * sizeMult * sizeGain;
      const o = Math.min(1.0, b.opacity * opacityMult);
      if (o <= 0 || r <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, tau);
      ctx.fillStyle = `rgba(255, 255, 255, ${o * 0.25})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, tau);
      ctx.fillStyle = `rgba(255, 255, 255, ${o})`;
      ctx.fill();
    }
  },
};
