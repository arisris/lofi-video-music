import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { clipSeed, effectClock, mulberry32 } from "../_core/prng";

// Smoke puff. Stateless: each puff cycles with its own period, its age a pure
// function of the clip clock — same time always renders the same frame.
interface SmokeParams {
  x0: number;
  yOff: number;
  size: number;
  speed: number;
  maxOpacity: number;
  maxLife: number;
  growth: number;
  drift: number;
  phase: number;
}

function makeSmoke(seed: number, index: number): SmokeParams {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const maxLife = 200 + Math.floor(rng() * 300);
  return {
    x0: rng(),
    yOff: 50 + rng() * 100,
    size: 30 + rng() * 50,
    speed: 0.5 + rng() * 1.0,
    maxOpacity: 0.03 + rng() * 0.07,
    maxLife,
    growth: 0.2 + rng() * 0.4,
    drift: (rng() - 0.5) * 0.8,
    phase: rng() * maxLife,
  };
}

function puffsFor(
  state: Record<string, unknown>,
  seed: number,
  intensity: number,
): SmokeParams[] {
  let list = state.params as SmokeParams[] | undefined;
  if (!list || state.paramsSeed !== seed) {
    list = [];
    state.params = list;
    state.paramsSeed = seed;
  }
  while (list.length < intensity) list.push(makeSmoke(seed, list.length));
  if (list.length > intensity) list.length = intensity;
  return list;
}

export const smokeVfx: VfxDefinition = {
  type: "smoke",
  name: "Smoke",
  icon: "icon-[ri--mist-line]",
  defaultSettings: { intensity: 40, opacity: 1, audioReactive: false },
  schema: [
    {
      key: "intensity",
      label: "Intensity",
      kind: "slider",
      min: 0,
      max: 150,
      step: 5,
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
    const intensity = Math.max(
      0,
      Math.min(
        300,
        Math.floor(
          typeof settings.intensity === "number" ? settings.intensity : 40,
        ),
      ),
    );
    const seed = clipSeed(state, settings);
    const puffs = puffsFor(state, seed, intensity);
    const audioReactive = settings.audioReactive === true;
    const audioLevel = audioReactive ? getAudioLevel("bass") : 0;
    const frames = effectClock(state, time, false) * 60;
    const master = finiteSetting(settings, "opacity", 1);
    if (master <= 0) return;
    const riseGain = 1 + audioLevel * 1.5;
    const sizeGain = 1 + audioLevel * 2.0;
    const alphaGain = 1 + audioLevel * 1.5;
    const tau = Math.PI * 2;
    for (const p of puffs) {
      const age = (p.phase + frames) % p.maxLife;
      let env: number;
      if (age < 50) env = (age / 50) * p.maxOpacity;
      else if (age > p.maxLife - 100)
        env = ((p.maxLife - age) / 100) * p.maxOpacity;
      else env = p.maxOpacity;
      const alpha = Math.min(1.0, env * alphaGain) * master;
      if (alpha <= 0) continue;
      const x = p.x0 * w + p.drift * age + Math.sin(age * 0.02) * 4.5;
      const y = h + p.yOff - p.speed * riseGain * age;
      const size = p.size + p.growth * sizeGain * age;
      if (y < -size) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, "rgba(200, 210, 220, 1)");
      grad.addColorStop(1, "rgba(200, 210, 220, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, tau);
      ctx.fill();
      ctx.restore();
    }
  },
};
