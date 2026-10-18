import { editorStore } from "../../../store/editor-store";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the canvas "vignette" VFX clip. */
export const VignetteSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip || editorStore.getState().timelineClips.find((c: any) => c.id === editorStore.getState().selectedClipId && c.type === "vignette");
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  // Ensure defaults exist
  if (settings.opacity === undefined) settings.opacity = 0.4;
  if (settings.color === undefined) settings.color = "#000000";
  if (settings.audioReactive === undefined) settings.audioReactive = false;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Audio Reactive Toggle */}
      <ToggleControl
        label="Audio Reactive"
        checked={settings.audioReactive}
        description="Vignette shadow will expand and pulse to the music bass beats"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      {/* Color Picker */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
        <label className="block text-xs text-slate-400 mb-2 flex justify-between items-center font-bold">
          <span>Shadow Color</span>
          <span className="text-slate-500 font-mono text-[10px]">{settings.color}</span>
        </label>
        <input
          type="color"
          value={settings.color}
          className="w-full h-10 bg-transparent cursor-pointer rounded border border-slate-700"
          onChange={(e) => update({ color: e.target.value })}
        />
      </div>

      {/* Opacity Slider */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
          {`Vignette Opacity: ${Math.round(settings.opacity * 100)}%`}
        </label>
        <input
          type="range"
          min={0.0}
          max={1.0}
          step={0.05}
          className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500"
          value={settings.opacity}
          onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
        />
        <div className="flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono">
          <span>Faint</span>
          <span>Solid</span>
        </div>
      </div>
    </div>
  );
};
