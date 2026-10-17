import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";
import { SliderControl, ToggleControl } from "./shared-controls";
import { BaseParticle } from "./base-particle";

export class Snowball extends BaseParticle {
  constructor(canvasWidth, canvasHeight) {
    super(canvasWidth, canvasHeight);
    this.y = Math.random() * canvasHeight;
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = -10 - Math.random() * 50;
    this.radius = 2 + Math.random() * 4; // base size between 2px and 6px
    this.speed = 1 + Math.random() * 2;  // slow base fall speed
    this.opacity = 0.3 + Math.random() * 0.5;
    this.swaySpeed = 0.5 + Math.random() * 1.5;
    this.swayAmount = 0.2 + Math.random() * 0.8;
    this.swayOffset = Math.random() * Math.PI * 2;
  }

  update(w, h, settings, time, audioLevel = 0) {
    this.canvasWidth = w;
    this.canvasHeight = h;

    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    const activeSpeed = this.speed * speedMultiplier * (settings.audioReactive ? (0.4 + audioLevel * 1.6) : 1.0);
    this.y += activeSpeed;

    const sway = Math.sin(time * this.swaySpeed + this.swayOffset) * this.swayAmount;
    const activeSway = sway * (settings.audioReactive ? (1.0 + audioLevel * 2.0) : 1.0);
    this.x += activeSway;

    if (this.y > this.canvasHeight + 10) {
      this.reset();
    }
  }

  draw(ctx, settings, audioLevel = 0) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const opacityMultiplier = settings.opacity !== undefined ? settings.opacity : 1.0;

    const activeRadius = this.radius * sizeMultiplier * (settings.audioReactive ? (0.8 + audioLevel * 0.6) : 1.0);
    const activeOpacity = Math.min(1.0, this.opacity * opacityMultiplier * (settings.audioReactive ? (0.5 + audioLevel * 0.5) : 1.0));

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
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
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

    const audioLevel = settings.audioReactive ? getAudioReactivity(State, "volume") : 0;

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

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'snow');
    if (!selectedClip) return null;

    // Ensure defaults exist
    if (selectedClip.settings.speed === undefined) selectedClip.settings.speed = 1.0;
    if (selectedClip.settings.size === undefined) selectedClip.settings.size = 1.0;
    if (selectedClip.settings.opacity === undefined) selectedClip.settings.opacity = 0.8;
    if (selectedClip.settings.audioReactive === undefined) selectedClip.settings.audioReactive = false;

    return m("div", { class: "space-y-4 animate-in fade-in duration-300" }, [
      // Audio Reactive Toggle
      m(ToggleControl, {
        label: "Audio Reactive",
        checked: selectedClip.settings.audioReactive,
        description: "Snowfall intensity, speed, and size will react to music volume",
        onchange: (e) => {
          selectedClip.settings.audioReactive = e.target.checked;
          m.redraw();
        }
      }),

      // Intensity Slider
      m(SliderControl, {
        label: `Snow Density: ${selectedClip.settings.intensity || 120}`,
        min: 20,
        max: 300,
        step: 10,
        value: selectedClip.settings.intensity || 120,
        minLabel: "Light",
        maxLabel: "Blizzard",
        oninput: (e) => {
          selectedClip.settings.intensity = parseInt(e.target.value);
          clip.snowballs = null; // Recreate snowballs with new intensity
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
        label: `Snowball Size: ${Math.round(selectedClip.settings.size * 100)}%`,
        min: 0.2,
        max: 4.0,
        step: 0.1,
        value: selectedClip.settings.size,
        minLabel: "Tiny",
        maxLabel: "Fluffy",
        oninput: (e) => {
          selectedClip.settings.size = parseFloat(e.target.value);
        }
      }),

      // Opacity Slider
      m(SliderControl, {
        label: `Snow Opacity: ${Math.round(selectedClip.settings.opacity * 100)}%`,
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
