import { editorStore } from "../../store/editor-store";
import { FirefliesSettingsView } from "../../components/clip-settings/vfx/fireflies";
import { getAudioReactivity } from "../../utils/helpers";
import { BaseParticle } from "./base-particle";

export class Firefly extends BaseParticle {
  radius: number = 2;
  speed: number = 0.5;
  angle: number = 0;
  angleChange: number = 0;
  opacity: number = 0.5;
  pulseSpeed: number = 0.03;
  pulseOffset: number = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    // Field initializers above run after super() and would flatten every firefly
    // to the same size/speed — re-apply the per-particle roll.
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = Math.random() * this.canvasHeight;
    this.radius = 1.5 + Math.random() * 2.5; // size between 1.5px and 4px
    this.speed = 0.3 + Math.random() * 0.7;
    this.angle = Math.random() * Math.PI * 2;
    this.angleChange = (Math.random() - 0.5) * 0.1;
    this.opacity = 0.2 + Math.random() * 0.6;
    this.pulseSpeed = 0.02 + Math.random() * 0.05;
    this.pulseOffset = Math.random() * Math.PI * 2;
  }

  update(w: number, h: number, settings: Record<string, any>, _time: number, audioLevel = 0) {
    this.canvasWidth = w;
    this.canvasHeight = h;

    // Slowly change direction (Brownian motion)
    this.angleChange += (Math.random() - 0.5) * 0.02;
    this.angleChange = Math.max(-0.15, Math.min(0.15, this.angleChange));
    this.angle += this.angleChange;

    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    const activeSpeed = this.speed * speedMultiplier * (settings.audioReactive ? 1.0 + audioLevel * 2.5 : 1.0);

    this.x += Math.cos(this.angle) * activeSpeed;
    this.y += Math.sin(this.angle) * activeSpeed;

    // Keep within bounds with wrapping
    if (this.x < -10) this.x = this.canvasWidth + 10;
    if (this.x > this.canvasWidth + 10) this.x = -10;
    if (this.y < -10) this.y = this.canvasHeight + 10;
    if (this.y > this.canvasHeight + 10) this.y = -10;
  }

  draw(ctx: CanvasRenderingContext2D, settings: Record<string, any>, time: number, audioLevel = 0) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const color = settings.color || "#facc15";

    // Natural breathing pulse
    const pulse = Math.sin(time * 3 + this.pulseOffset) * 0.2 + 0.8;

    const activeRadius = this.radius * sizeMultiplier * pulse * (settings.audioReactive ? 0.8 + audioLevel * 1.0 : 1.0);
    const activeOpacity = Math.max(
      0.1,
      Math.min(1.0, this.opacity * pulse * (settings.audioReactive ? 0.4 + audioLevel * 0.6 : 1.0)),
    );

    ctx.save();

    // Draw firefly core
    ctx.beginPath();
    ctx.arc(this.x, this.y, activeRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = activeRadius * 4;
    ctx.globalAlpha = activeOpacity;
    ctx.fill();

    ctx.restore();
  }
}

export const FirefliesVFX = {
  id: "fireflies",
  name: "Fireflies",
  icon: "icon-[ri--sparkling-line]",

  settings: {
    intensity: 50,
    speed: 1.0,
    size: 1.0,
    color: "#facc15",
    audioReactive: false,
  },

  drawItem(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
    _localTime: number,
    clip: Record<string, any>,
  ) {
    const intensity = settings.intensity || 50;

    // Initialize or resize fireflies array if count doesn't match
    if (
      !clip.fireflies ||
      clip.fireflies.length !== intensity ||
      clip.canvasWidth !== w ||
      clip.canvasHeight !== h
    ) {
      clip.fireflies = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        clip.fireflies.push(new Firefly(w, h));
      }
    }

    const audioLevel = settings.audioReactive ? getAudioReactivity(editorStore.getState(), "volume") : 0;
    const time = performance.now() / 1000;

    clip.fireflies.forEach((firefly: Firefly) => {
      firefly.update(w, h, settings, time, audioLevel);
      firefly.draw(ctx, settings, time, audioLevel);
    });
  },

  onSettings: FirefliesSettingsView,
};
