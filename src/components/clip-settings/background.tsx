import { editorStore } from "../../store/editor-store";
import { getClipsToSearch } from "../../utils/helpers";
import { SharedTransformSettingsView, SharedAnimationSettingsView, useThumbnailMode } from "./shared";
import { updateTimelineClipSettings } from "../../store/actions/timeline-actions";

interface ClipViewProps {
  clip?: Record<string, any>;
}

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

/** Settings panel for the "background" timeline clip. */
export const BackgroundSettingsView = ({ clip }: ClipViewProps) => {
  const isThumbnailMode = useThumbnailMode();
  const clipsToSearch = getClipsToSearch(editorStore.getState());
  const selectedClip = clip || clipsToSearch.find((c: any) => c.id === editorStore.getState().selectedClipId && c.type === "background");

  if (!selectedClip) {
    return (
      <div className="text-slate-500 text-xs italic text-center py-8">
        Select a background clip from the list to change settings
      </div>
    );
  }

  const settings = selectedClip.settings as Record<string, any>;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Ken Burns Effect selector */}
      {!isThumbnailMode && (
        <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            Motion / Ken Burns Effect
          </label>
          <div className="relative">
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700/50 transition-colors"
              onChange={(e) => update({ currentEffect: e.target.value })}
              value={settings.currentEffect || "none"}
            >
              {KEN_BURNS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <i className="icon-[ri--arrow-down-s-line] absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>
      )}

      {isThumbnailMode && settings.bgType === "image" && (
        <div className="bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg text-amber-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
          <i className="icon-[ri--alert-line] w-4 h-4 shrink-0" />
          Motion / Ken Burns is disabled in Thumbnail Mode
        </div>
      )}

      {/* Video speed control (only if video) */}
      {settings.bgType === "video" && (
        <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
            <span>Video Speed</span>
            <span className="text-blue-400 font-mono text-[10px]">{`${(settings.speed || 1.0).toFixed(2)}x`}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.25}
              max={4.0}
              step={0.05}
              value={settings.speed || 1.0}
              className="flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (settings.bgElements) {
                  (settings.bgElements as HTMLVideoElement[]).forEach((v) => {
                    v.playbackRate = val;
                  });
                }
                update({ speed: val });
              }}
            />
            <button
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded hover:text-white transition-colors text-[10px]"
              onClick={() => {
                if (settings.bgElements) {
                  (settings.bgElements as HTMLVideoElement[]).forEach((v) => {
                    v.playbackRate = 1.0;
                  });
                }
                update({ speed: 1.0 });
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <SharedTransformSettingsView settings={settings} updateSettings={update} />
      {!isThumbnailMode && <SharedAnimationSettingsView settings={settings} updateSettings={update} />}
    </div>
  );
};
