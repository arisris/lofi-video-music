// Overlay clip inspector — mirrors src_old/components/clip-settings/overlay.tsx:
// replace media source, video loop (with duration lock), video speed,
// opacity, then Transform + Animations.
import { processMediaFile } from "../../media/media-helper";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { useEditorStore } from "../../../store/editor-store";
import { Card } from "../../../shared/ui/Card";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { Button } from "../../../shared/ui/Button";
import { RangeInput } from "../../../shared/ui/RangeInput";
import { SettingRow, TogglePill } from "../../../shared/ui/SettingRow";
import { AnimationSettings, TransformSettings } from "./TextSettings";

function videosOf(values: Record<string, unknown>): HTMLVideoElement[] {
  const v = values.mediaElements;
  return Array.isArray(v) ? (v as HTMLVideoElement[]) : [];
}

const triggerFilePicker = (onSelect: (file: File) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) onSelect(file);
  };
  input.click();
};

export function OverlaySettingsView({ clipId }: { clipId: string }) {
  const { clip, values, set } = useClipSettings(clipId);
  const updateClip = useEditorStore((s) => s.updateClip);
  if (!clip) return null;

  const mediaType = typeof values.mediaType === "string" ? values.mediaType : "none";
  const loop = values.loop !== false;
  const speed = typeof values.speed === "number" ? values.speed : 1.0;
  const opacity = typeof values.opacity === "number" ? values.opacity : 1.0;

  const toggleLoop = () => {
    const next = !loop;
    set("loop", next);
    // Lock the timeline duration to the video length when loop is turned off.
    if (next === false && typeof values.videoDuration === "number") {
      updateClip(clipId, { duration: values.videoDuration / (speed || 1.0) });
    }
  };

  const setSpeed = (val: number) => {
    videosOf(values).forEach((v) => {
      v.playbackRate = val;
    });
    set("speed", val);
    if (loop === false && typeof values.videoDuration === "number") {
      updateClip(clipId, { duration: values.videoDuration / val });
    }
  };

  const resetSpeed = () => {
    videosOf(values).forEach((v) => {
      v.playbackRate = 1.0;
    });
    set("speed", 1.0);
    if (loop === false && typeof values.videoDuration === "number") {
      updateClip(clipId, { duration: values.videoDuration });
    }
  };

  const replaceMedia = (file: File) => {
    processMediaFile(file, (asset) => {
      const patch: Record<string, unknown> = {
        mediaId: asset.id,
        mediaType: asset.type,
        mediaElement: asset.element ?? null,
        mediaElements: asset.type === "video" ? (asset.elements ?? null) : null,
        gifFrames: asset.gifFrames ?? null,
        gifDuration: asset.gifDuration ?? 0,
        videoDuration: asset.duration ?? 0,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
      };
      if (asset.type === "video") {
        (asset.elements ?? []).forEach((v) => {
          v.playbackRate = speed;
        });
        if (loop === undefined) patch.loop = true;
        if (loop === false && asset.duration) {
          updateClip(clipId, { duration: asset.duration / (speed || 1.0) });
        }
      } else {
        patch.loop = undefined;
      }
      for (const [k, v] of Object.entries(patch)) set(k, v);
    });
  };

  return (
    <InspectorRoot>
      <Card title="Media Settings" spacing="sm">

        <Button variant="secondary" onClick={() => triggerFilePicker(replaceMedia)}>
          <i className="icon-[ri--folder-open-line]" />
          Replace Media Source
        </Button>

        {mediaType === "video" && (
          <div className="mt-2">
            <SettingRow
              title="Loop Video"
              description={loop ? "Loops continuously" : "Locks timeline clip to video length"}
              control={<TogglePill value={loop} onToggle={toggleLoop} />}
            />
          </div>
        )}

        {mediaType === "video" && (
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
                onChange={setSpeed}
                ariaLabel="Video Speed"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800"
              />
              <Button variant="mini" onClick={resetSpeed}>
                Reset
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4">
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
        </div>
      </Card>

      <TransformSettings clipId={clipId} />
      <AnimationSettings clipId={clipId} />
    </InspectorRoot>
  );
}
