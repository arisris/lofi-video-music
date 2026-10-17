import m from "mithril";
import { ScrubInput } from "./scrub-input";

export const ColorInput = {
  // Helper to convert hex to rgba if needed
  hexToRgba(hex, alpha) {
    if (!hex || hex === "transparent") return "transparent";
    if (!hex.startsWith("#")) return hex; // Already rgba or named
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },
  // Helper to get alpha from rgba string
  getAlpha(val) {
    if (val === "transparent") return 0;
    if (!val) return 1;
    if (val.startsWith("#")) return 1;
    const match = val.match(/rgba?\(.*,\s*([\d.]+)\)/);
    return match ? parseFloat(match[1]) : 1;
  },
  // Helper to get hex from rgba
  getHex(val) {
    if (!val || val === "transparent") return "#000000";
    if (val.startsWith("#")) return val.slice(0, 7);
    const match = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return "#000000";
    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  },

  view(vnode) {
    const { label, value, onUpdate } = vnode.attrs;
    const currentHex = this.getHex(value);
    const currentAlpha = this.getAlpha(value);

    return m("div", { class: "mb-4" }, [
      m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, label),
      m("div", { 
        class: "flex items-center bg-slate-800/40 border border-slate-700/50 rounded overflow-hidden h-7 transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50" 
      }, [
        // 1. Color Picker Area
        m("div", { class: "relative w-10 h-full flex-none flex items-center justify-center border-r border-slate-700/50 bg-slate-900/20" }, [
          m("input", {
            type: "color",
            class: "w-6 h-5 bg-transparent cursor-pointer rounded-sm border-none p-0",
            value: currentHex,
            oninput: (e) => {
              const newAlpha = currentAlpha === 0 ? 1 : currentAlpha;
              onUpdate(this.hexToRgba(e.target.value, newAlpha));
            }
          }),
          currentAlpha < 1 && m("div", { 
            class: "absolute inset-0 pointer-events-none flex items-center justify-center bg-slate-900/40"
          }, m("i", { class: "icon-[ri--contrast-drop-2-line] text-[10px] text-white/50" }))
        ]),
        
        // 2. Text Input
        m("input", {
          type: "text",
          class: `flex-1 bg-transparent border-none px-2 h-full font-mono text-slate-300 outline-none ${value?.length > 15 ? 'text-[9px]' : 'text-[10px]'}`,
          value: value || "#000000",
          oninput: (e) => onUpdate(e.target.value)
        }),
        
        // 3. Alpha Slider
        m("div", { class: "w-14 h-full flex-none border-l border-slate-700/50" }, 
          m(ScrubInput, {
            label: "", 
            value: currentAlpha,
            step: 0.01,
            min: 0,
            max: 1,
            ghost: true,
            onUpdate: (val) => onUpdate(this.hexToRgba(currentHex, val))
          })
        )
      ]),
    ]);
  }
};
