import m from "mithril";
import { addClipToTimeline } from "../lib/clip-factory";
import { VisualizerRegistry } from "../lib/visualizers/index";
import { VFXRegistry } from "../lib/vfx/index";

const VIS_ICONS = {
  bars: "icon-[ri--bar-chart-2-line]",
  circle: "icon-[ri--donut-chart-line]",
  waveform: "icon-[ri--pulse-line]",
  blocks: "icon-[ri--apps-2-line]",
  "liquid-waves": "icon-[ri--water-flash-line]"
};

export const VFXPanel = {
  view() {
    return m("div", { class: "bg-slate-900/50 p-4 flex flex-col h-full w-full overflow-hidden" }, [
      m("div", { class: "flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1" }, [
        // 1. VISUALIZER SECTION
        m("div", { class: "space-y-4" }, [
          m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1" }, "Visualizer"),
          m("div", { class: "grid grid-cols-2 gap-2" }, 
            VisualizerRegistry.map(vis =>
              m("button", {
                class: "p-2.5 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 group cursor-pointer",
                onclick: () => addClipToTimeline("visualizer", { style: vis.id })
              }, [
                m("i", { class: `${VIS_ICONS[vis.id] || "icon-[ri--pulse-line]"} w-4.5 h-4.5 text-slate-400 group-hover:text-blue-400 transition-colors` }),
                m("span", { class: "text-[10px] font-bold text-slate-200" }, vis.name),
              ])
            )
          )
        ]),

        // 2. VISUAL EFFECTS SECTION
        m("div", { class: "space-y-4" }, [
          m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1" }, "Visual Effects"),
          m("div", { class: "grid grid-cols-3 gap-2" }, 
            VFXRegistry.map(vfx =>
              m("button", {
                class: "p-2 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 group cursor-pointer",
                onclick: () => addClipToTimeline(vfx.id)
              }, [
                m("i", { class: `${vfx.icon || "icon-[ri--pulse-line]"} w-4.5 h-4.5 text-slate-400 group-hover:text-blue-400 transition-colors` }),
                m("span", { class: "text-[10px] font-bold text-slate-200" }, vfx.id.charAt(0).toUpperCase() + vfx.id.slice(1)),
              ])
            )
          )
        ])
      ])
    ]);
  }
};
