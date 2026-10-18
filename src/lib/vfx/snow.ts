import { editorStore } from "../../store/editor-store";
import { SnowSettingsView } from "../../components/clip-settings/vfx/snow";
import { getAudioReactivity } from "../../utils/helpers";
import { BaseParticle } from "./base-particle";

export class Snowball extends BaseParticle {
  radius: number = 3;
  /** Fall speed in px/second. */
  speed: number = 80;
  opacity: number = 0.5;
  swaySpeed: number = 1;
  /** Sway amplitude in px. */
  swayAmount: number = 8;
  swayOffset: number = 0;
  /** Horizontal anchor: sway is applied around this, never accumulated. */
  baseX: number = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    // Field initializers above run after super() and would flatten every
    // snowball to the same size/speed — re-apply the per-particle roll.
    this.reset();
  }

  reset() {
    this.baseX = Math.random() * this.canvasWidth;
    this.x = this.baseX;
    this.y = -10 - Math.random() * 60;
    this.radius = 2 + Math.random() * 4; // base size between 2px and 6px
    this.speed = 45 + Math.random() * 70; // 45-115 px/s, slow drifting snowfall
    this.opacity = 0.3 + Math.random() * 0.5;
    this.swaySpeed = 0.4 + Math.random() * 1.2;
    this.swayAmount = 4 + Math.random() * 10; // 4-14px of horizontal drift
    this.swayOffset = Math.random() * Math.PI * 2;
    this.lastTime = undefined;
  }

  update(
    w: number,
    h: number,
    settings: Record<string, any>,
    time: number,
    audioLevel = 0,
  ) {
    this.canvasWidth = w;
    this.canvasHeight = h;

    const dt = this.step(time);
    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    const activeSpeed =
      this.speed *
      speedMultiplier *
      (settings.audioReactive ? 0.4 + audioLevel * 1.6 : 1.0);
    this.y += activeSpeed * dt;

    // Sway oscillates around baseX. Accumulating it instead (x += sway) walked
    // every flake sideways off the canvas over a few seconds.
    const sway =
      Math.sin(time * this.swaySpeed + this.swayOffset) * this.swayAmount;
    const activeSway =
      sway * (settings.audioReactive ? 1.0 + audioLevel * 2.0 : 1.0);
    this.x = (((this.baseX + activeSway) % w) + w) % w;

    if (this.y > this.canvasHeight + 10) {
      this.reset();
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    settings: Record<string, any>,
    audioLevel = 0,
  ) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const opacityMultiplier =
      settings.opacity !== undefined ? settings.opacity : 1.0;

    const activeRadius =
      this.radius *
      sizeMultiplier *
      (settings.audioReactive ? 0.8 + audioLevel * 0.6 : 1.0);
    const activeOpacity = Math.min(
      1.0,
      this.opacity *
        opacityMultiplier *
        (settings.audioReactive ? 0.5 + audioLevel * 0.5 : 1.0),
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
    if (
      !clip.snowballs ||
      clip.snowballs.length !== intensity ||
      clip.canvasWidth !== w ||
      clip.canvasHeight !== h
    ) {
      clip.snowballs = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        const ball = new Snowball(w, h);
        // Pre-fill the sky: the first flakes start spread over the canvas instead
        // of queueing up above the top edge and taking a full pass to fall in.
        ball.y = Math.random() * h;
        clip.snowballs.push(ball);
      }
    }

    const audioLevel = settings.audioReactive
      ? getAudioReactivity(editorStore.getState(), "volume")
      : 0;

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
