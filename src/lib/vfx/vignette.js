import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";

export const VignetteVFX = {
  id: "vignette",
  name: "Beat Vignette",
  icon: "icon-[ri--focus-3-line]",

  settings: {
    opacity: 0.4,
    color: "#000000",
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    const opacity = settings.opacity !== undefined ? settings.opacity : 0.4;
    const color = settings.color || "#000000";

    const audioLevel = settings.audioReactive ? getAudioReactivity(State, "bass") : 0;

    // Pulse opacity and close in the radius on strong bass beats
    const activeOpacity = Math.max(0.0, Math.min(1.0, opacity + audioLevel * 0.45));
    
    // Scale the vignette circle radius based on audio level
    const maxRadius = Math.sqrt(w * w + h * h) / 2;
    const radiusScale = settings.audioReactive ? Math.max(0.5, 1.1 - audioLevel * 0.45) : 1.0;
    const outerRadius = maxRadius * radiusScale;

    // Convert hex color to rgba for gradient
    // Simple helper to parse hex to rgb
    let r = 0, g = 0, b = 0;
    const hex = color.replace(/^#/, '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }

    ctx.save();
    
    // Create radial gradient anchored in center
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, outerRadius);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`); // center is transparent
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${activeOpacity})`); // edges are colored
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    
    ctx.restore();
  },

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'vignette');
    if (!selectedClip) return null;

    // Ensure defaults exist
    if (selectedClip.settings.opacity === undefined) selectedClip.settings.opacity = 0.4;
    if (selectedClip.settings.color === undefined) selectedClip.settings.color = "#000000";
    if (selectedClip.settings.audioReactive === undefined) selectedClip.settings.audioReactive = false;

    return m("div", { class: "space-y-4 animate-in fade-in duration-300" }, [
      // Audio Reactive Toggle
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "flex items-center gap-2 cursor-pointer" }, [
          m("input", {
            type: "checkbox",
            checked: selectedClip.settings.audioReactive || false,
            class: "w-4 h-4 accent-blue-600 rounded",
            onchange: (e) => {
              selectedClip.settings.audioReactive = e.target.checked;
              m.redraw();
            },
          }),
          m("span", { class: "text-xs font-bold text-slate-300" }, "Audio Reactive"),
        ]),
        m("p", { class: "text-[10px] text-slate-500 mt-1" }, "Vignette shadow will expand and pulse to the music bass beats")
      ]),

      // Color Picker
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between items-center font-bold" }, [
          m("span", "Shadow Color"),
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

      // Opacity Slider
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider" }, `Vignette Opacity: ${Math.round(selectedClip.settings.opacity * 100)}%`),
        m("input", {
          type: "range",
          min: 0.0,
          max: 1.0,
          step: 0.05,
          class: "w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500",
          value: selectedClip.settings.opacity,
          oninput: (e) => {
            selectedClip.settings.opacity = parseFloat(e.target.value);
          }
        }),
        m("div", { class: "flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono" }, [
          m("span", "Faint"),
          m("span", "Solid")
        ])
      ])
    ]);
  }
};
