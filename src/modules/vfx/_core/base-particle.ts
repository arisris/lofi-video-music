/**
 * Minimal particle base — subclasses re-seed position/state via `reset()`.
 *
 * Gotcha: the base constructor calls `reset()`, but a subclass's class-field
 * initializers run *after* `super()` returns and would overwrite everything
 * `reset()` randomized, leaving every particle identical. Subclasses that
 * randomize state must therefore re-apply it at the end of their constructor:
 *
 *   constructor(w: number, h: number) {
 *     super(w, h);
 *     this.reset(); // runs after the field initializers above
 *   }
 */
export class BaseParticle {
  canvasWidth: number;
  canvasHeight: number;
  x: number = 0;
  y: number = 0;
  /** Clock (in seconds) of the previous update, used to derive a clamped dt. */
  lastTime: number | undefined;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = 0;
    this.y = 0;
    this.reset();
  }

  reset() {
    // Intended to be overridden by child classes
  }

  /**
   * Seconds elapsed since the previous update. Particles advance per second
   * rather than per frame, so the motion looks identical at 30/60/120 fps.
   * Clamped so a stalled tab or a clip coming back into view never makes a
   * particle teleport across the canvas.
   */
  protected step(time?: number): number {
    if (time === undefined) return 1 / 60;
    const dt = this.lastTime === undefined ? 1 / 60 : time - this.lastTime;
    this.lastTime = time;
    return Math.min(Math.max(dt, 0), 1 / 20);
  }
}

/** Numeric setting with a fallback — corrupt/NaN project values must never
 * poison particle state permanently (NaN propagates and the guard
 * `y > h` never fires again). */
export function finiteSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
