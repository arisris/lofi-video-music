import { editorStore } from "../../store/editor-store";
import { SnowSettingsView } from "../../components/clip-settings/vfx/snow";
import { getAudioReactivity } from "../../utils/helpers";
import { BaseParticle } from "./base-particle";

export class Snowball extends BaseParticle {
  radius: number = 3;
  speed: number = 1;
  opacity: number = 0.5;
  swaySpeed: number = 1;
  swayAmount: number = 0.5;
  swayOffset: number = 0;

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = -10 - Math.random() * 50;
    this.radius = 2 + Math.random() * 4; // base size between 2px and 6px
    this.speed = 1 + Math.random() * 2; // slow base fall speed
    this.opacity = 0.3 + Math.random() * 0.5;
    this.swaySpeed = 0.5 + Math.random() * 1.5;
    this.swayAmount = 0.2 + Math.random() * 0.8;
    this.swayOffset = Math.random() * Math.PI * 2;
  }

  update(w: number, h: number, settings: Record<string, any>, time: number, audioLevel = 0) {
    this.canvasWidth = w;
    this.canvasHeight = h;

    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    const activeSpeed = this.speed * speedMultiplier * (settings.audioReactive ? 0.4 + audioLevel * 1.6 : 1.0);
    this.y += activeSpeed;

    const sway = Math.sin(time * this.swaySpeed + this.swayOffset) * this.swayAmount;
    const activeSway = sway * (settings.audioReactive ? 1.0 + audioLevel * 2.0 : 1.0);
    this.x += activeSway;

    if (this.y > this.canvasHeight + 10) {
      this.reset();
    }
  }

  draw(ctx: CanvasRenderingContext2D, settings: Record<string, any>, audioLevel = 0) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const opacityMultiplier = settings.opacity !== undefined ? settings.opacity : 1.0;

    const activeRadius = this.radius * sizeMultiplier * (settings.audioReactive ? 0.8 + audioLevel * 0.6 : 1.0);
    const activeOpacity = Math.min(
      1.0,
      this.opacity * opacityMultiplier * (settings.audioReactive ? 0.5 + audioLevel * 0.5 : 1.0),
    );

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, activeRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${activeOpacity})`;
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = activeRadius * 0.5;
    ctx.fill();
    ctx.restore();
  }
}

export const SnowVFX = {
  id: "snow",
  name: "Snow Effect",
  icon: "icon-[ri--snowy-line]",

  settings: {
    intensity: 120,
    speed: 1.0,
    size: 1.0,
    opacity: 0.8,
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
    const intensity = settings.intensity || 120;

    // Initialize or resize snowballs array if count doesn't match
    if (!clip.snowballs || clip.snowballs.length !== intensity || clip.canvasWidth !== w || clip.canvasHeight !== h) {
      clip.snowballs = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        clip.snowballs.push(new Snowball(w, h));
      }
    }

    const audioLevel = settings.audioReactive ? getAudioReactivity(editorStore.getState(), "volume") : 0;

    // Determine how many snowballs to draw
    const visibleCount = settings.audioReactive
      ? Math.floor(clip.snowballs.length * (0.3 + audioLevel * 0.7))
      : clip.snowballs.length;

    const time = performance.now() / 1000;

    for (let i = 0; i < visibleCount; i++) {
      const snowball = clip.snowballs[i];
      snowball.update(w, h, settings, time, audioLevel);
      snowball.draw(ctx, settings, audioLevel);
    }
  },

  onSettings: SnowSettingsView,
};
