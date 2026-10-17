import m from "mithril";
import "./tailwind.css";
import { State } from "./lib/state";
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

const initRouteState = () => {
  if (State.videoClips === undefined) {
    State.videoClips = [...State.timelineClips];
  }
  if (State.videoTracks === undefined) {
    State.videoTracks = [...State.timelineTracks];
  }
  if (State.thumbnailTracks === undefined) {
    State.thumbnailTracks = [
      { id: "track-1", name: "Track 1 (Music)", locked: false },
      { id: "track-2", name: "Track 2", locked: false },
      { id: "track-3", name: "Track 3", locked: false }
    ];
  }
  if (State.thumbnailClips === undefined) {
    State.thumbnailClips = [
      {
        id: "thumb-text-1",
        type: "text",
        trackId: "track-2",
        start: 0,
        duration: 60,
        settings: {
          content: "LOFI CHILL VIBES",
          fontFamily: "'Bangers', cursive",
          fontSize: 70,
          textColor: "#ffffff",
          strokeColor: "#f43f5e",
          strokeWidth: 6,
          shadowColor: "#000000",
          shadowBlur: 10,
          shadowOffsetX: 4,
          shadowOffsetY: 4,
          x: 0,
          y: -80,
          rotation: -4,
          scale: 1,
          bgPadding: 0,
          bgRadius: 0,
          bgColor: "transparent"
        }
      },
      {
        id: "thumb-text-2",
        type: "text",
        trackId: "track-3",
        start: 0,
        duration: 60,
        settings: {
          content: "Late Night Study & Code",
          fontFamily: "'Lexend', sans-serif",
          fontSize: 36,
          textColor: "#ffffff",
          strokeColor: "#0f172a",
          strokeWidth: 4,
          shadowColor: "#000000",
          shadowBlur: 5,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
          x: 0,
          y: 40,
          rotation: 0,
          scale: 1,
          bgPadding: 10,
          bgRadius: 10,
          bgColor: "rgba(15, 23, 42, 0.75)"
        }
      }
    ];
  }

  if (State.videoSelectedClipId === undefined) {
    State.videoSelectedClipId = null;
  }
  if (State.thumbnailSelectedClipId === undefined) {
    State.thumbnailSelectedClipId = "thumb-text-1";
  }
  if (State.videoSelectedTrackId === undefined) {
    State.videoSelectedTrackId = "track-2";
  }
  if (State.thumbnailSelectedTrackId === undefined) {
    State.thumbnailSelectedTrackId = "track-2";
  }
};

const swapRouteClips = (prevRoute, nextRoute) => {
  initRouteState();
  State.currentRoute = nextRoute;

  if (prevRoute !== nextRoute) {
    if (prevRoute) {
      // Save entire timeline state of the previous route
      if (prevRoute === "/") {
        State.videoClips = [...State.timelineClips];
        State.videoSelectedClipId = State.selectedClipId;
        State.videoTracks = [...State.timelineTracks];
        State.videoSelectedTrackId = State.selectedTrackId;
      } else if (prevRoute === "/image") {
        State.thumbnailClips = [...State.timelineClips];
        State.thumbnailSelectedClipId = State.selectedClipId;
        State.thumbnailTracks = [...State.timelineTracks];
        State.thumbnailSelectedTrackId = State.selectedTrackId;
      }
    }

    // Load the target route's exact timeline state
    if (nextRoute === "/") {
      State.timelineClips = [...State.videoClips];
      State.selectedClipId = State.videoSelectedClipId;
      State.timelineTracks = [...State.videoTracks];
      State.selectedTrackId = State.videoSelectedTrackId;
    } else if (nextRoute === "/image") {
      State.timelineClips = [...State.thumbnailClips];
      State.selectedClipId = State.thumbnailSelectedClipId;
      State.timelineTracks = [...State.thumbnailTracks];
      State.selectedTrackId = State.thumbnailSelectedTrackId;
    }
  }
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
