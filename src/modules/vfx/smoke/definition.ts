import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { BaseParticle } from "../_core/base-particle";

// Smoke puff particle.
class SmokeParticle extends BaseParticle {
  size = 30;
  speed = 1;
  maxOpacity = 0.1;
  opacity = 0;
  life = 0;
  maxLife = 200;
  growth = 0.3;
  drift = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = this.canvasHeight + 50 + Math.random() * 100;
    this.size = 30 + Math.random() * 50;
    this.speed = 0.5 + Math.random() * 1.0;
    this.maxOpacity = 0.03 + Math.random() * 0.07;
    this.opacity = 0;
    this.life = 0;
    this.maxLife = 200 + Math.random() * 300;
    this.growth = 0.2 + Math.random() * 0.4;
    this.drift = (Math.random() - 0.5) * 0.8;
  }

  updateSmoke(w: number, h: number, audioLevel = 0, k = 1) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.life += k;
    this.y -= this.speed * (1 + audioLevel * 1.5) * k;
    this.x +=
      (this.drift +
        Math.sin(this.life * 0.02) * 0.3 +
        (Math.random() - 0.5) * audioLevel * 0.8) *
      k;
    this.size += this.growth * (1 + audioLevel * 2.0) * k;
    if (this.life < 50) this.opacity = (this.life / 50) * this.maxOpacity;
    else if (this.life > this.maxLife - 100)
      this.opacity = ((this.maxLife - this.life) / 100) * this.maxOpacity;
    else this.opacity = this.maxOpacity;
    if (this.life >= this.maxLife || this.y < -this.size) this.reset();
  }

  drawSmoke(ctx: CanvasRenderingContext2D, audioLevel = 0) {
    if (this.opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1.0, this.opacity * (1 + audioLevel * 1.5));
    const grad = ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.size,
    );
    grad.addColorStop(0, "rgba(200, 210, 220, 1)");
    grad.addColorStop(1, "rgba(200, 210, 220, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const smokeVfx: VfxDefinition = {
  type: "smoke",
  name: "Smoke",
  icon: "icon-[ri--mist-line]",
  defaultSettings: { intensity: 40, audioReactive: false },
  schema: [
    {
      key: "intensity",
      label: "Intensity",
      kind: "slider",
      min: 0,
      max: 150,
      step: 5,
    },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, time, state }) {
    const intensity =
      typeof settings.intensity === "number" ? settings.intensity : 40;
    if (
      !state.particles ||
      (state.particles as SmokeParticle[]).length !== intensity ||
      state.w !== w ||
      state.h !== h
    ) {
      const next: SmokeParticle[] = [];
      for (let i = 0; i < intensity; i++) next.push(new SmokeParticle(w, h));
      state.particles = next;
      state.w = w;
      state.h = h;
      state.lastT = time;
    }
    // Frame-rate independent: k = elapsed 60fps-frames (1 at 60fps, 2 at 120fps).
    const lastT = typeof state.lastT === "number" ? state.lastT : time;
    state.lastT = time;
    const k = Math.min(Math.max((time - lastT) * 60, 0), 3);
    const audioLevel = settings.audioReactive ? getAudioLevel("bass") : 0;
    for (const p of state.particles as SmokeParticle[]) {
      p.updateSmoke(w, h, audioLevel, k);
      p.drawSmoke(ctx, audioLevel);
    }
  },
};
