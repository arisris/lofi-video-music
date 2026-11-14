// Deterministic randomness for VFX (scrub/export stability).
//
// Particle motion must be a pure function of clip time so pause, scrub, and
// headless export render the same frame for the same time. Math.random() in a
// per-frame update breaks that; these helpers don't. Per-clip variety comes
// from a factory-persisted seed in clip settings (stable across sessions),
// per-particle variety from the particle index.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-clip seed — allocated once, then reused every frame. */
export function clipSeed(
  state: Record<string, unknown>,
  settings?: Record<string, unknown>,
): number {
  // Factory-persisted seed first: same project, same arrangement, every
  // session and every export. Old clips fall back to a session seed.
  const persisted = settings?.seed;
  if (typeof persisted === "number" && Number.isFinite(persisted)) {
    return persisted;
  }
  if (typeof state.seed !== "number") {
    state.seed = (Math.random() * 0x7fffffff) | 0;
  }
  return state.seed as number;
}

/**
 * Deterministic 0..1 from an integer (frame index, particle index, ...).
 * Integer hash — no Math.random, same input always gives same output.
 */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 60fps frame index for a clip-local time (drives rate-based triggers). */
export function frameOf(time: number): number {
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor(time * 60));
}

/**
 * Effect clock for motion positions.
 *
 * Non-reactive effects use clip-local time directly: every seek lands on the
 * exact frame, and the first render is correct even when the user jumps
 * straight into the middle of a clip. Reactive rate-warping (beat-reactive
 * speed) is inherently live, so it keeps an accumulated warped clock —
 * pause freezes it, scrub-back holds it, scrub-forward fast-forwards it.
 */
export function effectClock(
  state: Record<string, unknown>,
  time: number,
  audioReactive: boolean,
  warpRate = 1,
): number {
  if (!audioReactive) {
    return Number.isFinite(time) ? Math.max(0, time) : 0;
  }
  return advanceClipClock(state, time, warpRate);
}

/**
 * Monotonic clip clock (seconds). Advances by the clamped non-negative delta
 * of clip-local time, optionally warped by `rate` (beat-reactive speed).
 * Pause freezes it, scrub-back holds it, scrub-forward fast-forwards it —
 * and positions derived from it are always a pure function of its value.
 */
export function advanceClipClock(
  state: Record<string, unknown>,
  time: number,
  rate = 1,
): number {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  const last = typeof state.lastT === "number" ? state.lastT : t;
  state.lastT = t;
  const dt = Math.min(Math.max(t - last, 0), 0.5);
  const clock = (typeof state.clock === "number" ? state.clock : 0) + dt * rate;
  state.clock = clock;
  return clock;
}
