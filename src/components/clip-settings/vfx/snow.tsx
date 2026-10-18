import { editorStore } from "../../../store/editor-store";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { SliderControl, ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the canvas "snow" VFX clip. */
export const SnowSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip ||
    editorStore
      .getState()
      .timelineClips.find(
        (c: any) =>
          c.id === editorStore.getState().selectedClipId && c.type === "snow",
      );
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  // Ensure defaults exist
  if (settings.speed === undefined) settings.speed = 1.0;
  if (settings.size === undefined) settings.size = 1.0;
  if (settings.opacity === undefined) settings.opacity = 0.8;
  if (settings.audioReactive === undefined) settings.audioReactive = false;

  const update = (
    patch: Record<string, unknown>,
    clipPatch: Record<string, unknown> = {},
  ) => updateTimelineClipSettings(selectedClip.id as string, patch, clipPatch);

  return (
    <div className="animate-in fade-in space-y-4 duration-300">
      {/* Audio Reactive Toggle */}
      <ToggleControl
        label="Audio Reactive"
        checked={settings.audioReactive}
        description="Snowfall intensity, speed, and size will react to music volume"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      {/* Intensity Slider */}
      <SliderControl
        label={`Snow Density: ${settings.intensity || 120}`}
        min={20}
        max={300}
        step={10}
        value={settings.intensity || 120}
        minLabel="Light"
        maxLabel="Blizzard"
        onChange={(val) => {
          update({ intensity: val }, { snowballs: null }); // Recreate snowballs with new intensity
        }}
      />

      {/* Speed Slider */}
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

      {/* Size Slider */}
      <SliderControl
        label={`Snowball Size: ${Math.round(settings.size * 100)}%`}
        min={0.2}
        max={4.0}
        step={0.1}
        value={settings.size}
        minLabel="Tiny"
        maxLabel="Fluffy"
        onChange={(val) => update({ size: val })}
      />

      {/* Opacity Slider */}
      <SliderControl
        label={`Snow Opacity: ${Math.round(settings.opacity * 100)}%`}
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
