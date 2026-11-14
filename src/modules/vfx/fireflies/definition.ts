import { getAudioLevel } from "../../audio/audio-engine";
import { hexToRGB } from "../../../shared/lib/format";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { clipSeed, effectClock, mulberry32 } from "../_core/prng";

// Wandering firefly. Stateless: each fly follows a seeded two-sine wander
// path (smooth, never teleports) driven by the clip clock — same time always
// renders the same frame. The glow uses a cheap halo fill instead of
// shadowBlur.
interface FlyParams {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
  radius: number;
  opacity: number;
  pulseOffset: number;
}

function makeFly(seed: number, index: number): FlyParams {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return {
    cx: rng(),
    cy: rng(),
    ax: 20 + rng() * 60,
    ay: 20 + rng() * 60,
    wx: 0.1 + rng() * 0.4,
    wy: 0.1 + rng() * 0.4,
    px: rng() * Math.PI * 2,
    py: rng() * Math.PI * 2,
    radius: 1.5 + rng() * 2.5,
    opacity: 0.2 + rng() * 0.6,
    pulseOffset: rng() * Math.PI * 2,
  };
}

function fliesFor(
  state: Record<string, unknown>,
  seed: number,
  intensity: number,
): FlyParams[] {
  let list = state.params as FlyParams[] | undefined;
  if (!list || state.paramsSeed !== seed) {
    list = [];
    state.params = list;
    state.paramsSeed = seed;
  }
  while (list.length < intensity) list.push(makeFly(seed, list.length));
  if (list.length > intensity) list.length = intensity;
  return list;
}

export const firefliesVfx: VfxDefinition = {
  type: "fireflies",
  name: "Fireflies",
  icon: "icon-[ri--bug-line]",
  defaultSettings: {
    intensity: 50,
    speed: 1,
    size: 1,
    color: "#facc15",
    opacity: 1,
    audioReactive: false,
  },
  schema: [
    {
      key: "intensity",
      label: "Intensity",
      kind: "slider",
      min: 0,
      max: 200,
      step: 5,
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
    { key: "color", label: "Color", kind: "color" },
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
        400,
        Math.floor(
          typeof settings.intensity === "number" ? settings.intensity : 50,
        ),
      ),
    );
    const seed = clipSeed(state, settings);
    const flies = fliesFor(state, seed, intensity);
    const audioReactive = settings.audioReactive === true;
    const audioLevel = audioReactive ? getAudioLevel("volume") : 0;
    const clock = effectClock(state, time, false);
    const speedMult = finiteSetting(settings, "speed", 1.0);
    const sizeMult = finiteSetting(settings, "size", 1.0);
    const master = finiteSetting(settings, "opacity", 1);
    if (master <= 0) return;
    const color =
      typeof settings.color === "string" ? settings.color : "#facc15";
    const [cr, cg, cb] = hexToRGB(color);
    const R = Math.round(cr * 255);
    const G = Math.round(cg * 255);
    const B = Math.round(cb * 255);
    const ampGain = speedMult * (audioReactive ? 1.0 + audioLevel * 2.5 : 1.0);
    const sizeGain = sizeMult * (audioReactive ? 0.8 + audioLevel * 1.0 : 1.0);
    const alphaGain = master * (audioReactive ? 0.4 + audioLevel * 0.6 : 1.0);
    const t = Number.isFinite(time) ? Math.max(0, time) : 0;
    const tau = Math.PI * 2;
    const spanX = w + 20;
    const spanY = h + 20;
    ctx.save();
    for (const f of flies) {
      const x =
        ((((f.cx * w +
          (f.ax * Math.sin(f.wx * speedMult * clock + f.px) +
            f.ax * 0.5 * Math.sin(f.wy * speedMult * clock + f.py)) *
            ampGain) %
          spanX) +
          spanX) %
          spanX) -
        10;
      const y =
        ((((f.cy * h +
          (f.ay * Math.sin(f.wy * speedMult * clock + f.py) +
            f.ay * 0.5 * Math.sin(f.wx * speedMult * clock + f.px)) *
            ampGain) %
          spanY) +
          spanY) %
          spanY) -
        10;
      const pulse = Math.sin(t * 3 + f.pulseOffset) * 0.2 + 0.8;
      const r = f.radius * sizeGain * pulse;
      const o = Math.min(1.0, f.opacity * pulse * alphaGain);
      if (o <= 0 || r <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, tau);
      ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${o * 0.25})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, tau);
      ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${o})`;
      ctx.fill();
    }
    ctx.restore();
  },
};
