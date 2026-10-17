import m from "mithril";
import { State } from "../lib/state";
import { MediaLibraryPanel } from "./media-library-panel";
import { ShapePanel } from "./shape-panel";
import { TextPanel } from "./text-panel";
import { VFXPanel } from "./vfx-panel";
import { SettingsPanel } from "./settings-panel";

export const MediaPool = {
  view() {
    const isThumbnailMode = State.currentRoute === "/image";

    const tabs = [
      { id: "library", label: "Media", icon: "icon-[ri--folder-video-line]" },
      { id: "shapes", label: "Shapes", icon: "icon-[ri--shapes-line]" },
      { id: "text", label: "Text", icon: "icon-[ri--text-spacing]" },
      { id: "vfx", label: "VFX", icon: "icon-[ri--magic-line]" },
      { id: "settings", label: "Settings", icon: "icon-[ri--settings-3-line]" },
      isThumbnailMode
        ? { id: "video", label: "Video", icon: "icon-[ri--movie-2-line]", route: "/" }
        : { id: "thumbnail", label: "Image", icon: "icon-[ri--image-edit-line]", route: "/image" }
    ];

    if (!State.activeLeftTab || State.activeLeftTab === "playlist") State.activeLeftTab = "library";

    return m("div", { class: "flex flex-row h-full overflow-hidden" }, [
      // Vertical Tab Sidebar
      m("div", { 
        key: "vertical-tab-sidebar",
        class: "w-14 flex-none bg-slate-950/80 border-r border-slate-800 flex flex-col items-center py-4 gap-3" 
      }, 
        tabs.map(tab => {
          const isActive = !tab.route && State.activeLeftTab === tab.id && !State.leftPanelCollapsed;
          const isRouteMatch = tab.route && State.currentRoute === tab.route;
          return m("button", {
            title: tab.label,
            class: `w-10 h-10 flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer gap-0.5 text-[8px] font-bold uppercase tracking-tighter ${
              isActive || isRouteMatch
                ? "text-blue-400 bg-blue-500/10 border-blue-500/20" 
                : tab.route
                  ? "text-purple-400/80 border-purple-500/10 hover:text-purple-300 hover:bg-purple-500/10"
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/40"
            }`,
            onclick: () => {
              if (tab.route) {
                m.route.set(tab.route);
              } else {
                if (State.activeLeftTab === tab.id && !State.leftPanelCollapsed) {
                  State.leftPanelCollapsed = true;
                } else {
                  State.activeLeftTab = tab.id;
                  State.leftPanelCollapsed = false;
                }
              }
            }
          }, [
            m("i", { class: `${tab.icon} w-4.5 h-4.5` }),
            m("span", tab.label)
          ]);
        })
      ),
      // Tab Content Area
      m("div", { 
        key: State.activeLeftTab,
        class: `flex-1 overflow-hidden transition-all duration-200 ${State.leftPanelCollapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100 animate-tab-fade-in"}`
      }, 
        State.activeLeftTab === "library"
          ? m(MediaLibraryPanel)
          : State.activeLeftTab === "shapes"
            ? m(ShapePanel)
            : State.activeLeftTab === "text"
              ? m(TextPanel)
              : State.activeLeftTab === "vfx"
                ? m(VFXPanel)
                : m(SettingsPanel)
      )
    ]);
  }
};
