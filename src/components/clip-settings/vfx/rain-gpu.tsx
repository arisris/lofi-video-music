import { editorStore } from "../../../store/editor-store";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { SliderControl, ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the WebGL "rain_gpu" VFX clip. */
export const RainGpuSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip ||
    editorStore
      .getState()
      .timelineClips.find(
        (c: any) =>
          c.id === editorStore.getState().selectedClipId &&
          c.type === "rain_gpu",
      );
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  if (settings.intensity === undefined) settings.intensity = 200;
  if (settings.speed === undefined) settings.speed = 1.0;
  if (settings.size === undefined) settings.size = 1.0;
  if (settings.opacity === undefined) settings.opacity = 1.0;
  if (settings.audioReactive === undefined) settings.audioReactive = false;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="animate-in fade-in space-y-4 duration-300">
      <ToggleControl
        label="Audio Reactive"
        checked={settings.audioReactive}
        description="Rain intensity, speed, and opacity will react to music volume"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      <SliderControl
        label={`Rain Intensity: ${settings.intensity || 200}`}
        min={50}
        max={500}
        step={10}
        value={settings.intensity || 200}
        minLabel="Light"
        maxLabel="Heavy"
        onChange={(val) => update({ intensity: val })}
      />

      <SliderControl
        label={`Fall Speed: ${Math.round(settings.speed * 100)}%`}
        min={0.1}
        max={3.0}
        step={0.1}
        value={settings.speed}
        minLabel="Slow"
        maxLabel="Fast"
        onChange={(val) => update({ speed: val })}
      />

      <SliderControl
        label={`Drop Size: ${Math.round(settings.size * 100)}%`}
        min={0.2}
        max={3.0}
        step={0.1}
        value={settings.size}
        minLabel="Thin/Short"
        maxLabel="Thick/Long"
        onChange={(val) => update({ size: val })}
      />

      <SliderControl
        label={`Rain Opacity: ${Math.round(settings.opacity * 100)}%`}
        min={0.1}
        max={1.0}
        step={0.05}
        value={settings.opacity}
        minLabel="Faint"
        maxLabel="Solid"
        onChange={(val) => update({ opacity: val })}
      />
    </div>
  );
};
