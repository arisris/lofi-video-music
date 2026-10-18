import { editorStore } from "../../../store/editor-store";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the canvas "flash" VFX clip. */
export const FlashSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip || editorStore.getState().timelineClips.find((c: any) => c.id === editorStore.getState().selectedClipId && c.type === "flash");
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  if (settings.audioReactive === undefined) settings.audioReactive = false;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Audio Reactive Toggle */}
      <ToggleControl
        label="Audio Reactive"
        checked={settings.audioReactive}
        description="Lightning will flash in sync with the song's bass beats"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      {/* Flash Frequency Slider */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
          {`Flash Frequency: ${Math.round((settings.frequency || 0.5) * 100)}%`}
        </label>
        <input
          type="range"
          min={0.1}
          max={1.0}
          step={0.05}
          className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500"
          value={settings.frequency || 0.5}
          onChange={(e) => update({ frequency: parseFloat(e.target.value) })}
        />
        <div className="flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono">
          <span>Rare</span>
          <span>Frequent</span>
        </div>
      </div>
    </div>
  );
};
