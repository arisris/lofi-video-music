import { listVisualizerDefs } from "../visualizers";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import { vfxRegistry } from "../vfx";
import { addClipOfType } from "../dock/clip-actions";

export const VfxPanel = () => (
  <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900/50 p-4">
    <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-1">
      <div className="space-y-4">
        <SectionTitle className="mb-1">Visualizer</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {listVisualizerDefs().map((def) => (
            <button
              key={def.id}
              className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-2.5 text-center transition-all hover:border-blue-500/30 hover:bg-blue-600/10"
              onClick={() => addClipOfType("glviz", { variant: def.id })}
            >
              <i
                className={`${def.icon} h-4.5 w-4.5 text-neutral-400 transition-colors group-hover:text-blue-400`}
              />
              <span className="text-[10px] font-bold text-neutral-200">
                {def.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionTitle className="mb-1">Visual Effects</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {vfxRegistry.list().map((vfx) => (
            <button
              key={vfx.type}
              className="group flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-2 text-center transition-all hover:border-blue-500/30 hover:bg-blue-600/10"
              onClick={() =>
                addClipOfType(vfx.type, { ...vfx.defaultSettings })
              }
            >
              <i
                className={`${vfx.icon} h-4.5 w-4.5 text-neutral-400 transition-colors group-hover:text-blue-400`}
              />
              <span className="text-[10px] font-bold text-neutral-200">
                {vfx.name ||
                  vfx.type.charAt(0).toUpperCase() + vfx.type.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);
