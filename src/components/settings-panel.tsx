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
  const titleEnabled = useEditorStore(
    (s) => s.clipSettings["title"]?.enabled !== false,
  );
  const playlistEnabled = useEditorStore(
    (s) => s.clipSettings["playlist"]?.enabled !== false,
  );

  const setStyle = (style: TransitionStyle) =>
    editorStore.setState({ bgTransitionStyle: style });

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
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900 p-5">
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        {/* Transition Settings */}
        <div className="mb-4">
          <label className="mb-2 block text-xs text-slate-400">
            Transition Style
          </label>
          <div className="flex gap-2">
            {TRANSITION_STYLES.map(([style, label]) => (
              <button
                key={style}
                className={`flex-1 rounded py-1.5 text-xs transition ${transitionStyle === style ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                onClick={() => setStyle(style)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Overlays Settings */}
        <div className="mb-6">
          <h3 className="mb-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            Global Overlays
          </h3>
          <div className="space-y-2">
            {/* Track Title Layer */}
            <div
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${selectedClipId === "title" ? "border-blue-500/50 bg-blue-600/20" : "border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/60"}`}
              onClick={() => selectLayer("title")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--heading] h-4 w-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-200">
                  Track Title overlay
                </span>
              </div>
              <button
                className={`rounded-md p-1 transition-colors ${titleEnabled ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-500"}`}
                onClick={(e) => toggleGlobalLayer(e, "title")}
              >
                <i
                  className={`${titleEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
                />
              </button>
            </div>

            {/* Playlist Overlay Layer */}
            <div
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${selectedClipId === "playlist" ? "border-blue-500/50 bg-blue-600/20" : "border-slate-700/50 bg-slate-800/40 hover:bg-slate-800/60"}`}
              onClick={() => selectLayer("playlist")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--list-unordered] h-4 w-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-200">
                  Playlist Overlay
                </span>
              </div>
              <button
                className={`rounded-md p-1 transition-colors ${playlistEnabled ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-500"}`}
                onClick={(e) => toggleGlobalLayer(e, "playlist")}
              >
                <i
                  className={`${playlistEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-blue-900/30 bg-blue-900/10 p-3">
          <p className="text-[10px] leading-relaxed text-blue-300 italic">
            <i className="mr-1 icon-[ri--information-line] inline h-3 w-3" />
            Tip: You can drag the image/video in the preview to adjust its
            composition.
          </p>
        </div>
      </div>
    </div>
  );
};
