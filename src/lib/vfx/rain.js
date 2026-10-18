import { State } from "../state";
import { RainSettingsView } from "../../components/clip-settings/vfx/rain";
import { getAudioReactivity } from "../../utils/helpers";
import { BaseParticle } from "./base-particle";

export class Drop extends BaseParticle {
  constructor(canvasWidth, canvasHeight) {
    super(canvasWidth, canvasHeight);
    this.y = Math.random() * canvasHeight;
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = -20 - Math.random() * 100;
    this.length = 10 + Math.random() * 20;
    this.speed = 10 + Math.random() * 10;
    this.opacity = 0.1 + Math.random() * 0.4;
  }

  update(w, h, settings) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    this.y += this.speed * speedMultiplier;
    if (this.y > this.canvasHeight) {
      this.reset();
    }
  }

  draw(ctx, settings) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const opacityMultiplier = settings.opacity !== undefined ? settings.opacity : 1.0;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y + this.length * sizeMultiplier);
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1.0, this.opacity * opacityMultiplier)})`;
    ctx.lineWidth = Math.max(0.5, 1 * sizeMultiplier);
    ctx.stroke();
    ctx.restore();
  }
}

export const RainVFX = {
  id: "rain",
  name: "Rain (CPU)",
  icon: "icon-[ri--rainy-line]",
  
  settings: {
    intensity: 200,
    speed: 1.0,
    size: 1.0,
    opacity: 1.0,
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    const intensity = settings.intensity || 200;
    
    // Initialize or resize drops array if count doesn't match
    if (!clip.drops || clip.drops.length !== intensity || clip.canvasWidth !== w || clip.canvasHeight !== h) {
      clip.drops = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        clip.drops.push(new Drop(w, h));
      }
    }

    const audioLevel = settings.audioReactive ? getAudioReactivity(State, "volume") : 0;

    // Determine how many drops to draw
    const visibleCount = settings.audioReactive 
      ? Math.floor(clip.drops.length * (0.25 + audioLevel * 0.75))
      : clip.drops.length;

    // Create a modified settings object for updates/draws if audio reactive
    const activeSettings = settings.audioReactive ? {
      ...settings,
      speed: (settings.speed !== undefined ? settings.speed : 1.0) * (0.4 + audioLevel * 1.6),
      opacity: (settings.opacity !== undefined ? settings.opacity : 1.0) * (0.3 + audioLevel * 0.7)
    } : settings;

    for (let i = 0; i < visibleCount; i++) {
      const drop = clip.drops[i];
      drop.update(w, h, activeSettings);
      drop.draw(ctx, activeSettings);
    }
  },

  onSettings: RainSettingsView,
};