export class BaseParticle {
  constructor(canvasWidth, canvasHeight) {
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
