import { editorStore } from "../../../store/editor-store";
import { updateTimelineClipSettings } from "../../../store/actions/timeline-actions";
import { SliderControl, ToggleControl } from "../vfx-controls";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the canvas "fireflies" VFX clip. */
export const FirefliesSettingsView = ({ clip }: ClipViewProps) => {
  const selectedClip =
    clip ||
    editorStore
      .getState()
      .timelineClips.find(
        (c: any) =>
          c.id === editorStore.getState().selectedClipId &&
          c.type === "fireflies",
      );
  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  // Ensure defaults exist
  if (settings.speed === undefined) settings.speed = 1.0;
  if (settings.size === undefined) settings.size = 1.0;
  if (settings.color === undefined) settings.color = "#facc15";
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
        description="Fireflies brightness, speed, and size will react to music volume"
        onChange={(checked) => update({ audioReactive: checked })}
      />

      {/* Color Picker */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
        <label className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
          <span>Firefly Color</span>
          <span className="font-mono text-[10px] text-slate-500">
            {settings.color}
          </span>
        </label>
        <input
          type="color"
          value={settings.color}
          className="h-10 w-full cursor-pointer rounded border border-slate-700 bg-transparent"
          onChange={(e) => update({ color: e.target.value })}
        />
      </div>

      {/* Intensity Slider */}
      <SliderControl
        label={`Fireflies Count: ${settings.intensity || 50}`}
        min={10}
        max={150}
        step={5}
        value={settings.intensity || 50}
        minLabel="Few"
        maxLabel="Swarm"
        onChange={(val) => {
          update({ intensity: val }, { fireflies: null }); // Recreate fireflies list
        }}
      />

      {/* Speed Slider */}
      <SliderControl
        label={`Float Speed: ${Math.round(settings.speed * 100)}%`}
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
        label={`Glow Size: ${Math.round(settings.size * 100)}%`}
        min={0.2}
        max={3.0}
        step={0.1}
        value={settings.size}
        minLabel="Tiny"
        maxLabel="Large"
        onChange={(val) => update({ size: val })}
      />
    </div>
  );
};
