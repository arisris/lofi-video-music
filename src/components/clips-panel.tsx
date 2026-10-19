import { ClipRegistry } from "../lib/clips/index";
import { getClipsToSearch } from "../utils/helpers";
import { editorStore, useEditorStore } from "../store/editor-store";
import { updateClipSettings } from "../store/actions/clip-settings";
import {
  updateTimelineClipSettings,
  deleteClip,
} from "../store/actions/timeline-actions";

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

const PanelHeader = ({
  icon,
  name,
  enabled,
  showToggle = true,
  showDelete = false,
  onToggle,
  onDelete,
}: HeaderRowProps) => (
  <div className="mb-5 flex flex-none items-center justify-between">
    <div className="animate-in fade-in flex flex-1 items-center gap-2 overflow-hidden duration-200">
      <i className={`${icon} h-4 w-4 shrink-0 text-blue-500`} />
      <span className="truncate text-[10px] font-bold tracking-wider text-slate-200 uppercase">
        {name}
      </span>
    </div>
    <div className="ml-2 flex shrink-0 items-center gap-2">
      {showToggle && (
        <button
          className={`cursor-pointer rounded-lg border p-1.5 transition-all ${enabled ? "border-blue-600/40 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" : "border-slate-700 bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-400"}`}
          title={enabled ? "Disable layer/clip" : "Enable layer/clip"}
          onClick={onToggle}
        >
          <i
            className={`${enabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
          />
        </button>
      )}
      {showDelete && onDelete && (
        <button
          className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-500 transition-all hover:border-red-900/30 hover:bg-red-900/20 hover:text-red-400"
          title="Delete Clip"
          onClick={onDelete}
        >
          <i className="icon-[ri--delete-bin-line] h-4 w-4" />
        </button>
      )}
    </div>
  </div>
);

const DisabledBanner = () => (
  <div className="mb-4 flex flex-none items-center gap-2 rounded-lg border border-amber-700/30 bg-amber-900/20 px-3 py-2 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
    <i className="icon-[ri--eye-off-line] h-3.5 w-3.5" />
    This element is currently hidden
  </div>
);

const EmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-8 text-center text-slate-500">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-950">
      <i className="icon-[ri--equalizer-line] h-8 w-8 text-slate-600" />
    </div>
    <h3 className="mb-1 text-sm font-bold text-slate-400">No Clip Selected</h3>
    <p className="max-w-xs text-xs leading-relaxed text-slate-500">
      Select a clip from the timeline or the left Clips Library panel to view
      and edit its properties here.
    </p>
  </div>
);

/** Right-panel inspector: shows the selected clip's settings and header actions. */
export const ClipsPanel = () => {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const currentRoute = useEditorStore((s) => s.currentRoute);
  const globalSettingsMap = useEditorStore((s) => s.clipSettings);
  // Re-render whenever the active clip source array is replaced, which is how
  // settings patches, uploads and deletes reach this panel.
  useEditorStore((s) =>
    s.currentRoute === "/image" ? s.videoClips : s.timelineClips,
  );

  // Derive the active clip from the store on each render.
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
            : activeClip?.name || "Timeline Clip";
    const clipIcon = activeClip?.icon || "icon-[ri--movie-2-line]";
    const SettingsView = activeClip.onSettings as React.FC<{
      clip?: Record<string, any>;
    }>;

    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900 p-5">
        <PanelHeader
          icon={clipIcon}
          name={clipName}
          enabled={isEnabled}
          showToggle={timelineClip.type !== "music"}
          showDelete
          onToggle={() =>
            updateTimelineClipSettings(timelineClip.id, { enabled: !isEnabled })
          }
          onDelete={() => deleteClip(selectedClipId)}
        />

        {!isEnabled && <DisabledBanner />}

        {/* Active clip settings content (React components from the registry) */}
        <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
          {activeClip && typeof activeClip.onSettings === "function" ? (
            <SettingsView
              key={`${timelineClip.type}-${selectedClipId}-${currentRoute}`}
              clip={timelineClip}
            />
          ) : (
            <div className="text-xs text-slate-500 italic">
              Preparing clip settings...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Global layer branch (title / playlist)
  if (selectedClipId === "title" || selectedClipId === "playlist") {
    const globalClip = ClipRegistry.get(selectedClipId) as any;
    const globalSettings = globalSettingsMap[selectedClipId] as
      AnyClipSettings | undefined;
    const globalEnabled = globalSettings?.enabled !== false;
    const globalName = globalClip?.name || "Global Layer";
    const globalIcon = globalClip?.icon || "icon-[ri--layout-line]";
    const GlobalSettingsView = globalClip.onSettings as React.FC<{
      clip?: Record<string, any>;
    }>;

    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900 p-5">
        <PanelHeader
          icon={globalIcon}
          name={globalName}
          enabled={globalEnabled}
          onToggle={() =>
            updateClipSettings(selectedClipId, { enabled: !globalEnabled })
          }
        />

        {!globalEnabled && <DisabledBanner />}

        <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
          {globalClip && typeof globalClip.onSettings === "function" ? (
            <GlobalSettingsView key={`${selectedClipId}-global`} />
          ) : (
            <div className="text-xs text-slate-500 italic">
              Preparing clip settings...
            </div>
          )}
        </div>
      </div>
    );
  }

  return <EmptyState />;
};
