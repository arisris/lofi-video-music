import m from "mithril";
import { throttle } from "../../utils/helpers";

// A modular slider component
export const SliderControl = {
  oninit(vnode) {
    vnode.state.throttledInput = throttle((val) => {
      if (vnode.attrs.oninput) {
        vnode.attrs.oninput({ target: { value: val } });
        m.redraw();
      }
    });
  },
  view(vnode) {
    const { label, min, max, step, value, minLabel, maxLabel } = vnode.attrs;
    return m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
      m("label", { class: "block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider" }, label),
      m("input", {
        type: "range",
        min: min,
        max: max,
        step: step,
        class: "w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500",
        value: value,
        oninput: (e) => {
          e.redraw = false; // Disable Mithril auto-redraw for high-frequency input
          vnode.state.throttledInput(e.target.value);
        }
      }),
      (minLabel || maxLabel) && m("div", { class: "flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono" }, [
        m("span", minLabel || ""),
        m("span", maxLabel || "")
      ])
    ]);
  }
};

// A modular toggle checkbox component
export const ToggleControl = {
  view(vnode) {
    const { label, checked, onchange, description } = vnode.attrs;
    return m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
      m("label", { class: "flex items-center gap-2 cursor-pointer" }, [
        m("input", {
          type: "checkbox",
          checked: checked || false,
          class: "w-4 h-4 accent-blue-600 rounded",
          onchange: onchange
        }),
        m("span", { class: "text-xs font-bold text-slate-300" }, label)
      ]),
      description && m("p", { class: "text-[10px] text-slate-500 mt-1" }, description)
    ]);
  }
};
