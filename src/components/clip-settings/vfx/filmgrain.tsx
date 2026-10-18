import { editorStore } from "../../../store/editor-store";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the canvas "filmgrain" VFX clip. */
export const FilmGrainSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip || editorStore.getState().timelineClips.find((c: any) => c.id === editorStore.getState().selectedClipId && c.type === "filmgrain");
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  // Ensure defaults exist
  if (settings.grainIntensity === undefined) settings.grainIntensity = 0.15;
  if (settings.scanlinesOpacity === undefined) settings.scanlinesOpacity = 0.08;
  if (settings.glitchFrequency === undefined) settings.glitchFrequency = 0.3;
  if (settings.audioReactive === undefined) settings.audioReactive = false;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  const sliderRow = (
    label: string,
    key: string,
    min: number,
    max: number,
    step: number,
    minText: string,
    maxText: string,
  ) => (
    <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500"
        value={settings[key] as number}
        onChange={(e) => update({ [key]: parseFloat(e.target.value) })}
      />
      <div className="flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono">
        <span>{minText}</span>
        <span>{maxText}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Audio Reactive Toggle */}
      <ToggleControl
        label="Audio Reactive Glitch"
        checked={settings.audioReactive}
        description="VHS screen glitches will trigger instantly in sync with music bass drops"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      {/* Grain Slider */}
      {sliderRow(
        `Film Grain: ${Math.round(settings.grainIntensity * 100)}%`,
        "grainIntensity",
        0.0,
        0.6,
        0.02,
        "None",
        "Heavy",
      )}

      {/* Scanline Slider */}
      {sliderRow(
        `Scanlines: ${Math.round(settings.scanlinesOpacity * 100)}%`,
        "scanlinesOpacity",
        0.0,
        0.4,
        0.02,
        "None",
        "Visible",
      )}

      {/* Glitch Frequency Slider */}
      {sliderRow(
        `Glitch Frequency / Size: ${Math.round(settings.glitchFrequency * 100)}%`,
        "glitchFrequency",
        0.0,
        1.0,
        0.05,
        "Off",
        "Extreme",
      )}
    </div>
  );
};
