import { getAudioLevel } from "../../audio/audio-engine";
import { hexToRGB } from "../../../shared/lib/format";
import type { VfxDefinition } from "../_core/types";
import { finiteSetting } from "../_core/base-particle";
import { clipSeed, effectClock, mulberry32 } from "../_core/prng";

// Firework volleys with ascending rockets. Stateless: parameters derive from
// (clipSeed, index), each rocket's origin/theme from (clipSeed, burstIndex,
// slot), and every position from the clip clock — same time always renders
// the same frame.
// Each cycle a volley of rockets rises from the bottom edge, then every shell
// bursts into streaking sparks (line trail + glowing head) that droop under
// flicker out. Additive blending makes overlapping sparks glow on dark scenes.
interface SparkParams {
  angle: number;
  power: number;
  life: number;
  radius: number;
  /** 0..1 shade slot, mapped to the burst theme at draw time. */
  shade: number;
  flicker: number;
}

const THEMES: Record<string, string[]> = {
  gold: ["#fffbeb", "#fde68a", "#fbbf24", "#f59e0b"],
  crimson: ["#fecdd3", "#fca5a5", "#ef4444", "#dc2626"],
  azure: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"],
  emerald: ["#d1fae5", "#6ee7b7", "#10b981", "#047857"],
  violet: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9"],
  rose: ["#fce7f3", "#f9a8d4", "#ec4899", "#be185d"],
};

const THEME_NAMES = Object.keys(THEMES);
const PALETTE_OPTIONS = ["mixed", ...THEME_NAMES];

/** Full burst cycle in effect-seconds (rocket fuse + spark flight). */
const BURST_PERIOD = 3.0;
/** Rocket ascent time within each cycle. */
const FUSE_TIME = 0.8;
/** Spark trail length in effect-seconds (pos(age) - pos(age - TRAIL_DT)). */
const TRAIL_DT = 0.07;
/** Max simultaneous rockets per volley (slider cap). */
const MAX_ROCKETS = 5;
/** Rockets per volley for old clips that stored `rockets: true`. */
const DEFAULT_ROCKETS = 2;
/** Downward gravity in px/effect-second^2 for sparks. */
const GRAVITY = 220;
/** Radial drag coefficient (exponential falloff of launch velocity). */
const DRAG = 1.5;

function makeSpark(seed: number, index: number): SparkParams {
  const rng = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return {
    angle: rng() * Math.PI * 2,
    power: 160 + rng() * 380,
    life: 1.0 + rng() * 1.0,
    radius: 1.2 + rng() * 1.8,
    shade: rng(),
    flicker: rng() * Math.PI * 2,
  };
}

function sparksFor(
  state: Record<string, unknown>,
  seed: number,
  intensity: number,
): SparkParams[] {
  let list = state.params as SparkParams[] | undefined;
  if (!list || state.paramsSeed !== seed) {
    list = [];
    state.params = list;
    state.paramsSeed = seed;
  }
  while (list.length < intensity) list.push(makeSpark(seed, list.length));
  if (list.length > intensity) list.length = intensity;
  return list;
}

/** Deterministic burst rng — same seed + burst index, same origin + theme. */
function burstRng(seed: number, burst: number): () => number {
  return mulberry32((seed ^ Math.imul(burst + 1, 0x9e3779b1)) >>> 0);
}

export const fireworksVfx: VfxDefinition = {
  type: "fireworks",
  name: "Fireworks",
  icon: "icon-[ri--rocket-line]",
  defaultSettings: {
    intensity: 150,
    speed: 1,
    size: 1,
    opacity: 1,
    palette: "mixed",
    rockets: true,
    rocketCount: 2,
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
    {
      key: "opacity",
      label: "Opacity",
      kind: "slider",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: "rockets", label: "Rockets", kind: "toggle" },
    {
      key: "rocketCount",
      label: "Rocket count",
      kind: "slider",
      min: 1,
      max: 5,
      step: 1,
    },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, time, state }) {
    const intensity = Math.max(
      0,
      Math.min(
        600,
        Math.floor(
          typeof settings.intensity === "number" ? settings.intensity : 150,
        ),
      ),
    );
    if (intensity === 0) return;
    const seed = clipSeed(state, settings);
    const sparks = sparksFor(state, seed, intensity);
    const palette =
      typeof settings.palette === "string" &&
      PALETTE_OPTIONS.includes(settings.palette)
        ? settings.palette
        : "mixed";
    // Rocket visibility (toggle) + volley size. Legacy clips stored the
    // count directly in `rockets` (number) or a plain toggle (boolean).
    const showRockets = settings.rockets !== false && settings.rockets !== 0;
    const rawCount =
      typeof settings.rocketCount === "number" &&
      Number.isFinite(settings.rocketCount)
        ? Math.floor(settings.rocketCount)
        : typeof settings.rockets === "number" &&
            Number.isFinite(settings.rockets)
          ? Math.floor(settings.rockets)
          : DEFAULT_ROCKETS;
    const rocketCount = Math.max(1, Math.min(MAX_ROCKETS, rawCount));
    const audioReactive = settings.audioReactive === true;
    const audioLevel = audioReactive ? getAudioLevel("volume") : 0;
    const clock = effectClock(
      state,
      time,
      audioReactive,
      0.6 + audioLevel * 1.4,
    );
    const speedMult = finiteSetting(settings, "speed", 1.0);
    const sizeMult = finiteSetting(settings, "size", 1.0);
    const opacityMult =
      finiteSetting(settings, "opacity", 1.0) *
      (audioReactive ? 0.5 + audioLevel * 0.5 : 1.0);
    if (opacityMult <= 0 || sizeMult <= 0) return;

    const t = clock * speedMult;
    const burst = Math.floor(t / BURST_PERIOD);
    const bt = t - burst * BURST_PERIOD;
    // One deterministic origin + theme per rocket slot: same seed, burst,
    // and slot always give the same volley. Sparks are dealt round-robin
    // across the slots, so every rocket gets an equal share.
    const volley: { ox: number; oy: number; lx: number; colors: string[] }[] =
      [];
    for (let k = 0; k < rocketCount; k++) {
      const r = burstRng(seed, burst * MAX_ROCKETS + k);
      const ox = w * (0.15 + r() * 0.7);
      const oy = h * (0.12 + r() * 0.35);
      const themeName =
        palette === "mixed"
          ? THEME_NAMES[Math.floor(r() * THEME_NAMES.length)]
          : palette;
      volley.push({
        ox,
        oy,
        lx: ox + (r() - 0.5) * w * 0.12,
        colors: THEMES[themeName] ?? THEMES.gold,
      });
    }
    const colorOf = (
      colors: string[],
      shade: number,
    ): [number, number, number] => {
      const hex =
        colors[Math.min(colors.length - 1, Math.floor(shade * colors.length))];
      const [r, g, b] = hexToRGB(hex);
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Ascending rockets: bright head with a fading trail below it.
    // The toggle only hides the ascent — the bursts still go off.
    if (showRockets && bt < FUSE_TIME) {
      const q = bt / FUSE_TIME;
      const eased = q * q * (3 - 2 * q);
      for (const v of volley) {
        const hx = v.lx + (v.ox - v.lx) * eased;
        const hy = h + 20 - (h + 20 - v.oy) * eased;
        const [R, G, B] = colorOf(v.colors, 0);
        ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${0.35 * opacityMult})`;
        ctx.lineWidth = Math.max(1, 1.5 * sizeMult);
        ctx.beginPath();
        ctx.moveTo(hx, hy + 70 * sizeMult);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx, hy, Math.max(1, 3 * sizeMult), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * opacityMult})`;
        ctx.fill();
      }
    }

    // Burst sparks: streak trail + flickering glowing head.
    if (bt >= FUSE_TIME) {
      const age = bt - FUSE_TIME;
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (age > s.life) continue;
        const v = volley[i % volley.length];
        const prog = age / s.life;
        const dist = (s.power * (1 - Math.exp(-DRAG * age))) / DRAG;
        const drop = 0.5 * GRAVITY * age * age;
        const dx = Math.cos(s.angle);
        const dy = Math.sin(s.angle);
        const x = v.ox + dx * dist;
        const y = v.oy + dy * dist + drop;
        const prevAge = Math.max(0, age - TRAIL_DT);
        const prevDist = (s.power * (1 - Math.exp(-DRAG * prevAge))) / DRAG;
        const prevDrop = 0.5 * GRAVITY * prevAge * prevAge;
        const px = v.ox + dx * prevDist;
        const py = v.oy + dy * prevDist + prevDrop;
        const fade = 1 - prog;
        const flicker = 0.7 + 0.3 * Math.sin(t * 25 + s.flicker);
        const [R, G, B] = colorOf(v.colors, s.shade);
        ctx.strokeStyle = `rgba(${R}, ${G}, ${B}, ${fade * opacityMult})`;
        ctx.lineWidth = Math.max(0.75, 1.6 * sizeMult * (1 - prog * 0.5));
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        const r = Math.max(0.5, s.radius * sizeMult * (1 - prog * 0.4));
        const headAlpha = Math.min(1, fade * flicker * opacityMult);
        if (headAlpha <= 0) continue;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${R}, ${G}, ${B}, ${headAlpha * 0.25})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`;
        ctx.fill();
      }
    }

    ctx.restore();
  },
};
