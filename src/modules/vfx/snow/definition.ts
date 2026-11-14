import { getAudioLevel } from "../../audio/audio-engine";
import type { VfxDefinition } from "../_core/types";
import { BaseParticle, finiteSetting } from "../_core/base-particle";

// Drifting snowball particle.
class Snowball extends BaseParticle {
  radius = 3;
  speed = 80;
  opacity = 0.5;
  swaySpeed = 1;
  swayAmount = 8;
  swayOffset = 0;
  baseX = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    this.reset();
  }

  reset() {
    this.baseX = Math.random() * this.canvasWidth;
    this.x = this.baseX;
    this.y = -10 - Math.random() * 60;
    this.radius = 2 + Math.random() * 4;
    this.speed = 45 + Math.random() * 70;
    this.opacity = 0.3 + Math.random() * 0.5;
    this.swaySpeed = 0.4 + Math.random() * 1.2;
    this.swayAmount = 4 + Math.random() * 10;
    this.swayOffset = Math.random() * Math.PI * 2;
    this.lastTime = undefined;
  }

  updateSnow(
    w: number,
    h: number,
    settings: Record<string, unknown>,
    time: number,
    audioLevel = 0,
  ) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    const dt = this.step(time);
    const speedMultiplier = finiteSetting(settings, "speed", 1.0);
    const activeSpeed =
      this.speed *
      speedMultiplier *
      (settings.audioReactive ? 0.4 + audioLevel * 1.6 : 1.0);
    this.y += activeSpeed * dt;
    const sway =
      Math.sin(time * this.swaySpeed + this.swayOffset) * this.swayAmount;
    this.x =
      (((this.baseX +
        sway * (settings.audioReactive ? 1.0 + audioLevel * 2.0 : 1.0)) %
        w) +
        w) %
      w;
    if (this.y > this.canvasHeight + 10) this.reset();
  }

  drawSnow(
    ctx: CanvasRenderingContext2D,
    settings: Record<string, unknown>,
    audioLevel = 0,
  ) {
    const sizeMultiplier = finiteSetting(settings, "size", 1.0);
    const opacityMultiplier = finiteSetting(settings, "opacity", 0.8);
    const r =
      this.radius *
      sizeMultiplier *
      (settings.audioReactive ? 0.8 + audioLevel * 0.6 : 1.0);
    const o = Math.min(
      1.0,
      this.opacity *
        opacityMultiplier *
        (settings.audioReactive ? 0.5 + audioLevel * 0.5 : 1.0),
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${o})`;
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = r * 0.5;
    ctx.fill();
    ctx.restore();
  }
}

export const snowVfx: VfxDefinition = {
  type: "snow",
  name: "Snow",
  icon: "icon-[ri--snowy-line]",
  defaultSettings: {
    intensity: 120,
    speed: 1,
    size: 1,
    opacity: 0.8,
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
      typeof settings.intensity === "number" ? settings.intensity : 120;
    if (
      !state.balls ||
      (state.balls as Snowball[]).length !== intensity ||
      state.w !== w ||
      state.h !== h
    ) {
      const next: Snowball[] = [];
      for (let i = 0; i < intensity; i++) {
        const b = new Snowball(w, h);
        b.y = Math.random() * h;
        next.push(b);
      }
      state.balls = next;
      state.w = w;
      state.h = h;
    }
    const audioLevel = settings.audioReactive ? getAudioLevel("volume") : 0;
    for (const b of state.balls as Snowball[]) {
      b.updateSnow(w, h, settings, time, audioLevel);
      b.drawSnow(ctx, settings, audioLevel);
    }
  },
};
