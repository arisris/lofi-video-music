import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { advanceClipClock, clipSeed, mulberry32 } from "../_core/prng";

// Falling rain-drop. Stateless: every parameter derives from (clipSeed,
// index), every position from the clip clock — the same time always renders
// the same frame (pause/scrub/export stable). Changing intensity keeps the
// existing drops' parameters, so the slider no longer pops.
interface DropParams {
  x0: number;
  y0: number;
  length: number;
  speed: number;
  opacity: number;
  slant: number;
}

function makeDrop(seed: number, index: number): DropParams {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return {
    x0: rng(),
    y0: rng(),
    length: 10 + rng() * 22,
    speed: 600 + rng() * 500,
    opacity: 0.12 + rng() * 0.38,
    slant: (rng() - 0.5) * 70,
  };
}

function dropsFor(
  state: Record<string, unknown>,
  seed: number,
  intensity: number,
): DropParams[] {
  let list = state.params as DropParams[] | undefined;
  if (!list || state.paramsSeed !== seed) {
    list = [];
    state.params = list;
    state.paramsSeed = seed;
  }
  while (list.length < intensity) list.push(makeDrop(seed, list.length));
  if (list.length > intensity) list.length = intensity;
  return list;
}

export const rainVfx: VfxDefinition = {
  type: "rain",
  name: "Rain",
  icon: "icon-[ri--rainy-line]",
  defaultSettings: {
    intensity: 200,
    speed: 1,
    size: 1,
    opacity: 1,
    audioReactive: false,
  },
  schema: [
    {
      key: "intensity",
      label: "Intensity",
      kind: "slider",
      min: 0,
      max: 600,
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
        1000,
        Math.floor(
          typeof settings.intensity === "number" ? settings.intensity : 200,
        ),
      ),
    );
    const seed = clipSeed(state);
    const drops = dropsFor(state, seed, intensity);
    const audioReactive = settings.audioReactive === true;
    const audioLevel = audioReactive ? getAudioLevel("volume") : 0;
    // Beat-reactive fall speed warps the clock, so scrubbing/pause stay
    // stable (positions are still a pure function of the clock).
    const clock = advanceClipClock(
      state,
      time,
      audioReactive ? 0.4 + audioLevel * 1.6 : 1,
    );
    const speedMult = finiteSetting(settings, "speed", 1.0);
    const sizeMult = finiteSetting(settings, "size", 1.0);
    const opacityMult =
      finiteSetting(settings, "opacity", 1.0) *
      (audioReactive ? 0.3 + audioLevel * 0.7 : 1.0);
    const visible = audioReactive
      ? Math.floor(drops.length * (0.25 + audioLevel * 0.75))
      : drops.length;
    const span = h + 120;
    const lineWidth = Math.max(0.5, sizeMult);
    // No save/restore per drop: only strokeStyle/lineWidth change, and a
    // fresh beginPath each iteration keeps strokes independent.
    for (let i = 0; i < visible; i++) {
      const d = drops[i];
      const y = -120 + ((d.y0 * span + clock * d.speed * speedMult) % span);
      const x = (((d.x0 * w + d.slant * clock) % w) + w) % w;
      const length = d.length * sizeMult;
      const tiltX = (d.slant / Math.max(d.speed, 1)) * length;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - tiltX, y - length);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1.0, d.opacity * opacityMult)})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  },
};
