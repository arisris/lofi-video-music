import m from "mithril";
import { State } from "../state";
import { runtime } from "../runtime";
import { SharedTransformSettings, SharedAnimationSettings } from "../../components/shared-clip-settings";
import { getVisualizer } from "../visualizers/index";
import { getClipsToSearch } from "../../utils/helpers";

export const VisualizerClip = {
  id: "visualizer",
  name: "Visualizer",
  icon: "icon-[ri--pulse-line]",
  
  settings: {
    style: "bars",
    color: "#3b82f6",
    intensity: 0.5,
    opacity: 1,
    density: 1.5,
    rainbow: false,
    reflectionOpacity: 0.25,
    size: 1.0,
  },

  getItemBoundingBox(ctx, w, h, settings) {
    if (settings.style === "circle") {
      const radius = Math.min(w, h) * 0.25;
      const size = (radius + 50) * 2;
      return {
        x: w / 2 - size / 2,
        y: h / 2 - size / 2,
        width: size,
        height: size
      };
    }
    if (settings.style === "waveform") {
      return { x: 0, y: h / 2 - 100, width: w, height: 200 };
    }
    return { x: 0, y: h / 2, width: w, height: h / 2 };
  },

  getBoundingBox(ctx, w, h) {
    return this.getItemBoundingBox(ctx, w, h, this.settings);
  },

  drawItem(ctx, w, h, settings) {
    if (!runtime.analyser) return;
    
    const { style, color, opacity } = settings;
    const visualizer = getVisualizer(style);
    
    const size = settings.size !== undefined ? settings.size : 1.0;
    
    ctx.save();
    ctx.globalAlpha = opacity !== undefined ? opacity : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    if (size !== 1.0) {
      let anchorX = w / 2;
      let anchorY = h / 2;
      if (style === "bars" || style === "blocks") {
        anchorY = h - 40; // scale relative to the reflection baseline anchor
      }
      ctx.translate(anchorX, anchorY);
      ctx.scale(size, size);
      ctx.translate(-anchorX, -anchorY);
    }

    visualizer.draw(ctx, w, h, settings);
    
    ctx.restore();
  },

  draw(ctx, w, h) {},

  onSettings(clip) {
    const clipsToSearch = getClipsToSearch(State);
    const selectedClip = clip || clipsToSearch.find(c => c.id === State.selectedClipId && c.type === 'visualizer');
    if (!selectedClip) {
      return m(
        "div",
        { class: "text-slate-500 text-xs italic text-center py-8" },
        "Select a visualizer from the list to change settings",
      );
    }
    const activeVis = selectedClip ? getVisualizer(selectedClip.settings.style) : null;

    return m(
      "div",
      {
        class: "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
      },
      [
        m("div", { class: "mb-4" }, [
          m("label", { class: "flex items-center gap-2 cursor-pointer" }, [
            m("input", {
              type: "checkbox",
              checked: selectedClip.settings.rainbow,
              class: "w-4 h-4 accent-blue-600 rounded",
              onchange: (e) => {
                selectedClip.settings.rainbow = e.target.checked;
                m.redraw();
              },
            }),
            m("span", { class: "text-xs text-slate-300" }, "Rainbow Mode"),
          ]),
        ]),
        m("div", { class: "mb-4" }, [
          m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between items-center" }, [
            m("span", "Main Color"),
            m("span", { class: "text-slate-500 font-mono" }, selectedClip.settings.color),
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
        m("div", { class: "grid grid-cols-2 gap-4" }, [
          m("div", [
            m("label", { class: "block text-xs text-slate-400 mb-2" }, "Intensity"),
            m("input", {
              type: "range",
              min: 0,
              max: 3,
              step: 0.1,
              value: selectedClip.settings.intensity,
              class: "w-full accent-blue-500",
              oninput: (e) => {
                selectedClip.settings.intensity = parseFloat(e.target.value);
                m.redraw();
              },
            }),
          ]),
          m("div", [
            m("label", { class: "block text-xs text-slate-400 mb-2" }, "Opacity"),
            m("input", {
              type: "range",
              min: 0,
              max: 1,
              step: 0.1,
              value: selectedClip.settings.opacity,
              class: "w-full accent-blue-500",
              oninput: (e) => {
                selectedClip.settings.opacity = parseFloat(e.target.value);
                m.redraw();
              },
            }),
          ]),
        ]),
        m("div", { class: "mt-4" }, [
          m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between" }, [
            m("span", "Size"),
            m("span", { class: "text-slate-500" }, `${Math.round((selectedClip.settings.size !== undefined ? selectedClip.settings.size : 1.0) * 100)}%`),
          ]),
          m("input", {
            type: "range",
            min: 0.2,
            max: 3.0,
            step: 0.05,
            value: selectedClip.settings.size !== undefined ? selectedClip.settings.size : 1.0,
            class: "w-full accent-blue-500",
            oninput: (e) => {
              selectedClip.settings.size = parseFloat(e.target.value);
              m.redraw();
            },
          }),
        ]),
        m("div", { class: "mt-4" }, [
          m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between" }, [
            m("span", "Density"),
            m("span", { class: "text-slate-500" }, selectedClip.settings.density.toFixed(1)),
          ]),
          m("input", {
            type: "range",
            min: 1,
            max: 20,
            step: 0.5,
            value: selectedClip.settings.density,
            class: "w-full accent-blue-500",
            oninput: (e) => {
              selectedClip.settings.density = parseFloat(e.target.value);
              m.redraw();
            },
          }),
        ]),
        activeVis && activeVis.hasReflection && m("div", { class: "mt-4" }, [
          m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between" }, [
            m("span", "Reflection Opacity"),
            m("span", { class: "text-slate-500" }, `${Math.round((selectedClip.settings.reflectionOpacity !== undefined ? selectedClip.settings.reflectionOpacity : 0.25) * 100)}%`),
          ]),
          m("input", {
            type: "range",
            min: 0,
            max: 1,
            step: 0.05,
            value: selectedClip.settings.reflectionOpacity !== undefined ? selectedClip.settings.reflectionOpacity : 0.25,
            class: "w-full accent-blue-500",
            oninput: (e) => {
              selectedClip.settings.reflectionOpacity = parseFloat(e.target.value);
              m.redraw();
            },
          }),
        ]),
        SharedTransformSettings(null, -1, selectedClip.settings),
        SharedAnimationSettings(null, -1, selectedClip.settings),
      ]
    );
  },
};
