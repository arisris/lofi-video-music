// Background clip inspector: unified motion (preset → editable keyframes),
// video loop/speed, opacity, color fill for solid/gradient mode, then Transform.
// Boundary transitions live in the dedicated TransitionPanel.
import { useEffect, useState } from "react";
import { useEditorStore } from "../../../store/editor-store";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { getDesignSize } from "../../../shared/lib/canvas-space";
import {
  MOTION_PRESET_OPTIONS,
  buildPresetKeyframes,
  hasMotionKeyframes,
} from "../../../shared/lib/motion-keyframes";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { ColorInput } from "../../../shared/ui/ColorInput";
import { FieldLabel } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { RangeInput } from "../../../shared/ui/RangeInput";
import { SelectControl } from "../../../shared/ui/Select";
import { SettingRow, TogglePill } from "../../../shared/ui/SettingRow";
import { TransformSettings } from "./TextSettings";
import { MotionKeyframesCard } from "./MotionKeyframes";

function videosOf(values: Record<string, unknown>): HTMLVideoElement[] {
  const v = values.mediaElements;
  return Array.isArray(v) ? (v as HTMLVideoElement[]) : [];
}

export function BackgroundSettingsView({ clipId }: { clipId: string }) {
  const { clip, values, set } = useClipSettings(clipId);
  const updateClip = useEditorStore((s) => s.updateClip);
  const isThumbnailMode = useEditorStore((s) => s.route) === "/image";
  const mediaType =
    typeof values.mediaType === "string" ? values.mediaType : "none";
  const speed = typeof values.speed === "number" ? values.speed : 1.0;
  const opacity = typeof values.opacity === "number" ? values.opacity : 1;
  const loop = values.loop !== false;
  const duration =
    typeof clip?.duration === "number" && clip.duration > 0
      ? clip.duration
      : 60;
  // Preset picker state: last applied template, "custom" after any hand
  // edit (stamped by MotionKeyframesCard), "none" when cleared.
  const motionPreset =
    typeof values.motionPreset === "string" ? values.motionPreset : null;
  const keyframed = hasMotionKeyframes(values.motionKeyframes, duration);
  const presetValue = motionPreset ?? (keyframed ? "custom" : "none");
  // Pending preset switch awaiting reset confirmation (dirty edits exist).
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  // A pending switch belongs to its clip — drop it when selection changes.
  useEffect(() => setPendingPreset(null), [clipId]);
  const audioPulse =
    typeof values.audioPulse === "number" ? values.audioPulse : 0;

  const requestPreset = (preset: string) => {
    if (preset === presetValue || preset === "custom") return;
    // Switching away from hand-edited keyframes destroys them — confirm.
    if (presetValue === "custom") {
      setPendingPreset(preset);
      return;
    }
    applyPreset(preset);
  };

  const pendingLabel =
    pendingPreset === "none"
      ? "None"
      : (MOTION_PRESET_OPTIONS.find((o) => o.value === pendingPreset)?.label ??
        pendingPreset);

  const applyPreset = (preset: string) => {
    if (preset === "custom") return;
    if (preset === "none") {
      set("motionKeyframes", []);
      set("motionPreset", "none");
      return;
    }
    const { w, h } = getDesignSize();
    set("motionKeyframes", buildPresetKeyframes(preset, duration, w, h));
    set("motionPreset", preset);
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
      {/* Unified motion: a preset expands into editable keyframes below.
          Applies to every media kind, including video. */}
      {!isThumbnailMode && mediaType !== "none" && (
        <Card title="Motion">
          <SelectControl
            value={presetValue}
            options={
              presetValue === "custom"
                ? [...MOTION_PRESET_OPTIONS, { value: "custom", label: "Custom (edited)" }]
                : MOTION_PRESET_OPTIONS
            }
            onChange={requestPreset}
            size="md"
            ariaLabel="Motion preset"
          />
          <p className="mt-2 text-[10px] leading-snug text-neutral-500">
            A preset writes editable keyframes — tweak every point below.
          </p>
          <div className="mt-3">
            <label className="mb-1.5 flex justify-between text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
              <span>Audio Pulse</span>
              <span className="font-mono text-[10px] text-blue-400">{`${Math.round(audioPulse * 100)}%`}</span>
            </label>
            <div className="flex items-center gap-2">
              <RangeInput
                value={audioPulse}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => set("audioPulse", v)}
                ariaLabel="Audio pulse amount"
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800"
              />
              <Button variant="mini" onClick={() => set("audioPulse", 0)}>
                Reset
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-neutral-600">
              Zoom breathes with the bass while playing.
            </p>
          </div>
          {pendingPreset !== null && (
            <div
              role="alertdialog"
              aria-label="Confirm preset switch"
              className="mt-2 rounded-lg border border-amber-800/50 bg-amber-950/25 p-2.5"
            >
              <p className="text-[10px] leading-snug text-amber-200/90">
                Switch to {pendingLabel}? Your edited keyframes will be
                replaced.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    applyPreset(pendingPreset);
                    setPendingPreset(null);
                  }}
                  title={`Replace keyframes with ${pendingLabel}`}
                >
                  <span className="text-[10px]">Replace</span>
                </Button>
                <Button
                  variant="mini"
                  onClick={() => setPendingPreset(null)}
                  title="Keep editing current keyframes"
                >
                  Keep editing
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {isThumbnailMode && mediaType === "image" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-[10px] font-bold tracking-wider text-amber-500 uppercase">
          <i className="icon-[ri--alert-line] h-4 w-4 shrink-0" />
          Motion is disabled in Thumbnail Mode
        </div>
      )}

      {/* Explicit keyframes: image/gif/video. Unlike the preset they also
          drive video, and 2+ keyframes override the preset above. */}
      {!isThumbnailMode && mediaType !== "none" && (
        <MotionKeyframesCard clipId={clipId} />
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
    </InspectorRoot>
  );
}
