import { editorStore } from "../../store/editor-store";
import { closeContextMenu } from "./drag";
import {
  cloneVids,
  cloneMediaElement,
  revokeClipUrls,
} from "../../utils/helpers";

export function TimelineContextMenu({
  state,
  contextMenu,
}: {
  state: any;
  contextMenu: { x: number; y: number; clipId: string } | null;
}) {
  if (!contextMenu) return null;

  return (
    <div
      id="timeline-context-menu"
      className="fixed z-9999 min-w-35 rounded-lg border border-slate-700/80 bg-slate-900 py-1.5 shadow-2xl"
      style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-blue-600/20 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          const original = state.timelineClips.find(
            (c: any) => c.id === contextMenu?.clipId,
          );
          if (original) {
            const settingsCopy = JSON.parse(
              JSON.stringify(original.settings),
            );
            if (original.settings.mediaElement)
              settingsCopy.mediaElement = cloneMediaElement(
                original.settings.mediaElement,
              );
            if (original.settings.mediaElements)
              settingsCopy.mediaElements = cloneVids(
                original.settings.mediaElements,
              );
            if (original.settings.bgElement)
              settingsCopy.bgElement = cloneMediaElement(
                original.settings.bgElement,
              );
            if (original.settings.bgElements)
              settingsCopy.bgElements = cloneVids(
                original.settings.bgElements,
              );
            if (original.settings.gifFrames)
              settingsCopy.gifFrames = original.settings.gifFrames;

            const duplicate = {
              id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
              type: original.type,
              trackId: original.trackId,
              start:
                Math.round((original.start + original.duration) * 100) /
                100,
              duration: original.duration,
              settings: settingsCopy,
            };
            editorStore.setState({
              timelineClips: [...state.timelineClips, duplicate],
              selectedClipId: duplicate.id,
              activeClipTab: duplicate.type,
              activeInspectorTab: "properties",
            });
          }
          closeContextMenu();
        }}
      >
        <i className="icon-[ri--file-copy-line] h-3.5 w-3.5 text-blue-400" />
        <span>Duplicate Clip</span>
      </button>
      <button
        className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-red-600/20 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          const clipToDelete = state.timelineClips.find(
            (c: any) => c.id === contextMenu?.clipId,
          );
          editorStore.setState({
            timelineClips: state.timelineClips.filter(
              (c: any) => c.id !== contextMenu?.clipId,
            ),
          });
          if (clipToDelete) {
            revokeClipUrls(clipToDelete, editorStore.getState() as never);
          }
          if (state.selectedClipId === contextMenu?.clipId) {
            editorStore.setState({ selectedClipId: null });
          }
          closeContextMenu();
        }}
      >
        <i className="icon-[ri--delete-bin-line] h-3.5 w-3.5 text-red-400" />
        <span>Delete Clip</span>
      </button>
    </div>
  );
}