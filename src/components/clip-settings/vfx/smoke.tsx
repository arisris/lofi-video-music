import { State } from "../../../lib/state";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { SliderControl, ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the canvas "smoke" VFX clip. */
export const SmokeSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip || State.timelineClips.find((c: any) => c.id === State.selectedClipId && c.type === "smoke");
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  if (settings.audioReactive === undefined) settings.audioReactive = false;

  const update = (patch: Record<string, unknown>, clipPatch: Record<string, unknown> = {}) =>
    updateTimelineClipSettings(selectedClip.id as string, patch, clipPatch);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Audio Reactive Toggle */}
      <ToggleControl
        label="Audio Reactive"
        checked={settings.audioReactive}
        description="Smoke speed, drift, growth, and density will react to music bass beats"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      {/* Intensity Slider */}
      <SliderControl
        label={`Smoke Density: ${settings.intensity || 40}`}
        min={10}
        max={150}
        step={5}
        value={settings.intensity || 40}
        minLabel="Mist"
        maxLabel="Thick"
        onChange={(val) => {
          update({ intensity: val }, { particles: null }); // Recreate particles with new intensity
        }}
      />
    </div>
  );
};
