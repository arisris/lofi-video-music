import { Suspense, lazy, useEffect, useState, type CSSProperties } from "react";
import { Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { VideoPreview } from "./modules/editor/VideoPreview";
import { PlaybackControls } from "./modules/editor/TransportBar";
import { Timeline } from "./modules/editor/Timeline";
import { Resizer } from "./modules/editor/Resizer";
import { MediaDock } from "./modules/dock/MediaDock";
import { InspectorPanel } from "./modules/editor/InspectorPanel";
// RecordSettingsModal loads on demand (record flow only) so it stays out of the main chunk.
const RecordSettingsModal = lazy(() =>
  import("./modules/editor/RecordSettingsModal").then((m) => ({
    default: m.RecordSettingsModal,
  })),
);
import { useEditorStore } from "./store/editor-store";
import {
  handleCanvasDragEnd,
  handleCanvasDragMove,
  type DragPointerEvent,
} from "./modules/editor/canvas-drag";

type EditorRoute = "/" | "/image";

const toEditorRoute = (location: string): EditorRoute =>
  location.startsWith("/image") ? "/image" : "/";

const AppContent = () => {
  const mediaPoolWidth = useEditorStore((s) => s.mediaPoolWidth);
  const inspectorWidth = useEditorStore((s) => s.inspectorWidth);
  const leftPanelCollapsed = useEditorStore((s) => s.leftPanelCollapsed);
  const showRecordSettingsModal = useEditorStore(
    (s) => s.showRecordSettingsModal,
  );

  const [location] = useLocation();

  // Panel side being dragged — width transition disabled while dragging
  // so resize follows the pointer without lag (transition-all + drag = rubber-banding).
  const [resizingSide, setResizingSide] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    useEditorStore.getState().swapRoute(toEditorRoute(location));
  }, [location]);

  // Global canvas drag listener: window-level move/up
  // so a drag survives even when the pointer leaves the canvas.
  useEffect(() => {
    const touchMoveOptions: AddEventListenerOptions = { passive: false };
    const onDragMove = (e: MouseEvent | TouchEvent) =>
      handleCanvasDragMove(e as unknown as DragPointerEvent);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", handleCanvasDragEnd);
    window.addEventListener("touchmove", onDragMove, touchMoveOptions);
    window.addEventListener("touchend", handleCanvasDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", handleCanvasDragEnd);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("touchend", handleCanvasDragEnd);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-200">
      {/* MAIN WORKSPACE */}
      <section className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto border-b border-neutral-800 bg-neutral-950 md:flex-row md:overflow-hidden">
        {/* LEFT PANEL: Media Pool */}
        <aside
          className={`order-2 flex w-full flex-none flex-col border-b border-neutral-800 bg-neutral-900/20 md:order-1 md:h-full md:w-(--panel-w) md:border-r md:border-b-0 ${resizingSide === "left" ? "" : "transition-[width] duration-200"}`}
          style={{ "--panel-w": leftPanelCollapsed ? "56px" : `${mediaPoolWidth || 300}px` } as CSSProperties}
        >
          <MediaDock />
        </aside>

        {!leftPanelCollapsed && (
          <Resizer
            side="left"
            order="md:order-1"
            onResize={(w) => {
              useEditorStore.setState({ mediaPoolWidth: w });
            }}
            onDragStateChange={(dragging) => setResizingSide(dragging ? "left" : null)}
          />
        )}

        {/* CENTER PANEL: Preview Player */}
        <main className="relative order-1 flex h-auto flex-none flex-col bg-black md:order-2 md:h-full md:min-w-0 md:flex-1">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            <VideoPreview />
          </div>
          <Timeline />
          <div className="flex-none border-t border-neutral-800 bg-neutral-900 p-2">
            <PlaybackControls />
          </div>
        </main>

        <Resizer
          side="right"
          order="md:order-2"
          onResize={(w) => {
            useEditorStore.setState({ inspectorWidth: w });
          }}
          onDragStateChange={(dragging) => setResizingSide(dragging ? "right" : null)}
        />

        {/* RIGHT PANEL: Inspector / Properties */}
        <aside
          className={`order-3 flex w-full flex-none flex-col border-t border-neutral-800 bg-neutral-900/20 md:order-3 md:h-full md:w-(--panel-w) md:border-t-0 md:border-l ${resizingSide === "right" ? "" : "transition-[width] duration-200"}`}
          style={{ "--panel-w": `${inspectorWidth || 320}px` } as CSSProperties}
        >
          <InspectorPanel />
        </aside>
      </section>

      {/* Hidden Audio Element */}
      <audio id="audioElement" crossOrigin="anonymous" />

      {/* Recording Settings Modal */}
      {showRecordSettingsModal && (
        <Suspense fallback={null}>
          <RecordSettingsModal />
        </Suspense>
      )}
    </div>
  );
};

export const App = () => (
  <Router hook={useHashLocation}>
    <AppContent />
  </Router>
);
