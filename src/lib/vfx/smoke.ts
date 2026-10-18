import { State } from "../state";
import { SmokeSettingsView } from "../../components/clip-settings/vfx/smoke";
import { getAudioReactivity } from "../../utils/helpers";
import { BaseParticle } from "./base-particle";

export class SmokeParticle extends BaseParticle {
  size: number = 30;
  speed: number = 1;
  maxOpacity: number = 0.1;
  opacity: number = 0;
  life: number = 0;
  maxLife: number = 200;
  growth: number = 0.3;
  drift: number = 0;

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

  update(w: number, h: number, audioLevel = 0) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.life++;

    const activeSpeed = this.speed * (1 + audioLevel * 1.5);
    this.y -= activeSpeed;

    const activeDrift = this.drift + Math.sin(this.life * 0.02) * 0.3 + (Math.random() - 0.5) * audioLevel * 0.8;
    this.x += activeDrift;

    const activeGrowth = this.growth * (1 + audioLevel * 2.0);
    this.size += activeGrowth;

    // Fade in and out
    if (this.life < 50) {
      this.opacity = (this.life / 50) * this.maxOpacity;
    } else if (this.life > this.maxLife - 100) {
      this.opacity = ((this.maxLife - this.life) / 100) * this.maxOpacity;
    } else {
      this.opacity = this.maxOpacity;
    }

    if (this.life >= this.maxLife || this.y < -this.size) {
      this.reset();
    }
  }

  draw(ctx: CanvasRenderingContext2D, audioLevel = 0) {
    if (this.opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.min(1.0, this.opacity * (1 + audioLevel * 1.5));
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    grad.addColorStop(0, "rgba(200, 210, 220, 1)");
    grad.addColorStop(1, "rgba(200, 210, 220, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const SmokeVFX = {
  id: "smoke",
  name: "Smoke Effect",
  icon: "icon-[ri--cloud-windy-line]",

  settings: {
    intensity: 40,
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
    const intensity = settings.intensity || 40;

    // Initialize or resize particles array if count doesn't match
    if (!clip.particles || clip.particles.length !== intensity || clip.canvasWidth !== w || clip.canvasHeight !== h) {
      clip.particles = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        clip.particles.push(new SmokeParticle(w, h));
      }
    }

    const audioLevel = settings.audioReactive ? getAudioReactivity(State, "bass") : 0;

    clip.particles.forEach((p: SmokeParticle) => {
      p.update(w, h, audioLevel);
      p.draw(ctx, audioLevel);
    });
  },

  onSettings: SmokeSettingsView,
};
