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
  <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900/50 p-4">
    <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-1">
      {/* 1. VISUALIZER SECTION */}
      <div className="space-y-4">
        <h3 className="mb-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          Visualizer
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {VisualizerRegistry.map((vis: { id: string; name: string }) => (
            <button
              key={vis.id}
              className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5 text-center transition-all hover:border-blue-500/30 hover:bg-blue-600/10"
              onClick={() => addClipToTimeline("visualizer", { style: vis.id })}
            >
              <i
                className={`${VIS_ICONS[vis.id] ?? DEFAULT_VIS_ICON} h-4.5 w-4.5 text-slate-400 transition-colors group-hover:text-blue-400`}
              />
              <span className="text-[10px] font-bold text-slate-200">
                {vis.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. SHADER VISUALIZER SECTION */}
      <div className="space-y-4">
        <h3 className="mb-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          Shader Visualizer
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {listVisualizerDefs().map((def) => (
            <button
              key={def.id}
              className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5 text-center transition-all hover:border-blue-500/30 hover:bg-blue-600/10"
              onClick={() => addClipToTimeline("glviz", { style: def.id })}
            >
              <i
                className={`${def.icon} h-4.5 w-4.5 text-slate-400 transition-colors group-hover:text-blue-400`}
              />
              <span className="text-[10px] font-bold text-slate-200">
                {def.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. VISUAL EFFECTS SECTION */}
      <div className="space-y-4">
        <h3 className="mb-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          Visual Effects
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {VFXRegistry.map((vfx: { id: string; icon?: string }) => (
            <button
              key={vfx.id}
              className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-700/50 bg-slate-800/40 p-2 text-center transition-all hover:border-blue-500/30 hover:bg-blue-600/10"
              onClick={() => addClipToTimeline(vfx.id)}
            >
              <i
                className={`${vfx.icon ?? DEFAULT_VIS_ICON} h-4.5 w-4.5 text-slate-400 transition-colors group-hover:text-blue-400`}
              />
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
