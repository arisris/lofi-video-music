import { State } from "../../lib/state";
import { editorStore } from "../../store/editor-store";
import { getClipsToSearch } from "../../utils/helpers";
import { processOverlayUpload } from "../../lib/clips/overlay-clip";
import { bumpClips, updateTimelineClipSettings } from "../../store/actions/timeline-actions";
import { SharedTransformSettingsView, SharedAnimationSettingsView } from "./shared";

const triggerFilePicker = (onSelect: (file: File) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      onSelect(file);
    }
  };
  input.click();
};

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the "overlay" timeline clip. */
export const OverlaySettingsView = ({ clip }: ClipViewProps) => {
  const clipsToSearch = getClipsToSearch(editorStore.getState());
  const selectedClip = clip || clipsToSearch.find((c: any) => c.id === State.selectedClipId && c.type === "overlay");

  if (!selectedClip) return null;

  const settings = selectedClip.settings as Record<string, any>;

  const update = (patch: Record<string, unknown>, clipPatch: Record<string, unknown> = {}) =>
    updateTimelineClipSettings(selectedClip.id as string, patch, clipPatch);

  const toggleLoop = () => {
    const next = settings.loop === false;
    const patch: Record<string, unknown> = { loop: next };
    const clipPatch: Record<string, unknown> = {};
    // Enforce duration locking when looping is disabled
    if (next === false && settings.videoDuration) {
      clipPatch.duration = settings.videoDuration / (settings.speed || 1.0);
    }
    update(patch, clipPatch);
  };

  const setSpeed = (val: number) => {
    const clipPatch: Record<string, unknown> = {};
    // Adjust duration if loop is disabled
    if (settings.loop === false && settings.videoDuration) {
      clipPatch.duration = settings.videoDuration / val;
    }
    if (settings.mediaElements) {
      settings.mediaElements.forEach((v: HTMLVideoElement) => {
        v.playbackRate = val;
      });
    }
    update({ speed: val }, clipPatch);
  };

  const resetSpeed = () => {
    if (settings.mediaElements) {
      settings.mediaElements.forEach((v: HTMLVideoElement) => {
        v.playbackRate = 1.0;
      });
    }
    update({ speed: 1.0 }, settings.loop === false && settings.videoDuration ? { duration: settings.videoDuration } : {});
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Change File Button */}
      <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-3">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Media Settings</label>

        <button
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 flex items-center justify-center gap-2 transition-all"
          onClick={() => {
            triggerFilePicker((file) => {
              processOverlayUpload(file, selectedClip, () => bumpClips());
            });
          }}
        >
          <i className="icon-[ri--folder-open-line]" />
          Replace Media Source
        </button>

        {/* Loop Video Option (Only for Video overlays) */}
        {settings.mediaType === "video" && (
          <div className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-300">Loop Video</span>
              <span className="text-[9px] text-slate-500">
                {settings.loop ? "Loops continuously" : "Locks timeline clip to video length"}
              </span>
            </div>
            <button
              className={`w-8 h-4 rounded-full relative transition-colors ${
                settings.loop !== false ? "bg-blue-600" : "bg-slate-700"
              }`}
              onClick={toggleLoop}
            >
              <div
                className={`absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${
                  settings.loop !== false ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        )}

        {/* Video speed control (only if video overlay) */}
        {settings.mediaType === "video" && (
          <div className="mt-4">
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
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
              />
              <button
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded hover:text-white transition-colors text-[10px]"
                onClick={resetSpeed}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Opacity slider */}
        <div className="mt-4">
          <label className="block text-xs text-slate-400 mb-2 flex justify-between">
            <span>Opacity</span>
            <span className="text-slate-500">
              {`${Math.round((settings.opacity !== undefined ? settings.opacity : 1.0) * 100)}%`}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.opacity !== undefined ? settings.opacity : 1.0}
            className="w-full accent-blue-500"
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <SharedTransformSettingsView settings={settings} updateSettings={update} />
      <SharedAnimationSettingsView settings={settings} updateSettings={update} />
    </div>
  );
};
