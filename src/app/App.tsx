import m from "mithril";
import { useEffect } from "react";
import type { EditorRoute } from "../store/slices/mode";
import { MithrilBridge } from "../compat/mithril-bridge";
import { useEditorStore, editorStore } from "../store/editor-store";
import { State } from "../lib/state";
import { runtime } from "../lib/runtime";
import { renderLoop } from "../lib/render";
import { handleDragMove, handleDragEnd } from "../lib/drag";
import { initAudioEngine, applyAudioSettings } from "../lib/audio";

import { VideoPreview } from "../components/video-preview";
import { PlaybackControls } from "../components/transport-bar";
import { Timeline } from "../components/timeline";
import { Resizer } from "../components/resizer";
import { MediaPool } from "../components/media-pool";
import { InspectorPanel } from "../components/inspector-panel";
import { RecordSettingsModal } from "../components/record-settings-modal";

import { getClipsToSearch } from "../utils/helpers";

/** Set once per page session so HMR re-mounts never double-schedule the rAF loop. */
let renderLoopStarted = false;

/** Current hash route → editor route (Mithril's `#!` prefix keeps working). */
const currentRoute = (): EditorRoute =>
  window.location.hash.replace(/^#!?\/?/, "/").startsWith("/image") ? "/image" : "/";

export const App = () => {
  const mediaPoolWidth = useEditorStore((s) => s.mediaPoolWidth);
  const inspectorWidth = useEditorStore((s) => s.inspectorWidth);
  const leftPanelCollapsed = useEditorStore((s) => s.leftPanelCollapsed);
  const showRecordSettingsModal = useEditorStore((s) => s.showRecordSettingsModal);

  useEffect(() => {
    // Initial route resolution (replaces legacy `m.route(document.body, "/", ...)`)
    let lastResolvedRoute: string | null = null;
    const applyRoute = () => {
      const next = currentRoute();
      editorStore.getState().swapRoute(lastResolvedRoute, next);
      lastResolvedRoute = next;
    };
    applyRoute();
    window.addEventListener("hashchange", applyRoute);

    // Canvas / audio runtime binding (ported from legacy `Editor.oncreate`)
    let raf = 0;
    const bindRuntime = () => {
      runtime.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
      runtime.ctx = runtime.canvas?.getContext("2d") ?? null;
      const audioEl = document.getElementById("audioElement") as HTMLAudioElement | null;
      runtime.audioEl = audioEl;

      if (!runtime.canvas || !audioEl) {
        // Mithril hosts mount async — retry until VideoPreview has rendered.
        raf = requestAnimationFrame(bindRuntime);
        return;
      }

      if (State.isAudioInit) {
        const clipsToSearch = getClipsToSearch(State);
        const activeClip = clipsToSearch.find(
          (c: { type: string; start: number; duration: number; settings: { enabled?: boolean } }) =>
            c.type === "music" &&
            c.settings?.enabled !== false &&
            State.currentTime >= c.start &&
            State.currentTime <= c.start + c.duration
        );
        if (activeClip) {
          audioEl.src = (activeClip.settings as { audioUrl?: string }).audioUrl ?? "";
          audioEl.currentTime =
            State.currentTime - activeClip.start + ((activeClip.settings as { startOffset?: number }).startOffset || 0);
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

    // Global drag listeners (legacy app-level listeners)
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", applyRoute);
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove as EventListener);
      window.removeEventListener("touchend", handleDragEnd);
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
              State.mediaPoolWidth = w;
            }}
          />
        )}

        {/* CENTER PANEL: Preview Player */}
        <main className="flex-none md:flex-1 h-auto md:h-full flex flex-col bg-black relative order-1 md:order-2">
          <div className="flex-1 flex items-center justify-center overflow-hidden relative bg-black">
            <VideoPreview />
          </div>
          <MithrilBridge render={() => m(Timeline)} />
          <div className="flex-none p-2 bg-slate-900 border-t border-slate-800">
            <MithrilBridge render={() => m(PlaybackControls)} />
          </div>
        </main>

        <Resizer
          side="right"
          order="md:order-2"
          onResize={(w) => {
            State.inspectorWidth = w;
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
          m.redraw();
        }}
      />

      {/* Recording Settings Modal */}
      {showRecordSettingsModal && <RecordSettingsModal />}
    </div>
  );
};
