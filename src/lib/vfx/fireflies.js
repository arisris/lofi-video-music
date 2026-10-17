import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";
import { SliderControl, ToggleControl } from "./shared-controls";
import { BaseParticle } from "./base-particle";

export class Firefly extends BaseParticle {
  constructor(canvasWidth, canvasHeight) {
    super(canvasWidth, canvasHeight);
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
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

  update(w, h, settings, time, audioLevel = 0) {
    this.canvasWidth = w;
    this.canvasHeight = h;

    // Slowly change direction (Brownian motion)
    this.angleChange += (Math.random() - 0.5) * 0.02;
    this.angleChange = Math.max(-0.15, Math.min(0.15, this.angleChange));
    this.angle += this.angleChange;

    const speedMultiplier = settings.speed !== undefined ? settings.speed : 1.0;
    const activeSpeed = this.speed * speedMultiplier * (settings.audioReactive ? (1.0 + audioLevel * 2.5) : 1.0);

    this.x += Math.cos(this.angle) * activeSpeed;
    this.y += Math.sin(this.angle) * activeSpeed;

    // Keep within bounds with wrapping
    if (this.x < -10) this.x = this.canvasWidth + 10;
    if (this.x > this.canvasWidth + 10) this.x = -10;
    if (this.y < -10) this.y = this.canvasHeight + 10;
    if (this.y > this.canvasHeight + 10) this.y = -10;
  }

  draw(ctx, settings, time, audioLevel = 0) {
    const sizeMultiplier = settings.size !== undefined ? settings.size : 1.0;
    const color = settings.color || "#facc15";

    // Natural breathing pulse
    const pulse = Math.sin(time * 3 + this.pulseOffset) * 0.2 + 0.8;
    
    const activeRadius = this.radius * sizeMultiplier * pulse * (settings.audioReactive ? (0.8 + audioLevel * 1.0) : 1.0);
    const activeOpacity = Math.max(0.1, Math.min(1.0, this.opacity * pulse * (settings.audioReactive ? (0.4 + audioLevel * 0.6) : 1.0)));

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
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    const intensity = settings.intensity || 50;

    // Initialize or resize fireflies array if count doesn't match
    if (!clip.fireflies || clip.fireflies.length !== intensity || clip.canvasWidth !== w || clip.canvasHeight !== h) {
      clip.fireflies = [];
      clip.canvasWidth = w;
      clip.canvasHeight = h;
      for (let i = 0; i < intensity; i++) {
        clip.fireflies.push(new Firefly(w, h));
      }
    }

    const audioLevel = settings.audioReactive ? getAudioReactivity(State, "volume") : 0;
    const time = performance.now() / 1000;

    clip.fireflies.forEach((firefly) => {
      firefly.update(w, h, settings, time, audioLevel);
      firefly.draw(ctx, settings, time, audioLevel);
    });
  },

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'fireflies');
    if (!selectedClip) return null;

    // Ensure defaults exist
    if (selectedClip.settings.speed === undefined) selectedClip.settings.speed = 1.0;
    if (selectedClip.settings.size === undefined) selectedClip.settings.size = 1.0;
    if (selectedClip.settings.color === undefined) selectedClip.settings.color = "#facc15";
    if (selectedClip.settings.audioReactive === undefined) selectedClip.settings.audioReactive = false;

    return m("div", { class: "space-y-4 animate-in fade-in duration-300" }, [
      // Audio Reactive Toggle
      m(ToggleControl, {
        label: "Audio Reactive",
        checked: selectedClip.settings.audioReactive,
        description: "Fireflies brightness, speed, and size will react to music volume",
        onchange: (e) => {
          selectedClip.settings.audioReactive = e.target.checked;
          m.redraw();
        }
      }),

      // Color Picker
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between items-center font-bold" }, [
          m("span", "Firefly Color"),
          m("span", { class: "text-slate-500 font-mono text-[10px]" }, selectedClip.settings.color),
        ]),
        m("input", {
          type: "color",
          value: selectedClip.settings.color,
          class: "w-full h-10 bg-transparent cursor-pointer rounded border border-slate-700",
          oninput: (e) => {
            selectedClip.settings.color = e.target.value;
            m.redraw();
          },
        }),
      ]),

      // Intensity Slider
      m(SliderControl, {
        label: `Fireflies Count: ${selectedClip.settings.intensity || 50}`,
        min: 10,
        max: 150,
        step: 5,
        value: selectedClip.settings.intensity || 50,
        minLabel: "Few",
        maxLabel: "Swarm",
        oninput: (e) => {
          selectedClip.settings.intensity = parseInt(e.target.value);
          clip.fireflies = null; // Recreate fireflies list
        }
      }),

      // Speed Slider
      m(SliderControl, {
        label: `Float Speed: ${Math.round(selectedClip.settings.speed * 100)}%`,
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
        label: `Glow Size: ${Math.round(selectedClip.settings.size * 100)}%`,
        min: 0.2,
        max: 3.0,
        step: 0.1,
        value: selectedClip.settings.size,
        minLabel: "Tiny",
        maxLabel: "Large",
        oninput: (e) => {
          selectedClip.settings.size = parseFloat(e.target.value);
        }
      })
    ]);
  }
};
