import { ClipRegistry } from "../lib/clips/index";
import { getClipsToSearch } from "../utils/helpers";
import { editorStore, useEditorStore } from "../store/editor-store";
import { updateClipSettings } from "../store/actions/clip-settings";
import { updateTimelineClipSettings, deleteClip } from "../store/actions/timeline-actions";
import { MithrilBridge } from "../compat/mithril-bridge";

type AnyClipSettings = Record<string, any>;

interface HeaderRowProps {
  icon: string;
  name: string;
  enabled: boolean;
  showToggle?: boolean;
  showDelete?: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}

const PanelHeader = ({ icon, name, enabled, showToggle = true, showDelete = false, onToggle, onDelete }: HeaderRowProps) => (
  <div className="flex items-center justify-between mb-5 flex-none">
    <div className="flex items-center gap-2 overflow-hidden flex-1 animate-in fade-in duration-200">
      <i className={`${icon} text-blue-500 w-4 h-4 shrink-0`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200 truncate">{name}</span>
    </div>
    <div className="flex items-center gap-2 shrink-0 ml-2">
      {showToggle && (
        <button
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${enabled ? "bg-blue-600/20 border-blue-600/40 text-blue-400 hover:bg-blue-600/30" : "bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-400"}`}
          title={enabled ? "Disable layer/clip" : "Enable layer/clip"}
          onClick={onToggle}
        >
          <i className={`${enabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} w-4 h-4`} />
        </button>
      )}
      {showDelete && onDelete && (
        <button
          className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-500 hover:text-red-400 hover:bg-red-900/20 hover:border-red-900/30 transition-all cursor-pointer"
          title="Delete Clip"
          onClick={onDelete}
        >
          <i className="icon-[ri--delete-bin-line] w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);

const DisabledBanner = () => (
  <div className="mb-4 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 flex-none">
    <i className="icon-[ri--eye-off-line] w-3.5 h-3.5" />
    This element is currently hidden
  </div>
);

const EmptyState = () => (
  <div className="bg-slate-900 p-8 flex flex-col items-center justify-center h-full w-full text-center text-slate-500">
    <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center mb-4 border border-slate-800">
      <i className="icon-[ri--equalizer-line] w-8 h-8 text-slate-600" />
    </div>
    <h3 className="text-sm font-bold text-slate-400 mb-1">No Clip Selected</h3>
    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
      Select a clip from the timeline or the left Clips Library panel to view and edit its properties here.
    </p>
  </div>
);

/** Right-panel inspector: shows the selected clip's settings and header actions. */
export const ClipsPanel = () => {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const currentRoute = useEditorStore((s) => s.currentRoute);

  // Derive the active clip from the store on each render (legacy semantics).
  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state);
  const timelineClip = clipsToSearch.find((c: any) => c.id === selectedClipId);

  if (timelineClip) {
    const activeClip = ClipRegistry.get(timelineClip.type) as any;
    const settings = timelineClip.settings as AnyClipSettings;
    const isEnabled = settings.enabled !== false;
    const clipName =
      timelineClip.type === "text"
        ? `Text: "${settings.content || ""}"`
        : timelineClip.type === "background"
          ? `Background: ${settings.fileName || "Image/Video"}`
          : timelineClip.type === "overlay"
            ? `Overlay: ${settings.fileName || "Image/Video"}`
            : timelineClip.type === "visualizer"
              ? `Visualizer (${settings.style || "bars"})`
              : activeClip?.name || "Timeline Clip";
    const clipIcon = activeClip?.icon || "icon-[ri--movie-2-line]";

    return (
      <div className="bg-slate-900 p-5 flex flex-col overflow-hidden h-full w-full">
        <PanelHeader
          icon={clipIcon}
          name={clipName}
          enabled={isEnabled}
          showToggle={timelineClip.type !== "music"}
          showDelete
          onToggle={() => updateTimelineClipSettings(timelineClip.id, { enabled: !isEnabled })}
          onDelete={() => deleteClip(selectedClipId)}
        />

        {!isEnabled && <DisabledBanner />}

        {/* Active Clip Setting Content (rendered by legacy Mithril module) */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {activeClip && typeof activeClip.onSettings === "function" ? (
            <MithrilBridge
              key={`${timelineClip.type}-${selectedClipId}-${currentRoute}`}
              render={() => activeClip.onSettings(timelineClip)}
            />
          ) : (
            <div className="text-slate-500 text-xs italic">Preparing clip settings...</div>
          )}
        </div>
      </div>
    );
  }

  // Global layer branch (title / playlist)
  if (selectedClipId === "title" || selectedClipId === "playlist") {
    const globalClip = ClipRegistry.get(selectedClipId) as any;
    const globalSettings = state.clipSettings[selectedClipId] as AnyClipSettings | undefined;
    const globalEnabled = globalSettings?.enabled !== false;
    const globalName = globalClip?.name || "Global Layer";
    const globalIcon = globalClip?.icon || "icon-[ri--layout-line]";

    return (
      <div className="bg-slate-900 p-5 flex flex-col overflow-hidden h-full w-full">
        <PanelHeader
          icon={globalIcon}
          name={globalName}
          enabled={globalEnabled}
          onToggle={() => updateClipSettings(selectedClipId, { enabled: !globalEnabled })}
        />

        {!globalEnabled && <DisabledBanner />}

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {globalClip && typeof globalClip.onSettings === "function" ? (
            <MithrilBridge key={`${selectedClipId}-global`} render={() => globalClip.onSettings(null)} />
          ) : (
            <div className="text-slate-500 text-xs italic">Preparing clip settings...</div>
          )}
        </div>
      </div>
    );
  }

  return <EmptyState />;
};
