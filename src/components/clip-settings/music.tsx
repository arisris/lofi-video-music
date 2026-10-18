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
    const clips = getClipsToSearch(state).filter((c: any) => c.type === "music");
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
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Clip Name</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
            defaultValue={settings.name || ""}
            key={clip.id}
            onChange={(e) => {
              settings.name = e.target.value;
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
            <span>Volume</span>
            <span className="text-blue-400 font-mono">{`${Math.round((settings.volume ?? 1.0) * 100)}%`}</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={settings.volume ?? 1.0}
            className="w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
            onChange={(e) => patchAudio({ volume: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
            <span>Playback Speed</span>
            <span className="text-blue-400 font-mono">{`${(settings.playbackRate ?? 1.0).toFixed(2)}x`}</span>
          </label>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={settings.playbackRate ?? 1.0}
            className="w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
            onChange={(e) => patchAudio({ playbackRate: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
            <span>Stereo Panning</span>
            <span className="text-blue-400 font-mono">
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
            className="w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
            onChange={(e) => patchAudio({ pan: parseFloat(e.target.value) })}
          />
        </div>

        {/* EQ Section */}
        <div className="space-y-3 pt-2 border-t border-slate-700/30">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Equalizer (3-Band)</label>
          <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50 text-xs">
            {(
              [
                ["Bass", "eqLow"],
                ["Mids", "eqMid"],
                ["Treble", "eqHigh"],
              ] as const
            ).map(([band, key]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="w-12 text-slate-400 text-[10px] font-semibold">{band}</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={settings[key] ?? 0}
                  className="flex-1 mx-3 h-1 accent-emerald-500 cursor-pointer bg-slate-800 rounded-lg appearance-none"
                  onChange={(e) => patchAudio({ [key]: parseInt(e.target.value, 10) })}
                />
                <span className="w-12 text-right text-emerald-400 font-mono text-[10px]">
                  {`${(settings[key] ?? 0) > 0 ? "+" : ""}${settings[key] ?? 0} dB`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Apply To All Button */}
        <button
          className="w-full py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider hover:bg-blue-500 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
          onClick={applyToAll}
        >
          <i
            className={
              appliedFeedback
                ? "icon-[ri--check-line] w-4 h-4 text-emerald-400 animate-bounce"
                : "icon-[ri--checkbox-multiple-line] w-4 h-4"
            }
          />
          {appliedFeedback ? "Applied Successfully!" : "Apply to All Clips"}
        </button>

        <div className="text-[10px] text-slate-500 space-y-1 bg-slate-950/40 p-2.5 rounded-lg font-mono border border-slate-800/50">
          <div>
            <span className="text-slate-400 font-bold">File Duration: </span>
            {`${settings.audioDuration ? settings.audioDuration.toFixed(2) : 0}s`}
          </div>
          <div>
            <span className="text-slate-400 font-bold">Clip Duration: </span>
            {`${clip.duration.toFixed(2)}s`}
          </div>
          <div>
            <span className="text-slate-400 font-bold">Start Offset (Trim): </span>
            {`${(settings.startOffset || 0).toFixed(2)}s`}
          </div>
          <div>
            <span className="text-slate-400 font-bold">Timeline Start: </span>
            {`${clip.start.toFixed(2)}s`}
          </div>
        </div>
      </div>
    </div>
  );
};
