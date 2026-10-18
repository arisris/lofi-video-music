import { editorStore } from "../../store/editor-store";
import { getVisualizer } from "../../lib/visualizers/index";
import { getClipsToSearch } from "../../utils/helpers";
import { updateTimelineClipSettings } from "../../store/actions/timeline-actions";
import { SharedTransformSettingsView, SharedAnimationSettingsView } from "./shared";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the "visualizer" timeline clip. */
export const VisualizerSettingsView = ({ clip }: ClipViewProps) => {
  const clipsToSearch = getClipsToSearch(editorStore.getState());
  const selectedClip =
    clip || clipsToSearch.find((c: any) => c.id === editorStore.getState().selectedClipId && c.type === "visualizer");

  if (!selectedClip) {
    return <div className="text-slate-500 text-xs italic text-center py-8">Select a visualizer from the list to change settings</div>;
  }

  const activeVis = getVisualizer(selectedClip.settings?.style as string) as unknown as
    | { hasReflection?: boolean }
    | undefined;
  const settings = selectedClip.settings as Record<string, any>;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.rainbow}
            className="w-4 h-4 accent-blue-600 rounded"
            onChange={(e) => update({ rainbow: e.target.checked })}
          />
          <span className="text-xs text-slate-300">Rainbow Mode</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-2 flex justify-between items-center">
          <span>Main Color</span>
          <span className="text-slate-500 font-mono">{settings.color}</span>
        </label>
        <input
          type="color"
          value={settings.color}
          className="w-full h-10 bg-transparent cursor-pointer rounded border border-slate-700"
          onChange={(e) => update({ color: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-2">Intensity</label>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={settings.intensity}
            className="w-full accent-blue-500"
            onChange={(e) => update({ intensity: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-2">Opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.opacity}
            className="w-full accent-blue-500"
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="text-xs text-slate-400 mb-2 flex justify-between">
          <span>Size</span>
          <span className="text-slate-500">{`${Math.round((settings.size !== undefined ? settings.size : 1.0) * 100)}%`}</span>
        </label>
        <input
          type="range"
          min={0.2}
          max={3.0}
          step={0.05}
          value={settings.size !== undefined ? settings.size : 1.0}
          className="w-full accent-blue-500"
          onChange={(e) => update({ size: parseFloat(e.target.value) })}
        />
      </div>
      <div className="mt-4">
        <label className="text-xs text-slate-400 mb-2 flex justify-between">
          <span>Density</span>
          <span className="text-slate-500">{(settings.density ?? 1.5).toFixed(1)}</span>
        </label>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={settings.density}
          className="w-full accent-blue-500"
          onChange={(e) => update({ density: parseFloat(e.target.value) })}
        />
      </div>
      {activeVis?.hasReflection && (
        <div className="mt-4">
          <label className="text-xs text-slate-400 mb-2 flex justify-between">
            <span>Reflection Opacity</span>
            <span className="text-slate-500">
              {`${Math.round((settings.reflectionOpacity !== undefined ? settings.reflectionOpacity : 0.25) * 100)}%`}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.reflectionOpacity !== undefined ? settings.reflectionOpacity : 0.25}
            className="w-full accent-blue-500"
            onChange={(e) => update({ reflectionOpacity: parseFloat(e.target.value) })}
          />
        </div>
      )}
      <SharedTransformSettingsView settings={settings} updateSettings={update} />
      <SharedAnimationSettingsView settings={settings} updateSettings={update} />
    </div>
  );
};
