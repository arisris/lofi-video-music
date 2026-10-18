import { useEffect, useRef } from "react";
import { Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import type { EditorRoute } from "./store/slices/mode";
import { useEditorStore, editorStore } from "./store/editor-store";
import { runtime } from "./lib/runtime";
import { renderLoop } from "./lib/render";
import { handleDragMove, handleDragEnd, DragPointerEvent } from "./lib/drag";
import { initAudioEngine, applyAudioSettings } from "./lib/audio";

import { VideoPreview } from "./components/video-preview";
import { PlaybackControls } from "./components/transport-bar";
import { Timeline } from "./components/timeline";
import { Resizer } from "./components/resizer";
import { MediaPool } from "./components/media-pool";
import { InspectorPanel } from "./components/inspector-panel";
import { RecordSettingsModal } from "./components/record-settings-modal";

import { getClipsToSearch } from "./utils/helpers";
import { bumpClips } from "./store/actions/timeline-actions";

/** Set once per page session so HMR re-mounts never double-schedule the rAF loop. */
let renderLoopStarted = false;

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
  const lastResolvedRouteRef = useRef<string | null>(null);

  useEffect(() => {
    const next = toEditorRoute(location);
    editorStore.getState().swapRoute(lastResolvedRouteRef.current, next);
    lastResolvedRouteRef.current = next;
  }, [location]);

  useEffect(() => {
    // Bind the canvas/audio elements the render loop and engine need.
    let raf = 0;
    const bindRuntime = () => {
      runtime.canvas = document.getElementById(
        "renderCanvas",
      ) as HTMLCanvasElement | null;
      runtime.ctx = runtime.canvas?.getContext("2d") ?? null;
      const audioEl = document.getElementById(
        "audioElement",
      ) as HTMLAudioElement | null;
      runtime.audioEl = audioEl;

      if (!runtime.canvas || !audioEl) {
        // The preview mounts asynchronously — retry until VideoPreview has rendered.
        raf = requestAnimationFrame(bindRuntime);
        return;
      }

      const audioState = editorStore.getState();
      if (audioState.isAudioInit) {
        const clipsToSearch = getClipsToSearch(audioState);
        const activeClip = clipsToSearch.find(
          (c: {
            type: string;
            start: number;
            duration: number;
            settings: { enabled?: boolean };
          }) =>
            c.type === "music" &&
            c.settings?.enabled !== false &&
            audioState.currentTime >= c.start &&
            audioState.currentTime <= c.start + c.duration,
        );
        if (activeClip) {
          audioEl.src =
            (activeClip.settings as { audioUrl?: string }).audioUrl ?? "";
          audioEl.currentTime =
            audioState.currentTime -
            activeClip.start +
            ((activeClip.settings as { startOffset?: number }).startOffset ||
              0);
          initAudioEngine();
          applyAudioSettings(activeClip);
        }
      }

      if (!renderLoopStarted) {
        renderLoopStarted = true;
        renderLoop();
      }
    };
    bindRuntime();

    // Global drag listeners, bound once for the whole app.
    const touchMoveOptions: AddEventListenerOptions = { passive: false };
    const onDragMove = (e: MouseEvent | TouchEvent) =>
      handleDragMove(e as DragPointerEvent);
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", onDragMove, touchMoveOptions);
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", onDragMove, touchMoveOptions);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-200">
      {/* MAIN WORKSPACE */}
      <section className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto border-b border-slate-800 bg-slate-950 md:flex-row md:overflow-hidden">
        {/* LEFT PANEL: Media Pool */}
        <aside
          className={`order-2 flex h-auto flex-none flex-col border-b border-slate-800 bg-slate-900/20 transition-all duration-200 md:order-1 md:h-full md:border-r md:border-b-0 ${leftPanelCollapsed ? "w-14" : ""}`}
          style={{
            width:
              window.innerWidth > 768
                ? leftPanelCollapsed
                  ? "56px"
                  : `${mediaPoolWidth || 300}px`
                : "100%",
          }}
        >
          <MediaPool />
        </aside>

        {!leftPanelCollapsed && (
          <Resizer
            side="left"
            order="md:order-1"
            onResize={(w) => {
              editorStore.setState({ mediaPoolWidth: w });
            }}
          />
        )}

        {/* CENTER PANEL: Preview Player */}
        <main className="relative order-1 flex h-auto flex-none flex-col bg-black md:order-2 md:h-full md:flex-1">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            <VideoPreview />
          </div>
          <Timeline />
          <div className="flex-none border-t border-slate-800 bg-slate-900 p-2">
            <PlaybackControls />
          </div>
        </main>

        <Resizer
          side="right"
          order="md:order-2"
          onResize={(w) => {
            editorStore.setState({ inspectorWidth: w });
          }}
        />

        {/* RIGHT PANEL: Inspector / Properties */}
        <aside
          className="order-3 flex h-auto w-full flex-none flex-col border-t border-slate-800 bg-slate-900/20 md:order-3 md:h-full md:border-t-0 md:border-l"
          style={{
            width:
              window.innerWidth > 768 ? `${inspectorWidth || 320}px` : "100%",
          }}
        >
          <InspectorPanel />
        </aside>
      </section>

      {/* Hidden Audio Element */}
      <audio
        id="audioElement"
        crossOrigin="anonymous"
        onEnded={() => {
          // Poke subscribed panels so they re-read the store.
          bumpClips();
        }}
      />

      {/* Recording Settings Modal */}
      {showRecordSettingsModal && <RecordSettingsModal />}
    </div>
  );
};

export const App = () => (
  <Router hook={useHashLocation}>
    <AppContent />
  </Router>
);
