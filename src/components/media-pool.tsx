import { useEffect } from "react";
import { useLocation } from "wouter";
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
  const [, navigate] = useLocation();

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
      : {
          id: "thumbnail",
          label: "Image",
          icon: TAB_ICONS.thumbnail,
          route: "/image",
        },
  ];

  const handleTabClick = (tab: LeftTab) => {
    if (tab.route) {
      navigate(tab.route);
      return;
    }
    const state = editorStore.getState();
    if (state.activeLeftTab === tab.id && !state.leftPanelCollapsed) {
      editorStore.setState({ leftPanelCollapsed: true });
    } else {
      editorStore.setState({
        activeLeftTab: tab.id,
        leftPanelCollapsed: false,
      });
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
    <div className="flex h-full flex-row overflow-hidden">
      {/* Vertical Tab Sidebar */}
      <div className="flex w-14 flex-none flex-col items-center gap-3 border-r border-slate-800 bg-slate-950/80 py-4">
        {tabs.map((tab) => {
          const isActive =
            !tab.route && activeLeftTab === tab.id && !leftPanelCollapsed;
          const isRouteMatch = !!tab.route && currentRoute === tab.route;
          return (
            <button
              key={tab.id}
              title={tab.label}
              onClick={() => handleTabClick(tab)}
              className={`flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border text-[8px] font-bold tracking-tighter uppercase transition-all ${
                isActive || isRouteMatch
                  ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                  : tab.route
                    ? "border-purple-500/10 text-purple-400/80 hover:bg-purple-500/10 hover:text-purple-300"
                    : "border-transparent text-slate-500 hover:bg-slate-800/40 hover:text-slate-300"
              }`}
            >
              <i className={`${tab.icon} h-4.5 w-4.5`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div
        key={activeLeftTab}
        className={`flex-1 overflow-hidden transition-all duration-200 ${leftPanelCollapsed ? "pointer-events-none w-0 opacity-0" : "animate-tab-fade-in opacity-100"}`}
      >
        {content}
      </div>
    </div>
  );
};
