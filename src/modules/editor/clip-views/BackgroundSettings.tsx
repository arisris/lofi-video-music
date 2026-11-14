// Background clip inspector
// Ken Burns (images only), video loop/speed, opacity, color fill for
// solid/gradient mode, then Transform + Animations.
import { useEditorStore } from "../../../store/editor-store";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { ColorInput } from "../../../shared/ui/ColorInput";
import { FieldLabel } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { RangeInput } from "../../../shared/ui/RangeInput";
import { SelectControl } from "../../../shared/ui/Select";
import { SettingRow, TogglePill } from "../../../shared/ui/SettingRow";
import { AnimationSettings, TransformSettings } from "./TextSettings";

const KEN_BURNS_OPTIONS = [
  { value: "none", label: "None" },
  { value: "random", label: "Random Motion (Wander)" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "panRight", label: "Pan Right" },
  { value: "panLeft", label: "Pan Left" },
  { value: "panUp", label: "Pan Up" },
  { value: "panDown", label: "Pan Down" },
];

function videosOf(values: Record<string, unknown>): HTMLVideoElement[] {
  const v = values.mediaElements;
  return Array.isArray(v) ? (v as HTMLVideoElement[]) : [];
}

export function BackgroundSettingsView({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const updateClip = useEditorStore((s) => s.updateClip);
  const isThumbnailMode = useEditorStore((s) => s.route) === "/image";
  const mediaType =
    typeof values.mediaType === "string" ? values.mediaType : "none";
  const speed = typeof values.speed === "number" ? values.speed : 1.0;
  const opacity = typeof values.opacity === "number" ? values.opacity : 1;
  const loop = values.loop !== false;

  const setSpeed = (val: number) => {
    videosOf(values).forEach((v) => {
      v.playbackRate = val;
    });
    set("speed", val);
    if (loop === false && typeof values.videoDuration === "number") {
      updateClip(clipId, { duration: values.videoDuration / val });
    }
  };

  const toggleLoop = () => {
    const next = !loop;
    set("loop", next);
    // Lock the timeline duration to the video length when loop is turned off.
    if (next === false && typeof values.videoDuration === "number") {
      updateClip(clipId, { duration: values.videoDuration / (speed || 1.0) });
    }
  };

  return (
    <InspectorRoot>
      {!isThumbnailMode && mediaType !== "video" && (
        <Card title="Motion / Ken Burns Effect">
          <SelectControl
            value={
              typeof values.currentEffect === "string"
                ? values.currentEffect
                : "none"
            }
            options={KEN_BURNS_OPTIONS}
            onChange={(v) => set("currentEffect", v)}
            size="md"
          />
        </Card>
      )}

      {!isThumbnailMode && mediaType === "video" && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
          <i className="icon-[ri--information-line] h-4 w-4 shrink-0" />
          Ken Burns applies to images only — videos play as-is
        </div>
      )}

      {isThumbnailMode && mediaType === "image" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-[10px] font-bold tracking-wider text-amber-500 uppercase">
          <i className="icon-[ri--alert-line] h-4 w-4 shrink-0" />
          Motion / Ken Burns is disabled in Thumbnail Mode
        </div>
      )}

      {mediaType === "video" && (
        <Card title="Video" spacing="sm">
          <SettingRow
            title="Loop Video"
            description={
              loop
                ? "Loops continuously"
                : "Locks timeline clip to video length"
            }
            control={<TogglePill value={loop} onToggle={toggleLoop} />}
          />
          <div className="mt-4">
            <label className="mb-1.5 flex justify-between text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
              <span>Video Speed</span>
              <span className="font-mono text-[10px] text-blue-400">{`${speed.toFixed(2)}x`}</span>
            </label>
            <div className="flex items-center gap-3">
              <RangeInput
                value={speed}
                min={0.25}
                max={4.0}
                step={0.05}
                onChange={(v) => setSpeed(v)}
                ariaLabel="Video Speed"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800"
              />
              <Button variant="mini" onClick={() => setSpeed(1.0)}>
                Reset
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Opacity" spacing="sm">
        <label className="mb-2 flex justify-between text-xs text-neutral-400">
          <span>Opacity</span>
          <span className="text-neutral-500">{`${Math.round(opacity * 100)}%`}</span>
        </label>
        <RangeInput
          value={opacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => set("opacity", v)}
          ariaLabel="Opacity"
          className="w-full"
        />
      </Card>

      {mediaType === "none" && (
        <Card title="Solid / Gradient Fill">
          <ColorInput
            label="Color"
            value={typeof values.color === "string" ? values.color : "#0f172a"}
            onUpdate={(val) => set("color", val)}
          />
          <FieldLabel>Style</FieldLabel>
          <SelectControl
            value={typeof values.style === "string" ? values.style : "solid"}
            options={["solid", "gradient"]}
            onChange={(v) => set("style", v)}
            size="sm"
          />
        </Card>
      )}

      <TransformSettings clipId={clipId} />
      {!isThumbnailMode && <AnimationSettings clipId={clipId} />}
    </InspectorRoot>
  );
}
