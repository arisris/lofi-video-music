import m from "mithril";
import { State } from "../lib/state";

export const Resizer = {
  oninit(vnode) {
    vnode.state.isResizing = false;
  },
  view(vnode) {
    const { side, onResize, order = "" } = vnode.attrs;
    return m("div", {
      class: `hidden md:flex flex-none w-1 h-full bg-transparent hover:bg-blue-500/30 cursor-col-resize transition-all z-[100] items-center justify-center ${order} ${vnode.state.isResizing ? "bg-blue-500/50 w-1.5" : ""}`,
      onmousedown: (e) => {
        vnode.state.isResizing = true;
        const startX = e.clientX;
        const startWidth = side === "left" ? State.mediaPoolWidth : State.inspectorWidth;
        
        const onMouseMove = (me) => {
          if (!vnode.state.isResizing) return;
          const dx = me.clientX - startX;
          const newWidth = side === "left" ? startWidth + dx : startWidth - dx;
          onResize(Math.max(200, Math.min(800, newWidth)));
          m.redraw();
        };
        
        const onMouseUp = () => {
          vnode.state.isResizing = false;
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          document.body.style.cursor = "default";
        };
        
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "col-resize";
      }
    });
  }
};
