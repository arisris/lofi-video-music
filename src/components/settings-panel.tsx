import { editorStore, useEditorStore } from "../store/editor-store";

type TransitionStyle = "fade" | "slide" | "zoom";

const TRANSITION_STYLES: Array<[TransitionStyle, string]> = [
  ["fade", "Fade"],
  ["slide", "Slide"],
  ["zoom", "Zoom"],
];

/** Global editor settings: transition style + global overlay layers. */
export const SettingsPanel = () => {
  const transitionStyle = useEditorStore((s) => s.bgTransitionStyle);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const titleEnabled = useEditorStore((s) => s.clipSettings["title"]?.enabled !== false);
  const playlistEnabled = useEditorStore((s) => s.clipSettings["playlist"]?.enabled !== false);

  const setStyle = (style: TransitionStyle) => editorStore.setState({ bgTransitionStyle: style });

  const toggleGlobalLayer = (e: React.MouseEvent, id: "title" | "playlist") => {
    e.stopPropagation();
    const settings = editorStore.getState().clipSettings[id];
    if (settings) {
      settings.enabled = settings.enabled === false ? true : false;
    }
  };

  const selectLayer = (id: "title" | "playlist") =>
    editorStore.setState({ selectedClipId: id, activeClipTab: id });

  return (
    <div className="bg-slate-900 p-5 flex flex-col h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {/* Transition Settings */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2">Transition Style</label>
          <div className="flex gap-2">
            {TRANSITION_STYLES.map(([style, label]) => (
              <button
                key={style}
                className={`flex-1 py-1.5 rounded text-xs transition ${transitionStyle === style ? "bg-blue-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`}
                onClick={() => setStyle(style)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Overlays Settings */}
        <div className="mb-6">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Global Overlays</h3>
          <div className="space-y-2">
            {/* Track Title Layer */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${selectedClipId === "title" ? "bg-blue-600/20 border-blue-500/50" : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60"}`}
              onClick={() => selectLayer("title")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--heading] w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-200">Track Title overlay</span>
              </div>
              <button
                className={`p-1 rounded-md transition-colors ${titleEnabled ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-500"}`}
                onClick={(e) => toggleGlobalLayer(e, "title")}
              >
                <i className={`${titleEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} w-4 h-4`} />
              </button>
            </div>

            {/* Playlist Overlay Layer */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${selectedClipId === "playlist" ? "bg-blue-600/20 border-blue-500/50" : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60"}`}
              onClick={() => selectLayer("playlist")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--list-unordered] w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-200">Playlist Overlay</span>
              </div>
              <button
                className={`p-1 rounded-md transition-colors ${playlistEnabled ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-500"}`}
                onClick={(e) => toggleGlobalLayer(e, "playlist")}
              >
                <i className={`${playlistEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} w-4 h-4`} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg">
          <p className="text-[10px] text-blue-300 leading-relaxed italic">
            <i className="icon-[ri--information-line] inline w-3 h-3 mr-1" />
            Tip: You can drag the image/video in the preview to adjust its composition.
          </p>
        </div>
      </div>
    </div>
  );
};
