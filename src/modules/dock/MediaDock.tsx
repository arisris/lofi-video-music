import { useEffect } from "react";
import { useEditorStore } from "../../store/editor-store";
import { navigateRoute, type EditorRoute } from "../../store/route-hash";
import { MediaLibraryPanel } from "../library-panels/MediaLibraryPanel";
import { TextPanel } from "../library-panels/TextPanel";
import { LyricsPanel } from "../library-panels/LyricsPanel";
import { VfxPanel } from "../library-panels/VfxPanel";
import { GlobalSettingsPanel } from "../library-panels/GlobalSettingsPanel";
import { ShapePanel } from "../library-panels/ShapePanel";

interface LeftTab {
  id: string;
  label: string;
  icon: string;
  route?: EditorRoute;
}

const TAB_ICONS = {
  library: "icon-[ri--folder-video-line]",
  shapes: "icon-[ri--shapes-line]",
  text: "icon-[ri--text-spacing]",
  lyrics: "icon-[ri--mic-line]",
  vfx: "icon-[ri--magic-line]",
  settings: "icon-[ri--settings-3-line]",
  video: "icon-[ri--movie-2-line]",
  thumbnail: "icon-[ri--image-edit-line]",
} as const;

export const MediaDock = () => {
  const activeLeftTab = useEditorStore((s) => s.activeLeftTab);
  const leftPanelCollapsed = useEditorStore((s) => s.leftPanelCollapsed);
  const route = useEditorStore((s) => s.route);
  const isThumbnailMode = route === "/image";

  useEffect(() => {
    const state = useEditorStore.getState();
    if (!state.activeLeftTab || state.activeLeftTab === "playlist") {
      useEditorStore.setState({ activeLeftTab: "library" });
    }
  }, []);

  const mainTabs: LeftTab[] = [
    { id: "library", label: "Media", icon: TAB_ICONS.library },
    { id: "shapes", label: "Shapes", icon: TAB_ICONS.shapes },
    { id: "text", label: "Text", icon: TAB_ICONS.text },
    ...(isThumbnailMode
      ? []
      : [{ id: "lyrics", label: "Lyrics", icon: TAB_ICONS.lyrics }]),
    { id: "vfx", label: "VFX", icon: TAB_ICONS.vfx },
  ];

  // VS Code style: settings + route switch pinned to the rail bottom.
  const bottomTabs: LeftTab[] = [
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
      navigateRoute(tab.route);
      return;
    }
    const state = useEditorStore.getState();
    if (state.activeLeftTab === tab.id && !state.leftPanelCollapsed) {
      useEditorStore.setState({ leftPanelCollapsed: true });
    } else {
      useEditorStore.setState({
        activeLeftTab: tab.id,
        leftPanelCollapsed: false,
      });
    }
  };

  const content = (() => {
    switch (activeLeftTab) {
      case "vfx":
        return <VfxPanel />;
      case "text":
        return <TextPanel />;
      case "lyrics":
        return <LyricsPanel />;
      case "settings":
        return <GlobalSettingsPanel />;
      case "shapes":
        return <ShapePanel />;
      default:
        return <MediaLibraryPanel />;
    }
  })();

  const renderTab = (tab: LeftTab) => {
    const isActive =
      !tab.route && activeLeftTab === tab.id && !leftPanelCollapsed;
    const isRouteMatch = !!tab.route && route === tab.route;
    return (
      <button
        key={tab.id}
        title={tab.label}
        aria-label={tab.label}
        aria-pressed={isActive || isRouteMatch}
        onClick={() => handleTabClick(tab)}
        className={`flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border text-[8px] font-bold tracking-tighter uppercase transition-all outline-none focus-visible:outline-2 focus-visible:outline-blue-500 ${
          isActive || isRouteMatch
            ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
            : tab.route
              ? "border-purple-500/10 text-purple-400/80 hover:bg-purple-500/10 hover:text-purple-300"
              : "border-transparent text-neutral-500 hover:bg-neutral-800/40 hover:text-neutral-300"
        }`}
      >
        <i className={`${tab.icon} h-4.5 w-4.5`} />
        <span>{tab.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-row overflow-hidden">
      <div
        role="toolbar"
        aria-label="Library panels"
        className="flex w-14 flex-none flex-col items-center gap-3 border-r border-neutral-800 bg-neutral-950/80 py-4"
      >
        {mainTabs.map(renderTab)}
        <div className="mt-auto flex flex-col items-center gap-3">
          {bottomTabs.map(renderTab)}
        </div>
      </div>

      <div
        key={activeLeftTab}
        className={`flex-1 overflow-hidden transition-all duration-200 ${leftPanelCollapsed ? "pointer-events-none w-0 opacity-0" : "animate-tab-fade-in opacity-100"}`}
      >
        {content}
      </div>
    </div>
  );
};
