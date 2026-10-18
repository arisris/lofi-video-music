import { useState } from "react";
import { editorStore } from "../../store/editor-store";
import { applyAudioSettings } from "../../lib/audio";
import { getClipsToSearch } from "../../utils/helpers";
import { updateTimelineClipSettings } from "../../store/actions/timeline-actions";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the "music" timeline clip (volume / speed / pan / EQ). */
export const MusicSettingsView = ({ clip }: ClipViewProps) => {
  const [appliedFeedback, setAppliedFeedback] = useState(false);

  if (!clip) return null;
  const settings = clip.settings as Record<string, any>;

  const patchAudio = (patch: Record<string, unknown>) => {
    updateTimelineClipSettings(clip.id as string, patch);
    // `applyAudioSettings` reads settings off the clip, so feed it a fresh view
    applyAudioSettings({ ...clip, settings: { ...settings, ...patch } });
  };

  const applyToAll = () => {
    const { volume, playbackRate, pan, eqLow, eqMid, eqHigh } = settings;
    const patch = { volume, playbackRate, pan, eqLow, eqMid, eqHigh };
    const state = editorStore.getState();
    const clips = getClipsToSearch(state).filter(
      (c: any) => c.type === "music",
    );
    clips.forEach((c: any) => {
      if (c.id !== clip.id) {
        updateTimelineClipSettings(c.id as string, patch);
      }
    });

    // Update the currently active audio element's settings
    const fresh = getClipsToSearch(editorStore.getState());
    const now = editorStore.getState().currentTime;
    const activeClip = fresh.find(
      (c: any) =>
        c.type === "music" &&
        c.settings?.enabled !== false &&
        now >= c.start &&
        now <= c.start + c.duration,
    );
    if (activeClip) {
      applyAudioSettings(activeClip);
    }

    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 duration-300">
      <div className="space-y-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <div>
          <label className="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase">
            Clip Name
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white transition-colors focus:border-blue-500 focus:outline-none"
            defaultValue={settings.name || ""}
            key={clip.id}
            onChange={(e) => {
              settings.name = e.target.value;
            }}
          />
        </div>

        <div>
          <label className="mb-2 flex justify-between text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Volume</span>
            <span className="font-mono text-blue-400">{`${Math.round((settings.volume ?? 1.0) * 100)}%`}</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={settings.volume ?? 1.0}
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-500"
            onChange={(e) => patchAudio({ volume: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="mb-2 flex justify-between text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Playback Speed</span>
            <span className="font-mono text-blue-400">{`${(settings.playbackRate ?? 1.0).toFixed(2)}x`}</span>
          </label>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={settings.playbackRate ?? 1.0}
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-500"
            onChange={(e) =>
              patchAudio({ playbackRate: parseFloat(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="mb-2 flex justify-between text-xs font-bold tracking-wider text-slate-400 uppercase">
            <span>Stereo Panning</span>
            <span className="font-mono text-blue-400">
              {settings.pan === 0
                ? "Center"
                : settings.pan < 0
                  ? `L ${Math.round(Math.abs(settings.pan) * 100)}%`
                  : `R ${Math.round(settings.pan * 100)}%`}
            </span>
          </label>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={settings.pan ?? 0}
            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-500"
            onChange={(e) => patchAudio({ pan: parseFloat(e.target.value) })}
          />
        </div>

        {/* EQ Section */}
        <div className="space-y-3 border-t border-slate-700/30 pt-2">
          <label className="block text-xs font-bold tracking-wider text-slate-400 uppercase">
            Equalizer (3-Band)
          </label>
          <div className="space-y-2 rounded-lg border border-slate-800/50 bg-slate-950/40 p-3 text-xs">
            {(
              [
                ["Bass", "eqLow"],
                ["Mids", "eqMid"],
                ["Treble", "eqHigh"],
              ] as const
            ).map(([band, key]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="w-12 text-[10px] font-semibold text-slate-400">
                  {band}
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={settings[key] ?? 0}
                  className="mx-3 h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-500"
                  onChange={(e) =>
                    patchAudio({ [key]: parseInt(e.target.value, 10) })
                  }
                />
                <span className="w-12 text-right font-mono text-[10px] text-emerald-400">
                  {`${(settings[key] ?? 0) > 0 ? "+" : ""}${settings[key] ?? 0} dB`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Apply To All Button */}
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs font-bold tracking-wider text-blue-400 uppercase transition-all hover:bg-blue-500 hover:text-white"
          onClick={applyToAll}
        >
          <i
            className={
              appliedFeedback
                ? "icon-[ri--check-line] h-4 w-4 animate-bounce text-emerald-400"
                : "icon-[ri--checkbox-multiple-line] h-4 w-4"
            }
          />
          {appliedFeedback ? "Applied Successfully!" : "Apply to All Clips"}
        </button>

        <div className="space-y-1 rounded-lg border border-slate-800/50 bg-slate-950/40 p-2.5 font-mono text-[10px] text-slate-500">
          <div>
            <span className="font-bold text-slate-400">File Duration: </span>
            {`${settings.audioDuration ? settings.audioDuration.toFixed(2) : 0}s`}
          </div>
          <div>
            <span className="font-bold text-slate-400">Clip Duration: </span>
            {`${clip.duration.toFixed(2)}s`}
          </div>
          <div>
            <span className="font-bold text-slate-400">
              Start Offset (Trim):{" "}
            </span>
            {`${(settings.startOffset || 0).toFixed(2)}s`}
          </div>
          <div>
            <span className="font-bold text-slate-400">Timeline Start: </span>
            {`${clip.start.toFixed(2)}s`}
          </div>
        </div>
      </div>
    </div>
  );
};
