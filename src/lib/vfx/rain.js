import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";
import { SliderControl, ToggleControl } from "./shared-controls";
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

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'rain');
    if (!selectedClip) return null;

    // Ensure defaults exist
    if (selectedClip.settings.speed === undefined) selectedClip.settings.speed = 1.0;
    if (selectedClip.settings.size === undefined) selectedClip.settings.size = 1.0;
    if (selectedClip.settings.opacity === undefined) selectedClip.settings.opacity = 1.0;
    if (selectedClip.settings.audioReactive === undefined) selectedClip.settings.audioReactive = false;

    return m("div", { class: "space-y-4 animate-in fade-in duration-300" }, [
      // Audio Reactive Toggle
      m(ToggleControl, {
        label: "Audio Reactive",
        checked: selectedClip.settings.audioReactive,
        description: "Rain intensity, fall speed, and opacity will react to music volume",
        onchange: (e) => {
          selectedClip.settings.audioReactive = e.target.checked;
          m.redraw();
        }
      }),

      // Intensity Slider
      m(SliderControl, {
        label: `Rain Intensity: ${selectedClip.settings.intensity || 200}`,
        min: 50,
        max: 500,
        step: 10,
        value: selectedClip.settings.intensity || 200,
        minLabel: "Light",
        maxLabel: "Heavy",
        oninput: (e) => {
          selectedClip.settings.intensity = parseInt(e.target.value);
          clip.drops = null; // Recreate drops with new intensity
        }
      }),

      // Speed Slider
      m(SliderControl, {
        label: `Fall Speed: ${Math.round(selectedClip.settings.speed * 100)}%`,
        min: 0.1,
        max: 3.0,
        step: 0.1,
        value: selectedClip.settings.speed,
        minLabel: "Slow",
        maxLabel: "Fast",
        oninput: (e) => {
          selectedClip.settings.speed = parseFloat(e.target.value);
        }
      }),

      // Size Slider
      m(SliderControl, {
        label: `Drop Size: ${Math.round(selectedClip.settings.size * 100)}%`,
        min: 0.2,
        max: 3.0,
        step: 0.1,
        value: selectedClip.settings.size,
        minLabel: "Thin/Short",
        maxLabel: "Thick/Long",
        oninput: (e) => {
          selectedClip.settings.size = parseFloat(e.target.value);
        }
      }),

      // Opacity Slider
      m(SliderControl, {
        label: `Rain Opacity: ${Math.round(selectedClip.settings.opacity * 100)}%`,
        min: 0.1,
        max: 1.0,
        step: 0.05,
        value: selectedClip.settings.opacity,
        minLabel: "Faint",
        maxLabel: "Solid",
        oninput: (e) => {
          selectedClip.settings.opacity = parseFloat(e.target.value);
        }
      })
    ]);
  }
};
