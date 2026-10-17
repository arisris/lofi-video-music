import m from "mithril";
import "./tailwind.css";
import { State } from "./lib/state";
import { editorStore } from "./store/editor-store";
import { runtime } from "./lib/runtime";
import { renderLoop } from "./lib/render";
import { handleDragMove, handleDragEnd } from "./lib/drag";
import { initAudioEngine, pauseAudio, applyAudioSettings } from "./lib/audio";

import { VideoPreview } from "./components/video-preview";
import { PlaybackControls } from "./components/transport-bar";
import { Timeline } from "./components/timeline";
import { Resizer } from "./components/resizer";
import { MediaPool } from "./components/media-pool";
import { InspectorPanel } from "./components/inspector-panel";
import { RecordSettingsModal } from "./components/record-settings-modal";

import { getClipsToSearch } from "./utils/helpers";

const Editor = {
  async oncreate() {
    runtime.canvas = document.getElementById("renderCanvas");
    runtime.ctx = runtime.canvas.getContext("2d");
    runtime.audioEl = document.getElementById("audioElement");
    
    // Re-sync on HMR
    if (State.isAudioInit) {
      const clipsToSearch = getClipsToSearch(State);
      const activeClip = clipsToSearch.find(c => 
        c.type === 'music' && 
        c.settings?.enabled !== false &&
        State.currentTime >= c.start && 
        State.currentTime <= c.start + c.duration
      );
      if (activeClip) {
        runtime.audioEl.src = activeClip.settings.audioUrl;
        runtime.audioEl.currentTime = (State.currentTime - activeClip.start) + (activeClip.settings.startOffset || 0);
        initAudioEngine();
        applyAudioSettings(activeClip);
      }
    }

    renderLoop();
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleDragMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);
  },
  onremove() {
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
    window.removeEventListener("touchmove", handleDragMove);
    window.removeEventListener("touchend", handleDragEnd);
  },
  view() {
    return m(
      "div",
      { class: "h-screen w-screen flex flex-col bg-slate-950 overflow-hidden font-sans text-slate-200" },
      [
        // MAIN WORKSPACE
        m(
          "section",
          { class: "flex flex-col md:flex-row flex-1 border-b border-slate-800 min-h-0 overflow-y-auto md:overflow-hidden custom-scrollbar bg-slate-950" },
          [
            // LEFT PANEL: Media Pool 
            m(
              "aside",
              { 
                class: `h-auto md:h-full flex-none border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-900/20 order-2 md:order-1 transition-all duration-200 ${State.leftPanelCollapsed ? "w-14" : ""}`,
                style: { width: window.innerWidth > 768 ? (State.leftPanelCollapsed ? "56px" : `${State.mediaPoolWidth || 300}px`) : "100%" }
              },
              [
                m(MediaPool)
              ]
            ),

            !State.leftPanelCollapsed && m(Resizer, { side: "left", order: "md:order-1", onResize: (w) => State.mediaPoolWidth = w }),

            // CENTER PANEL: Preview Player 
            m(
              "main",
              { class: "flex-none md:flex-1 h-auto md:h-full flex flex-col bg-black relative order-1 md:order-2" },
              [
                m("div", { class: "flex-1 flex items-center justify-center overflow-hidden relative bg-black" }, [
                  m(VideoPreview),
                ]),
                m(Timeline),
                m("div", { class: "flex-none p-2 bg-slate-900 border-t border-slate-800" }, [
                  m(PlaybackControls)
                ])
              ]
            ),

            m(Resizer, { side: "right", order: "md:order-2", onResize: (w) => State.inspectorWidth = w }),

            // RIGHT PANEL: Inspector / Properties
            m(
              "aside",
              { 
                class: "w-full h-auto md:h-full flex-none border-t md:border-t-0 md:border-l border-slate-800 flex flex-col bg-slate-900/20 order-3 md:order-3",
                style: { width: window.innerWidth > 768 ? `${State.inspectorWidth || 320}px` : "100%" }
              },
              [
                m(InspectorPanel)
              ]
            ),
          ]
        ),

        // Hidden Audio Element
        m("audio", {
          id: "audioElement",
          crossorigin: "anonymous",
          onended: () => {
            m.redraw();
          },
        }),

        // Recording Settings Modal
        State.showRecordSettingsModal && m(RecordSettingsModal),
      ],
    );
  },
};

m.route.prefix = "#!";

let lastResolvedRoute = null;

/** Handle a route change: persist current mode state, restore the target mode. */
const swapRouteClips = (prevRoute, nextRoute) => {
  editorStore.getState().swapRoute(prevRoute, nextRoute);
};

const AppShell = {
  view() {
    return m(Editor);
  }
};

m.route(document.body, "/", {
  "/": {
    onmatch(args, requestedPath) {
      const prev = lastResolvedRoute;
      lastResolvedRoute = "/";
      swapRouteClips(prev, "/");
      return AppShell;
    }
  },
  "/image": {
    onmatch(args, requestedPath) {
      const prev = lastResolvedRoute;
      lastResolvedRoute = "/image";
      swapRouteClips(prev, "/image");
      return AppShell;
    }
  }
});

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    m.redraw();
  });
}
