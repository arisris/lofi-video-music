import m from "mithril";

// Scrubbable & Manual Input Component
export const ScrubInput = {
  oninit(vnode) {
    vnode.state.isDragging = false;
    vnode.state.isEditing = false;
  },
  view(vnode) {
    const { label, value, onUpdate, step = 1, min = -Infinity, max = Infinity, ghost = false } = vnode.attrs;
    
    return m("div", {
      class: `${ghost ? "" : "bg-slate-800/40 border border-slate-700/50 rounded overflow-hidden"} flex items-center h-7 transition-all group ${vnode.state.isEditing ? "ring-1 ring-blue-500/50" : "hover:border-slate-600"}`,
    }, [
      // Label Area: Used for scrubbing (Only show if label exists)
      label && m("div", { 
        class: "w-6 h-full flex items-center justify-center bg-slate-900/40 text-[10px] font-bold border-r border-slate-700/50 text-slate-500 cursor-ew-resize hover:text-blue-400 transition-colors select-none",
        onmousedown: (e) => {
          vnode.state.isDragging = true;
          vnode.state.startX = e.clientX;
          vnode.state.startValue = value;
          
          const onMouseMove = (me) => {
            if (!vnode.state.isDragging) return;
            const dx = me.clientX - vnode.state.startX;
            let newValue = vnode.state.startValue + dx * step;
            newValue = Math.max(min, Math.min(max, newValue));
            onUpdate(newValue);
            m.redraw();
          };
          
          const onMouseUp = () => {
            vnode.state.isDragging = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
          };
          
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'ew-resize';
        }
      }, label),
      
      // Value Area: Used for manual input
      vnode.state.isEditing 
        ? m("input", {
            type: "number",
            value: value,
            step: step,
            class: "flex-1 bg-slate-900 text-[11px] text-white px-2 outline-none h-full w-full font-mono",
            oncreate: (v) => {
              v.dom.focus();
              v.dom.select();
            },
            onblur: () => vnode.state.isEditing = false,
            oninput: (e) => {
              let val = parseFloat(e.target.value);
              if (!isNaN(val)) {
                val = Math.max(min, Math.min(max, val));
                onUpdate(val);
              }
            },
            onkeydown: (e) => {
              if (e.key === 'Enter') {
                vnode.state.isEditing = false;
              }
              if (e.key === 'Escape') vnode.state.isEditing = false;
            }
          })
        : m("div", { 
            class: "flex-1 text-[11px] text-slate-200 px-2 font-mono flex items-center h-full cursor-text select-none",
            onclick: () => {
              vnode.state.isEditing = true;
              m.redraw();
            }
          }, Math.round(value * 100) / 100)
    ]);
  }
};
