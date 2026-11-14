import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { BaseParticle, finiteSetting } from "../_core/base-particle";

// Falling rain-drop particle.
class Drop extends BaseParticle {
  length = 10;
  speed = 800;
  opacity = 0.2;
  slant = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = -20 - Math.random() * 100;
    this.length = 10 + Math.random() * 22;
    this.speed = 600 + Math.random() * 500;
    this.opacity = 0.12 + Math.random() * 0.38;
    this.slant = (Math.random() - 0.5) * 70;
    this.lastTime = undefined;
  }

  update(
    w: number,
    h: number,
    settings: Record<string, unknown>,
    time?: number,
  ) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    const dt = this.step(time);
    const speedMultiplier = finiteSetting(settings, "speed", 1.0);
    this.y += this.speed * speedMultiplier * dt;
    this.x += this.slant * dt;
    if (this.x < 0) this.x += w;
    else if (this.x > w) this.x -= w;
    if (this.y > this.canvasHeight) this.reset();
  }

  drawDrop(ctx: CanvasRenderingContext2D, settings: Record<string, unknown>) {
    const sizeMultiplier = finiteSetting(settings, "size", 1.0);
    const opacityMultiplier = finiteSetting(settings, "opacity", 1.0);
    const length = this.length * sizeMultiplier;
    const tiltX = (this.slant / Math.max(this.speed, 1)) * length;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - tiltX, this.y - length);
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1.0, this.opacity * opacityMultiplier)})`;
    ctx.lineWidth = Math.max(0.5, 1 * sizeMultiplier);
    ctx.stroke();
    ctx.restore();
  }
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
    const intensity =
      typeof settings.intensity === "number" ? settings.intensity : 200;
    const drops = state.drops as Drop[] | undefined;
    if (
      !drops ||
      drops.length !== intensity ||
      state.w !== w ||
      state.h !== h
    ) {
      const next: Drop[] = [];
      for (let i = 0; i < intensity; i++) {
        const d = new Drop(w, h);
        d.y = Math.random() * h;
        next.push(d);
      }
      state.drops = next;
      state.w = w;
      state.h = h;
    }
    const audioLevel = settings.audioReactive ? getAudioLevel("volume") : 0;
    const visible = settings.audioReactive
      ? Math.floor((state.drops as Drop[]).length * (0.25 + audioLevel * 0.75))
      : (state.drops as Drop[]).length;
    const active = settings.audioReactive
      ? {
          ...settings,
          speed:
            (typeof settings.speed === "number" ? settings.speed : 1) *
            (0.4 + audioLevel * 1.6),
          opacity:
            (typeof settings.opacity === "number" ? settings.opacity : 1) *
            (0.3 + audioLevel * 0.7),
        }
      : settings;
    const list = state.drops as Drop[];
    for (let i = 0; i < visible; i++) {
      list[i].update(w, h, active, time);
      list[i].drawDrop(ctx, active);
    }
  },
};
