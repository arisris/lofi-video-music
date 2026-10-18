import { addClipToTimeline } from "../lib/clip-factory";
import { VisualizerRegistry } from "../lib/visualizers/index";
import { listVisualizerDefs } from "../lib/gl-viz";
import { VFXRegistry } from "../lib/vfx/index";

const VIS_ICONS: Record<string, string> = {
  bars: "icon-[ri--bar-chart-2-line]",
  circle: "icon-[ri--donut-chart-line]",
  waveform: "icon-[ri--pulse-line]",
  blocks: "icon-[ri--apps-2-line]",
  "liquid-waves": "icon-[ri--water-flash-line]",
};

const DEFAULT_VIS_ICON = "icon-[ri--pulse-line]";

/** Built-in visualizer + visual effect clip palette. */
export const VFXPanel = () => (
  <div className="bg-slate-900/50 p-4 flex flex-col h-full w-full overflow-hidden">
    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
      {/* 1. VISUALIZER SECTION */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Visualizer</h3>
        <div className="grid grid-cols-2 gap-2">
          {VisualizerRegistry.map((vis: { id: string; name: string }) => (
            <button
              key={vis.id}
              className="p-2.5 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 group cursor-pointer"
              onClick={() => addClipToTimeline("visualizer", { style: vis.id })}
            >
              <i className={`${VIS_ICONS[vis.id] ?? DEFAULT_VIS_ICON} w-4.5 h-4.5 text-slate-400 group-hover:text-blue-400 transition-colors`} />
              <span className="text-[10px] font-bold text-slate-200">{vis.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. SHADER VISUALIZER SECTION */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Shader Visualizer</h3>
        <div className="grid grid-cols-2 gap-2">
          {listVisualizerDefs().map((def) => (
            <button
              key={def.id}
              className="p-2.5 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 group cursor-pointer"
              onClick={() => addClipToTimeline("glviz", { style: def.id })}
            >
              <i className={`${def.icon} w-4.5 h-4.5 text-slate-400 group-hover:text-blue-400 transition-colors`} />
              <span className="text-[10px] font-bold text-slate-200">{def.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. VISUAL EFFECTS SECTION */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Visual Effects</h3>
        <div className="grid grid-cols-3 gap-2">
          {VFXRegistry.map((vfx: { id: string; icon?: string }) => (
            <button
              key={vfx.id}
              className="p-2 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 group cursor-pointer"
              onClick={() => addClipToTimeline(vfx.id)}
            >
              <i className={`${vfx.icon ?? DEFAULT_VIS_ICON} w-4.5 h-4.5 text-slate-400 group-hover:text-blue-400 transition-colors`} />
              <span className="text-[10px] font-bold text-slate-200">
                {vfx.id.charAt(0).toUpperCase() + vfx.id.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);
