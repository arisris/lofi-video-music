import { editorStore } from "../../store/editor-store";
import { updateClipSettings } from "../../store/actions/clip-settings";
import { SharedTextSettingsView, SharedTransformSettingsView } from "./shared";

/** Settings panel for the global "playlist" overlay layer. */
export const PlaylistSettingsView = (_props: { clip?: Record<string, any> }) => {
  const settings = editorStore.getState().clipSettings["playlist"] as Record<string, any> | undefined;

  if (!settings) return null;

  const update = (patch: Record<string, unknown>) => updateClipSettings("playlist", patch);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-2">Max Tracks</label>
          <input
            type="range"
            min={3}
            max={15}
            step={1}
            value={settings.maxItems}
            className="w-full accent-blue-500"
            onChange={(e) => update({ maxItems: parseInt(e.target.value, 10) })}
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            className={`flex items-center justify-between px-3 h-8 rounded-lg transition-colors ${
              settings.truncateText
                ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
            onClick={() => update({ truncateText: !settings.truncateText })}
          >
            <span className="text-[10px] font-bold uppercase">Truncate</span>
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                settings.truncateText ? "bg-blue-400" : "bg-slate-600"
              }`}
            />
          </button>
        </div>
      </div>
      <SharedTextSettingsView settings={settings} updateSettings={update} />
      <SharedTransformSettingsView settings={settings} updateSettings={update} />
    </>
  );
};
