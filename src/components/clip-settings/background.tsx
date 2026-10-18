import { editorStore } from "../../store/editor-store";
import { getClipsToSearch } from "../../utils/helpers";
import {
  SharedTransformSettingsView,
  SharedAnimationSettingsView,
  useThumbnailMode,
} from "./shared";
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
  const selectedClip =
    clip ||
    clipsToSearch.find(
      (c: any) =>
        c.id === editorStore.getState().selectedClipId &&
        c.type === "background",
    );

  if (!selectedClip) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 italic">
        Select a background clip from the list to change settings
      </div>
    );
  }

  const settings = selectedClip.settings as Record<string, any>;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 duration-300">
      {/* Ken Burns Effect selector */}
      {!isThumbnailMode && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
          <label className="mb-3 block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            Motion / Ken Burns Effect
          </label>
          <div className="relative">
            <select
              className="w-full cursor-pointer appearance-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors outline-none hover:bg-slate-700/50 focus:border-blue-500/50"
              onChange={(e) => update({ currentEffect: e.target.value })}
              value={settings.currentEffect || "none"}
            >
              {KEN_BURNS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <i className="pointer-events-none absolute top-1/2 right-2 icon-[ri--arrow-down-s-line] -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      )}

      {isThumbnailMode && settings.bgType === "image" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-[10px] font-bold tracking-wider text-amber-500 uppercase">
          <i className="icon-[ri--alert-line] h-4 w-4 shrink-0" />
          Motion / Ken Burns is disabled in Thumbnail Mode
        </div>
      )}

      {/* Video speed control (only if video) */}
      {settings.bgType === "video" && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4">
          <label className="mb-1.5 flex justify-between text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            <span>Video Speed</span>
            <span className="font-mono text-[10px] text-blue-400">{`${(settings.speed || 1.0).toFixed(2)}x`}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.25}
              max={4.0}
              step={0.05}
              value={settings.speed || 1.0}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
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
              className="rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
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

      <SharedTransformSettingsView
        settings={settings}
        updateSettings={update}
      />
      {!isThumbnailMode && (
        <SharedAnimationSettingsView
          settings={settings}
          updateSettings={update}
        />
      )}
    </div>
  );
};
