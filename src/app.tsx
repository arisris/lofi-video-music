import { useEffect, useRef } from "react";
import { Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import type { EditorRoute } from "./store/slices/mode";
import { useEditorStore, editorStore } from "./store/editor-store";
import { runtime } from "./lib/runtime";
import { renderLoop } from "./lib/render";
import { handleDragMove, handleDragEnd } from "./lib/drag";
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
  const showRecordSettingsModal = useEditorStore((s) => s.showRecordSettingsModal);

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
      runtime.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
      runtime.ctx = runtime.canvas?.getContext("2d") ?? null;
      const audioEl = document.getElementById("audioElement") as HTMLAudioElement | null;
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
          (c: { type: string; start: number; duration: number; settings: { enabled?: boolean } }) =>
            c.type === "music" &&
            c.settings?.enabled !== false &&
            audioState.currentTime >= c.start &&
            audioState.currentTime <= c.start + c.duration
        );
        if (activeClip) {
          audioEl.src = (activeClip.settings as { audioUrl?: string }).audioUrl ?? "";
          audioEl.currentTime =
            audioState.currentTime - activeClip.start + ((activeClip.settings as { startOffset?: number }).startOffset || 0);
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
    window.addEventListener("mousemove", handleDragMove as unknown as (ev: MouseEvent) => void);
    window.addEventListener("mouseup", handleDragEnd as unknown as EventListener);
    window.addEventListener("touchmove", handleDragMove as unknown as (ev: TouchEvent) => void, { passive: false } as AddEventListenerOptions);
    window.addEventListener("touchend", handleDragEnd as unknown as EventListener);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", handleDragMove as unknown as (ev: MouseEvent) => void);
      window.removeEventListener("mouseup", handleDragEnd as unknown as EventListener);
      window.removeEventListener("touchmove", handleDragMove as unknown as (ev: TouchEvent) => void);
      window.removeEventListener("touchend", handleDragEnd as unknown as EventListener);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden font-sans text-slate-200">
      {/* MAIN WORKSPACE */}
      <section className="flex flex-col md:flex-row flex-1 border-b border-slate-800 min-h-0 overflow-y-auto md:overflow-hidden custom-scrollbar bg-slate-950">
        {/* LEFT PANEL: Media Pool */}
        <aside
          className={`h-auto md:h-full flex-none border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-900/20 order-2 md:order-1 transition-all duration-200 ${leftPanelCollapsed ? "w-14" : ""}`}
          style={{ width: window.innerWidth > 768 ? (leftPanelCollapsed ? "56px" : `${mediaPoolWidth || 300}px`) : "100%" }}
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
        <main className="flex-none md:flex-1 h-auto md:h-full flex flex-col bg-black relative order-1 md:order-2">
          <div className="flex-1 flex items-center justify-center overflow-hidden relative bg-black">
            <VideoPreview />
          </div>
          <Timeline />
          <div className="flex-none p-2 bg-slate-900 border-t border-slate-800">
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
          className="w-full h-auto md:h-full flex-none border-t md:border-t-0 md:border-l border-slate-800 flex flex-col bg-slate-900/20 order-3 md:order-3"
          style={{ width: window.innerWidth > 768 ? `${inspectorWidth || 320}px` : "100%" }}
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
