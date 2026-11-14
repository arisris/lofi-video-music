import { getAudioLevel } from "../../audio/audio-engine";
import { hexToRGB } from "../../../shared/lib/format";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { clipSeed, effectClock, mulberry32 } from "../_core/prng";

// Falling confetti pieces. Stateless: parameters derive from (clipSeed,
// index), positions from the clip clock — same time always renders the same
// frame. Each piece tumbles (rotation + flutter scale) as it falls with a
// horizontal sway. Palette/shape presets come from settings and join the
// params cache key, so switching presets rebuilds the pieces deterministically.
interface ConfettiParams {
  x0: number;
  y0: number;
  fallSpeed: number;
  width: number;
  height: number;
  color: string;
  round: boolean;
  spinSpeed: number;
  spinOffset: number;
  swaySpeed: number;
  swayAmount: number;
  swayOffset: number;
  opacity: number;
  /** Radial burst direction (explosion) and cannon spread basis (parade). */
  angle: number;
  /** Launch speed in px/effect-second for burst motions. */
  power: number;
  /** Staggered restart offset for the parade cycle. */
  delay: number;
  /** Visible lifetime in effect-seconds for burst motions. */
  life: number;
  /** Parade cannon side: true = right corner firing left. */
  side: boolean;
}

const PALETTES: Record<string, string[]> = {
  rainbow: [
    "#f43f5e",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#a855f7",
    "#facc15",
    "#ec4899",
    "#ffffff",
  ],
  pastel: [
    "#fbcfe8",
    "#fde68a",
    "#bbf7d0",
    "#bfdbfe",
    "#ddd6fe",
    "#fecdd3",
    "#ffffff",
  ],
  gold: ["#facc15", "#f59e0b", "#fde68a", "#fffbeb", "#eab308", "#b45309"],
  ocean: ["#38bdf8", "#22d3ee", "#818cf8", "#2dd4bf", "#e0f2fe", "#0ea5e9"],
  mono: ["#ffffff"],
};

const PALETTE_OPTIONS = Object.keys(PALETTES);
const SHAPE_OPTIONS = ["mixed", "rectangle", "circle"];
const MOTION_OPTIONS = ["fall", "float", "explosion", "parade", "party"];

/** Seconds between synchronized explosion bursts (effect-time). */
const BURST_PERIOD = 2.8;
/** Parade cannon stream cycle (effect-time); must match the delay spread. */
const PARADE_CYCLE = 2.6;
/** Party popper cycle (effect-time); must exceed the delay spread. */
const PARTY_CYCLE = 3.2;
/** Fixed party-popper positions along the bottom edge (fractions of width). */
const POPPER_XS = [0.08, 0.29, 0.5, 0.71, 0.92];
/** Downward gravity in px/effect-second^2 for burst motions. */
const GRAVITY = 900;

/** Deterministic burst origin — same seed + burst index, same spot. */
function burstOrigin(
  seed: number,
  burst: number,
  w: number,
  h: number,
): [number, number] {
  const rng = mulberry32((seed ^ Math.imul(burst + 1, 0x9e3779b1)) >>> 0);
  return [w * (0.25 + rng() * 0.5), h * (0.3 + rng() * 0.4)];
}

function makeConfetti(
  seed: number,
  index: number,
  colors: string[],
): ConfettiParams {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return {
    x0: rng(),
    y0: rng(),
    fallSpeed: 90 + rng() * 160,
    width: 5 + rng() * 6,
    height: 8 + rng() * 8,
    color: colors[Math.floor(rng() * colors.length)],
    round: rng() < 0.35,
    spinSpeed: 2 + rng() * 5,
    spinOffset: rng() * Math.PI * 2,
    swaySpeed: 0.6 + rng() * 1.6,
    swayAmount: 10 + rng() * 30,
    swayOffset: rng() * Math.PI * 2,
    opacity: 0.6 + rng() * 0.4,
    angle: rng() * Math.PI * 2,
    power: 250 + rng() * 450,
    delay: rng() * PARADE_CYCLE,
    life: 0.9 + rng() * 1.0,
    side: rng() < 0.5,
  };
}

function piecesFor(
  state: Record<string, unknown>,
  seed: number,
  intensity: number,
  paramsKey: string,
  colors: string[],
): ConfettiParams[] {
  let list = state.params as ConfettiParams[] | undefined;
  if (!list || state.paramsKey !== paramsKey) {
    list = [];
    state.params = list;
    state.paramsKey = paramsKey;
  }
  while (list.length < intensity)
    list.push(makeConfetti(seed, list.length, colors));
  if (list.length > intensity) list.length = intensity;
  return list;
}

export const confettiVfx: VfxDefinition = {
  type: "confetti",
  name: "Confetti",
  icon: "icon-[ri--sparkling-line]",
  defaultSettings: {
    intensity: 120,
    speed: 1,
    size: 1,
    opacity: 1,
    palette: "rainbow",
    shape: "mixed",
    motion: "fall",
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
      key: "palette",
      label: "Palette",
      kind: "select",
      options: PALETTE_OPTIONS,
    },
    { key: "shape", label: "Shape", kind: "select", options: SHAPE_OPTIONS },
    { key: "motion", label: "Motion", kind: "select", options: MOTION_OPTIONS },
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
        600,
        Math.floor(
          typeof settings.intensity === "number" ? settings.intensity : 120,
        ),
      ),
    );
    if (intensity === 0) return;
    const seed = clipSeed(state, settings);
    const palette =
      typeof settings.palette === "string" &&
      Object.hasOwn(PALETTES, settings.palette)
        ? settings.palette
        : "rainbow";
    const shape =
      typeof settings.shape === "string" && SHAPE_OPTIONS.includes(settings.shape)
        ? settings.shape
        : "mixed";
    const motion =
      typeof settings.motion === "string" &&
      MOTION_OPTIONS.includes(settings.motion)
        ? settings.motion
        : "fall";
    const colors = PALETTES[palette];
    const pieces = piecesFor(
      state,
      seed,
      intensity,
      `${seed}:${palette}`,
      colors,
    );
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
      finiteSetting(settings, "opacity", 1.0) *
      (audioReactive ? 0.4 + audioLevel * 0.6 : 1.0);
    if (opacityMult <= 0 || sizeMult <= 0) return;
    const swayGain = audioReactive ? 1.0 + audioLevel * 1.5 : 1.0;
    const span = h + 80;
    const tau = Math.PI * 2;

    /** Paint one piece centered at (x, y), rotated by rot. */
    const paint = (
      p: ConfettiParams,
      x: number,
      y: number,
      rot: number,
      sizeScale: number,
      alpha: number,
    ) => {
      const o = Math.min(1.0, p.opacity * alpha);
      if (o <= 0) return;
      // Flutter: horizontal squash simulates the piece turning edge-on.
      const squash = Math.abs(Math.cos(rot * 0.7));
      const pw = Math.max(
        0.5,
        p.width * sizeMult * sizeScale * (0.25 + 0.75 * squash),
      );
      const ph = p.height * sizeMult * sizeScale;
      const [cr, cg, cb] = hexToRGB(p.color);
      const R = Math.round(cr * 255);
      const G = Math.round(cg * 255);
      const B = Math.round(cb * 255);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${o})`;
      const round = shape === "circle" || (shape === "mixed" && p.round);
      if (round) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, ((pw + ph) / 4) * (0.25 + 0.75 * squash)), 0, tau);
        ctx.fill();
      } else {
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      }
      ctx.restore();
    };

    if (motion === "explosion") {
      // Synchronized radial bursts from a deterministic spot: every
      // BURST_PERIOD all pieces launch together, arc under gravity, and fade.
      const t = clock * speedMult;
      const burst = Math.floor(t / BURST_PERIOD);
      const age = t - burst * BURST_PERIOD;
      const [ox, oy] = burstOrigin(seed, burst, w, h);
      for (const p of pieces) {
        if (age > p.life) continue;
        const prog = age / p.life;
        const x = ox + Math.cos(p.angle) * p.power * age;
        const y = oy + Math.sin(p.angle) * p.power * age + 0.5 * GRAVITY * age * age;
        const rot = p.spinOffset + t * p.spinSpeed * 2;
        paint(p, x, y, rot, 1 - 0.3 * prog, opacityMult * (1 - prog));
      }
      return;
    }

    if (motion === "parade") {
      // Party cannons in the bottom corners fire inward-up streams. Each
      // piece loops on its own delay so the streams never stop.
      const t = clock * speedMult;
      for (const p of pieces) {
        const age = (t + p.delay) % PARADE_CYCLE;
        if (age > p.life) continue;
        const dir = p.side ? -1 : 1;
        const ox = p.side ? w - 30 : 30;
        const oy = h - 10;
        const vx = dir * (120 + (p.power - 250) * 0.9);
        const vy = -(380 + (p.power - 250) * 1.2);
        const wobble =
          Math.sin(t * p.swaySpeed + p.swayOffset) * p.swayAmount * 0.4;
        const x = ox + vx * age + wobble * age;
        const y = oy + vy * age + 0.5 * GRAVITY * age * age;
        const fade = Math.min(1, (p.life - age) / (0.4 * p.life));
        const rot = p.spinOffset + t * p.spinSpeed * 1.5;
        paint(p, x, y, rot, 1, opacityMult * fade);
      }
      return;
    }

    if (motion === "party") {
      // Five party poppers along the bottom edge fire upward cones on
      // staggered loops, so bursts go off continuously across the stage.
      const t = clock * speedMult;
      for (const p of pieces) {
        const age = (t + p.delay) % PARTY_CYCLE;
        if (age > p.life) continue;
        const k = Math.min(
          POPPER_XS.length - 1,
          Math.floor(p.x0 * POPPER_XS.length),
        );
        const ox = w * POPPER_XS[k];
        const oy = h - 10;
        const cone = -Math.PI / 2 + (p.y0 - 0.5) * 1.4;
        const wobble =
          Math.sin(t * p.swaySpeed + p.swayOffset) * p.swayAmount * 0.3;
        const x = ox + Math.cos(cone) * p.power * age + wobble * age;
        const y = oy + Math.sin(cone) * p.power * age + 0.5 * GRAVITY * age * age;
        const fade = Math.min(1, (p.life - age) / (0.4 * p.life));
        const rot = p.spinOffset + t * p.spinSpeed * 2;
        paint(p, x, y, rot, 1, opacityMult * fade);
      }
      return;
    }

    if (motion === "float") {
      // Gentle rising pieces with a wide sway and slow tumble.
      for (const p of pieces) {
        const y =
          h + 70 - ((p.y0 * span + clock * p.fallSpeed * 0.45 * speedMult) % span);
        const sway =
          Math.sin(clock * p.swaySpeed + p.swayOffset) *
          p.swayAmount *
          1.5 *
          swayGain;
        const x = (((p.x0 * w + sway) % w) + w) % w;
        const angle = p.spinOffset + clock * p.spinSpeed * 0.5 * speedMult;
        paint(p, x, y, angle, 1, opacityMult);
      }
      return;
    }

    // fall: steady rain of tumbling pieces.
    for (const p of pieces) {
      const y = -70 + ((p.y0 * span + clock * p.fallSpeed * speedMult) % span);
      const sway =
        Math.sin(clock * p.swaySpeed + p.swayOffset) * p.swayAmount * swayGain;
      const x = (((p.x0 * w + sway) % w) + w) % w;
      const angle = p.spinOffset + clock * p.spinSpeed * speedMult;
      paint(p, x, y, angle, 1, opacityMult);
    }
  },
};
