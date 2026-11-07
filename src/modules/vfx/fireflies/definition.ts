import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { BaseParticle } from "../_core/base-particle";

// Adapted verbatim from src_old/lib/vfx/fireflies.ts (Firefly).
class Firefly extends BaseParticle {
  radius = 2;
  speed = 0.5;
  angle = 0;
  angleChange = 0;
  opacity = 0.5;
  pulseSpeed = 0.03;
  pulseOffset = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = Math.random() * this.canvasHeight;
    this.radius = 1.5 + Math.random() * 2.5;
    this.speed = 0.3 + Math.random() * 0.7;
    this.angle = Math.random() * Math.PI * 2;
    this.angleChange = (Math.random() - 0.5) * 0.1;
    this.opacity = 0.2 + Math.random() * 0.6;
    this.pulseSpeed = 0.02 + Math.random() * 0.05;
    this.pulseOffset = Math.random() * Math.PI * 2;
  }

  updateFly(w: number, h: number, settings: Record<string, unknown>, audioLevel = 0) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.angleChange += (Math.random() - 0.5) * 0.02;
    this.angleChange = Math.max(-0.15, Math.min(0.15, this.angleChange));
    this.angle += this.angleChange;
    const speedMultiplier = settings.speed !== undefined ? (settings.speed as number) : 1.0;
    const activeSpeed = this.speed * speedMultiplier * (settings.audioReactive ? 1.0 + audioLevel * 2.5 : 1.0);
    this.x += Math.cos(this.angle) * activeSpeed;
    this.y += Math.sin(this.angle) * activeSpeed;
    if (this.x < -10) this.x = this.canvasWidth + 10;
    if (this.x > this.canvasWidth + 10) this.x = -10;
    if (this.y < -10) this.y = this.canvasHeight + 10;
    if (this.y > this.canvasHeight + 10) this.y = -10;
  }

  drawFly(ctx: CanvasRenderingContext2D, settings: Record<string, unknown>, time: number, audioLevel = 0) {
    const sizeMultiplier = settings.size !== undefined ? (settings.size as number) : 1.0;
    const color = typeof settings.color === "string" ? settings.color : "#facc15";
    const pulse = Math.sin(time * 3 + this.pulseOffset) * 0.2 + 0.8;
    const r = this.radius * sizeMultiplier * pulse * (settings.audioReactive ? 0.8 + audioLevel * 1.0 : 1.0);
    const o = Math.max(0.1, Math.min(1.0, this.opacity * pulse * (settings.audioReactive ? 0.4 + audioLevel * 0.6 : 1.0)));
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 4;
    ctx.globalAlpha = o;
    ctx.fill();
    ctx.restore();
  }
}

export const firefliesVfx: VfxDefinition = {
  type: "fireflies",
  name: "Fireflies",
  defaultSettings: { intensity: 50, speed: 1, size: 1, color: "#facc15", audioReactive: false },
  schema: [
    { key: "intensity", label: "Intensity", kind: "slider", min: 0, max: 200, step: 5 },
    { key: "speed", label: "Speed", kind: "slider", min: 0.1, max: 3, step: 0.1 },
    { key: "size", label: "Size", kind: "slider", min: 0.2, max: 3, step: 0.1 },
    { key: "color", label: "Color", kind: "color" },
    { key: "audioReactive", label: "Audio reactive", kind: "toggle" },
  ],
  draw({ ctx, w, h, settings, time, state }) {
    const intensity = typeof settings.intensity === "number" ? settings.intensity : 50;
    if (!state.flies || (state.flies as Firefly[]).length !== intensity || state.w !== w || state.h !== h) {
      const next: Firefly[] = [];
      for (let i = 0; i < intensity; i++) next.push(new Firefly(w, h));
      state.flies = next;
      state.w = w;
      state.h = h;
    }
    const audioLevel = settings.audioReactive ? getAudioLevel("volume") : 0;
    for (const f of state.flies as Firefly[]) {
      f.updateFly(w, h, settings, audioLevel);
      f.drawFly(ctx, settings, time, audioLevel);
    }
  },
};
