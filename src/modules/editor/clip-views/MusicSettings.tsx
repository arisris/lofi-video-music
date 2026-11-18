// Music clip inspector
// name, volume/speed/pan (applied live to the audio engine), 3-band EQ,
// Apply to All Clips, and the duration/offset info box.
import { useState } from "react";
import { applyAudioSettings } from "../../audio/audio-engine";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { useEditorStore } from "../../../store/editor-store";
import { Card } from "../../../shared/ui/Card";
import { Button } from "../../../shared/ui/Button";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { RangeInput } from "../../../shared/ui/RangeInput";

export function MusicSettingsView({ clipId }: { clipId: string }) {
  const { clip, values, set } = useClipSettings(clipId);
  const [appliedFeedback, setAppliedFeedback] = useState(false);
  if (!clip) return null;

  const patchAudio = (patch: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(patch)) set(k, v);
    // `applyAudioSettings` reads settings from the clip, so pass an updated view.
    applyAudioSettings({ settings: { ...values, ...patch } });
  };

  const applyToAll = () => {
    const { volume, playbackRate, pan, eqLow, eqMid, eqHigh } = values;
    const patch = { volume, playbackRate, pan, eqLow, eqMid, eqHigh };
    const st = useEditorStore.getState();
    st.clips
      .filter((c) => c.type === "music" && c.id !== clipId)
      .forEach((c) => st.updateClipSettings(c.id, patch));
    const now = useEditorStore.getState().currentTime;
    const active = useEditorStore
      .getState()
      .clips.find(
        (c) =>
          c.type === "music" &&
          c.settings.enabled !== false &&
          now >= c.start &&
          now <= c.start + c.duration,
      );
    if (active) applyAudioSettings(active);
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2000);
  };

  const volume = typeof values.volume === "number" ? values.volume : 1.0;
  const rate =
    typeof values.playbackRate === "number" ? values.playbackRate : 1.0;
  const pan = typeof values.pan === "number" ? values.pan : 0;

  return (
    <InspectorRoot>
      <Card spacing="md" radius="xl" padding="md">
        <div>
          <label className="mb-2 block text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Clip Name
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white transition-colors focus:border-blue-500 focus:outline-none"
            defaultValue={typeof values.name === "string" ? values.name : ""}
            key={clip.id}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-2 flex justify-between text-xs font-bold tracking-wider text-neutral-400 uppercase">
            <span>Volume</span>
            <span className="font-mono text-blue-400">{`${Math.round(volume * 100)}%`}</span>
          </label>
          <RangeInput
            value={volume}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => patchAudio({ volume: v })}
            ariaLabel="Volume"
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800"
          />
        </div>

        <div>
          <label className="mb-2 flex justify-between text-xs font-bold tracking-wider text-neutral-400 uppercase">
            <span>Playback Speed</span>
            <span className="font-mono text-blue-400">{`${rate.toFixed(2)}x`}</span>
          </label>
          <RangeInput
            value={rate}
            min={0.5}
            max={1.5}
            step={0.05}
            onChange={(v) => patchAudio({ playbackRate: v })}
            ariaLabel="Playback Speed"
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800"
          />
        </div>

        <div>
          <label className="mb-2 flex justify-between text-xs font-bold tracking-wider text-neutral-400 uppercase">
            <span>Stereo Panning</span>
            <span className="font-mono text-blue-400">
              {pan === 0
                ? "Center"
                : pan < 0
                  ? `L ${Math.round(Math.abs(pan) * 100)}%`
                  : `R ${Math.round(pan * 100)}%`}
            </span>
          </label>
          <RangeInput
            value={pan}
            min={-1}
            max={1}
            step={0.1}
            onChange={(v) => patchAudio({ pan: v })}
            ariaLabel="Stereo Panning"
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800"
          />
        </div>

        <div className="space-y-3 border-t border-neutral-700/30 pt-2">
          <label className="block text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Equalizer (3-Band)
          </label>
          <div className="space-y-2 rounded-lg border border-neutral-800/50 bg-neutral-950/40 p-3 text-xs">
            {(
              [
                ["Bass", "eqLow"],
                ["Mids", "eqMid"],
                ["Treble", "eqHigh"],
              ] as const
            ).map(([band, key]) => {
              const v =
                typeof values[key] === "number" ? (values[key] as number) : 0;
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="w-12 text-[10px] font-semibold text-neutral-400">
                    {band}
                  </span>
                  <RangeInput
                    value={v}
                    min={-12}
                    max={12}
                    step={1}
                    onChange={(v) => patchAudio({ [key]: Math.round(v) })}
                    accent="emerald"
                    ariaLabel={band}
                    className="mx-3 h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-neutral-800"
                  />
                  <span className="w-12 text-right font-mono text-[10px] text-emerald-400">
                    {`${v > 0 ? "+" : ""}${v} dB`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Button variant="primary" onClick={applyToAll}>
          <i
            className={
              appliedFeedback
                ? "icon-[ri--check-line] h-4 w-4 animate-bounce text-emerald-400"
                : "icon-[ri--checkbox-multiple-line] h-4 w-4"
            }
          />
          {appliedFeedback ? "Applied Successfully!" : "Apply to All Clips"}
        </Button>

        <div className="space-y-1 rounded-lg border border-neutral-800/50 bg-neutral-950/40 p-2.5 font-mono text-[10px] text-neutral-500">
          <div>
            <span className="font-bold text-neutral-400">File Duration: </span>
            {`${typeof values.audioDuration === "number" ? values.audioDuration.toFixed(2) : 0}s`}
          </div>
          <div>
            <span className="font-bold text-neutral-400">Clip Duration: </span>
            {`${clip.duration.toFixed(2)}s`}
          </div>
          <div>
            <span className="font-bold text-neutral-400">
              Start Offset (Trim):{" "}
            </span>
            {`${(typeof values.startOffset === "number" ? values.startOffset : 0).toFixed(2)}s`}
          </div>
          <div>
            <span className="font-bold text-neutral-400">Timeline Start: </span>
            {`${clip.start.toFixed(2)}s`}
          </div>
        </div>
      </Card>
    </InspectorRoot>
  );
}
