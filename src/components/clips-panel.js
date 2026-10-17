import m from "mithril";
import { State } from "../lib/state";
import { ClipRegistry } from "../lib/clips/index";

import { getClipsToSearch, revokeClipUrls } from "../utils/helpers";

export const ClipsPanel = {
  view() {
    let activeClip = null;
    let activeClipSettings = null;
    let isEnabled = true;
    let clipName = "";
    let clipIcon = "";
    let isTimelineClip = false;
    let targetClipObject = null;

    // Check if the selected clip is a timeline clip
    const clipsToSearch = getClipsToSearch(State);
    const timelineClip = clipsToSearch.find(c => c.id === State.selectedClipId);
    if (timelineClip) {
      isTimelineClip = true;
      activeClip = ClipRegistry.get(timelineClip.type);
      activeClipSettings = timelineClip.settings;
      isEnabled = activeClipSettings.enabled !== false;
      clipName = timelineClip.type === "text"
        ? `Text: "${timelineClip.settings.content || ""}"`
        : timelineClip.type === "background"
          ? `Background: ${timelineClip.settings.fileName || "Image/Video"}`
          : timelineClip.type === "overlay"
            ? `Overlay: ${timelineClip.settings.fileName || "Image/Video"}`
            : timelineClip.type === "visualizer"
              ? `Visualizer (${timelineClip.settings.style || "bars"})`
              : activeClip?.name || "Timeline Clip";
      clipIcon = activeClip?.icon || "icon-[ri--movie-2-line]";
      targetClipObject = timelineClip;
    } else if (State.selectedClipId === "title" || State.selectedClipId === "playlist") {
      // It is a global layer
      activeClip = ClipRegistry.get(State.selectedClipId);
      activeClipSettings = State.clipSettings[State.selectedClipId];
      isEnabled = activeClipSettings?.enabled !== false;
      clipName = activeClip?.name || "Global Layer";
      clipIcon = activeClip?.icon || "icon-[ri--layout-line]";
    }

    if (!activeClip || !activeClipSettings) {
      // Show empty/placeholder state
      return m(
        "div",
        { class: "bg-slate-900 p-8 flex flex-col items-center justify-center h-full w-full text-center text-slate-500" },
        [
          m("div", { class: "w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center mb-4 border border-slate-800" }, [
            m("i", { class: "icon-[ri--equalizer-line] w-8 h-8 text-slate-600" })
          ]),
          m("h3", { class: "text-sm font-bold text-slate-400 mb-1" }, "No Clip Selected"),
          m("p", { class: "text-xs text-slate-500 max-w-xs leading-relaxed" },
            "Select a clip from the timeline or the left Clips Library panel to view and edit its properties here."
          )
        ]
      );
    }

    return m(
      "div",
      {
        class: "bg-slate-900 p-5 flex flex-col overflow-hidden h-full w-full",
      },
      [
        // Header with Title and Enable Toggle
        m(
          "div",
          { class: "flex items-center justify-between mb-5 flex-none" },
          [
            m("div", { class: "flex items-center gap-2 overflow-hidden flex-1 animate-in fade-in duration-200" }, [
              m("i", { class: `${clipIcon} text-blue-500 w-4 h-4 shrink-0` }),
              m("span", { class: "text-[10px] font-bold uppercase tracking-wider text-slate-200 truncate" }, clipName),
            ]),
            m("div", { class: "flex items-center gap-2 shrink-0 ml-2" }, [
              // Enable/Disable Toggle (hidden for music clips)
              timelineClip?.type !== "music" && m(
                "button",
                {
                  class: `p-1.5 rounded-lg border transition-all cursor-pointer ${isEnabled ? "bg-blue-600/20 border-blue-600/40 text-blue-400 hover:bg-blue-600/30" : "bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-400"}`,
                  title: isEnabled ? "Disable layer/clip" : "Enable layer/clip",
                  onclick: () => {
                    activeClipSettings.enabled = !isEnabled;
                    m.redraw();
                  },
                },
                m("i", { class: `${isEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} w-4 h-4` })
              ),
              // Delete button if timeline clip
              isTimelineClip && m(
                "button",
                {
                  class: "p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-500 hover:text-red-400 hover:bg-red-900/20 hover:border-red-900/30 transition-all cursor-pointer",
                  title: "Delete Clip",
                  onclick: () => {
                    const isThumbnailMode = State.currentRoute === "/image";
                    let clipToDelete = null;
                    if (isThumbnailMode && State.videoClips?.some(c => c.id === State.selectedClipId)) {
                      clipToDelete = State.videoClips.find(c => c.id === State.selectedClipId);
                      State.videoClips = State.videoClips.filter(c => c.id !== State.selectedClipId);
                    } else {
                      clipToDelete = State.timelineClips.find(c => c.id === State.selectedClipId);
                      State.timelineClips = State.timelineClips.filter(c => c.id !== State.selectedClipId);
                    }
                    if (clipToDelete) {
                      revokeClipUrls(clipToDelete, State);
                    }
                    State.selectedClipId = null;
                    m.redraw();
                  }
                },
                m("i", { class: "icon-[ri--delete-bin-line] w-4 h-4" })
              )
            ])
          ]
        ),

        // Disabled banner
        !isEnabled ? m("div", { class: "mb-4 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 flex-none" }, [
          m("i", { class: "icon-[ri--eye-off-line] w-3.5 h-3.5" }),
          "This element is currently hidden"
        ]) : null,

        // Active Clip Setting Content
        m(
          "div",
          { class: "flex-1 overflow-y-auto pr-1 custom-scrollbar" },
          [
            activeClip && typeof activeClip.onSettings === "function"
              ? activeClip.onSettings(targetClipObject)
              : m("div", { class: "text-slate-500 text-xs italic" }, "Preparing clip settings...")
          ]
        ),
      ]
    );
  }
};
