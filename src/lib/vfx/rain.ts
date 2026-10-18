import { editorStore } from "../../store/editor-store";
import { RainSettingsView } from "../../components/clip-settings/vfx/rain";
import { getAudioReactivity } from "../../utils/helpers";
import { BaseParticle } from "./base-particle";

export class Drop extends BaseParticle {
  length: number = 10;
  /** Fall speed in px/second. */
  speed: number = 800;
  opacity: number = 0.2;
  /** Horizontal drift in px/second — a slight slant so the curtain isn't a ruler. */
  slant: number = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super(canvasWidth, canvasHeight);
    // Field initializers above run after super() and would flatten every drop to
    // the same length/speed — re-apply the per-particle roll.
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = -20 - Math.random() * 100;
    this.length = 10 + Math.random() * 22;
    this.speed = 600 + Math.random() * 500; // 600-1100 px/s
    this.opacity = 0.12 + Math.random() * 0.38;
    this.slant = (Math.random() - 0.5) * 70;
    this.lastTime = undefined;
  }

  update(w: number, h: number, settings: Record<string, any>, time?: number) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    const dt = this.step(time);

    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    this.y += this.speed * speedMultiplier * dt;
    this.x += this.slant * dt;

    // Wrap horizontally instead of letting drops drift off the canvas.
    if (this.x < 0) this.x += w;
    else if (this.x > w) this.x -= w;

    if (this.y > this.canvasHeight) {
      this.reset();
    }
  }

  draw(ctx: CanvasRenderingContext2D, settings: Record<string, any>) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const opacityMultiplier =
      settings.opacity !== undefined ? settings.opacity : 1.0;

    // (x, y) is the drop's head; the streak trails *behind* it, i.e. above,
    // and leans against the direction of travel.
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

export const RainVFX = {
  id: "rain",
  name: "Rain (CPU)",
  icon: "icon-[ri--rainy-line]",

  settings: {
    intensity: 200,
    speed: 1.0,
    size: 1.0,
    opacity: 1.0,
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
    const intensity = settings.intensity || 200;

    // Initialize or resize drops array if count doesn't match
    if (
      !clip.drops ||
      clip.drops.length !== intensity ||
      clip.canvasWidth !== w ||
      clip.canvasHeight !== h
    ) {
      clip.drops = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        const drop = new Drop(w, h);
        // Pre-fill the sky so the curtain is visible immediately.
        drop.y = Math.random() * h;
        clip.drops.push(drop);
      }
    }

    const audioLevel = settings.audioReactive
      ? getAudioReactivity(editorStore.getState(), "volume")
      : 0;

    // Determine how many drops to draw
    const visibleCount = settings.audioReactive
      ? Math.floor(clip.drops.length * (0.25 + audioLevel * 0.75))
      : clip.drops.length;

    // Create a modified settings object for updates/draws if audio reactive
    const activeSettings = settings.audioReactive
      ? {
          ...settings,
          speed:
            (settings.speed !== undefined ? settings.speed : 1.0) *
            (0.4 + audioLevel * 1.6),
          opacity:
            (settings.opacity !== undefined ? settings.opacity : 1.0) *
            (0.3 + audioLevel * 0.7),
        }
      : settings;

    const time = performance.now() / 1000;

    for (let i = 0; i < visibleCount; i++) {
      const drop = clip.drops[i];
      drop.update(w, h, activeSettings, time);
      drop.draw(ctx, activeSettings);
    }
  },

  onSettings: RainSettingsView,
};
