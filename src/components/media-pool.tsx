import { useEffect } from "react";
import { editorStore, useEditorStore } from "../store/editor-store";
import { MediaLibraryPanel } from "./media-library-panel";
import { TextPanel } from "./text-panel";
import { VFXPanel } from "./vfx-panel";
import { SettingsPanel } from "./settings-panel";
import { ShapePanel } from "./shape-panel";

interface LeftTab {
  id: string;
  label: string;
  icon: string;
  /** Non-null tab is a routing button instead of a content tab. */
  route?: string;
}

const TAB_ICONS = {
  library: "icon-[ri--folder-video-line]",
  shapes: "icon-[ri--shapes-line]",
  text: "icon-[ri--text-spacing]",
  vfx: "icon-[ri--magic-line]",
  settings: "icon-[ri--settings-3-line]",
  video: "icon-[ri--movie-2-line]",
  thumbnail: "icon-[ri--image-edit-line]",
} as const;

/** Left dock: vertical tab bar + active panel (state granular, from the editor store). */
export const MediaPool = () => {
  const activeLeftTab = useEditorStore((s) => s.activeLeftTab);
  const leftPanelCollapsed = useEditorStore((s) => s.leftPanelCollapsed);
  const currentRoute = useEditorStore((s) => s.currentRoute);
  const isThumbnailMode = currentRoute === "/image";

  // Default: an undefined or "playlist" tab falls back to "library".
  useEffect(() => {
    const state = editorStore.getState();
    if (!state.activeLeftTab || state.activeLeftTab === "playlist") {
      editorStore.setState({ activeLeftTab: "library" });
    }
  }, []);

  const tabs: LeftTab[] = [
    { id: "library", label: "Media", icon: TAB_ICONS.library },
    { id: "shapes", label: "Shapes", icon: TAB_ICONS.shapes },
    { id: "text", label: "Text", icon: TAB_ICONS.text },
    { id: "vfx", label: "VFX", icon: TAB_ICONS.vfx },
    { id: "settings", label: "Settings", icon: TAB_ICONS.settings },
    isThumbnailMode
      ? { id: "video", label: "Video", icon: TAB_ICONS.video, route: "/" }
      : { id: "thumbnail", label: "Image", icon: TAB_ICONS.thumbnail, route: "/image" },
  ];

  const handleTabClick = (tab: LeftTab) => {
    if (tab.route) {
      window.location.hash = `#!${tab.route}`;
      return;
    }
    const state = editorStore.getState();
    if (state.activeLeftTab === tab.id && !state.leftPanelCollapsed) {
      editorStore.setState({ leftPanelCollapsed: true });
    } else {
      editorStore.setState({ activeLeftTab: tab.id, leftPanelCollapsed: false });
    }
  };

  const content = (() => {
    switch (activeLeftTab) {
      case "vfx":
        return <VFXPanel />;
      case "text":
        return <TextPanel />;
      case "settings":
        return <SettingsPanel />;
      case "shapes":
        return <ShapePanel />;
      default:
        return <MediaLibraryPanel />;
    }
  })();

  return (
    <div className="flex flex-row h-full overflow-hidden">
      {/* Vertical Tab Sidebar */}
      <div className="w-14 flex-none bg-slate-950/80 border-r border-slate-800 flex flex-col items-center py-4 gap-3">
        {tabs.map((tab) => {
          const isActive = !tab.route && activeLeftTab === tab.id && !leftPanelCollapsed;
          const isRouteMatch = !!tab.route && currentRoute === tab.route;
          return (
            <button
              key={tab.id}
              title={tab.label}
              onClick={() => handleTabClick(tab)}
              className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer gap-0.5 text-[8px] font-bold uppercase tracking-tighter ${
                isActive || isRouteMatch
                  ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                  : tab.route
                    ? "text-purple-400/80 border-purple-500/10 hover:text-purple-300 hover:bg-purple-500/10"
                    : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/40"
              }`}
            >
              <i className={`${tab.icon} w-4.5 h-4.5`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div
        key={activeLeftTab}
        className={`flex-1 overflow-hidden transition-all duration-200 ${leftPanelCollapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100 animate-tab-fade-in"}`}
      >
        {content}
      </div>
    </div>
  );
};
