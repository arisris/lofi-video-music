/** Minimal particle base — subclasses re-seed position/state via `reset()`. */
export class BaseParticle {
  canvasWidth: number;
  canvasHeight: number;
  x: number = 0;
  y: number = 0;

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
}
