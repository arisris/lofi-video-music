import { useEffect } from "react";
import { formatTime, getTotalDuration, getClipsToSearch } from "../utils/helpers";
import { playAudio, pauseAudio, skipToNextTrack, skipToPrevTrack } from "../lib/audio";
import { stopRecording } from "../lib/recorder";
import { runtime } from "../lib/runtime";
import { editorStore, useEditorStore } from "../store/editor-store";

const RATIO_OPTIONS = [
  { ratio: "16:9", icon: "icon-[mdi--crop-landscape]" },
  { ratio: "9:16", icon: "icon-[mdi--crop-portrait]" },
];

const selectAspectRatio = (ratio: string) => {
  editorStore.setState({ aspectRatio: ratio });
  if (runtime.canvas) {
    runtime.canvas.width = ratio === "16:9" ? 1280 : 720;
    runtime.canvas.height = ratio === "16:9" ? 720 : 1280;
  }
};

const openRecordMenu = (mode: "clip" | "timeline") => {
  editorStore.setState({ showRecordMenu: false, pendingRecordMode: mode, showRecordSettingsModal: true });
};

/** Bottom transport bar: aspect ratio, playback, and record controls. */
export const PlaybackControls = () => {
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const isRecording = useEditorStore((s) => s.isRecording);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const showRecordMenu = useEditorStore((s) => s.showRecordMenu);
  const currentRoute = useEditorStore((s) => s.currentRoute);
  const currentTime = useEditorStore((s) => s.currentTime);

  // Close the record dropdown on any outside click (legacy window listener).
  useEffect(() => {
    const closeMenu = () => {
      if (editorStore.getState().showRecordMenu) {
        editorStore.setState({ showRecordMenu: false });
      }
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state);
  const musicClips = clipsToSearch.filter((c: { type: string }) => c.type === "music");

  return (
    <div className="flex items-center justify-between gap-2 md:gap-4 w-full">
      {/* Left: Aspect Ratio Switcher */}
      <div className="flex items-center gap-3 w-auto md:w-1/3">
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
          {RATIO_OPTIONS.map((item) => (
            <button
              key={item.ratio}
              title={item.ratio}
              className={`h-7 px-2.5 flex items-center justify-center gap-1 rounded transition text-[10px] font-bold cursor-pointer ${aspectRatio === item.ratio ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              onClick={() => selectAspectRatio(item.ratio)}
            >
              <i className={`${item.icon} w-3.5 h-3.5`} />
              <span className="hidden lg:inline">{item.ratio}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center: Transport Buttons */}
      <div className="flex items-center justify-center gap-4 flex-1">
        {/* Skip Prev */}
        <button
          className="text-slate-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={isRecording || musicClips.length === 0}
          onClick={() => skipToPrevTrack()}
        >
          <i className="icon-[ri--skip-back-fill] w-5 h-5" />
        </button>

        {/* Play / Pause */}
        <button
          className={`w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer shadow-md ${isRecording ? "opacity-30 cursor-not-allowed bg-slate-800 text-slate-500" : isPlaying ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"}`}
          disabled={isRecording}
          onClick={() => (isPlaying ? pauseAudio() : playAudio())}
        >
          <i className={`${isPlaying ? "icon-[ri--pause-fill]" : "icon-[ri--play-fill]"} w-5 h-5`} />
        </button>

        {/* Skip Next */}
        <button
          className="text-slate-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={isRecording || musicClips.length === 0}
          onClick={() => skipToNextTrack()}
        >
          <i className="icon-[ri--skip-forward-fill] w-5 h-5" />
        </button>
      </div>

      {/* Right: Recording */}
      <div className="flex items-center justify-end gap-1.5 md:gap-2 w-auto md:w-1/3 relative">
        {(() => {
          const showDropdown = showRecordMenu && !isRecording && musicClips.length >= 2;
          if (!showDropdown) return null;

          const activeClip = clipsToSearch.find(
            (c: any) =>
              c.type === "music" &&
              c.settings?.enabled !== false &&
              currentTime >= c.start &&
              currentTime <= c.start + c.duration
          );
          const hasActiveClip = !!activeClip;
          const clipName = activeClip?.settings?.name || "";

          return (
            <div className="absolute bottom-10 right-0 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Option 1: Record Current Clip */}
              <button
                className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide flex items-center justify-between transition cursor-pointer ${hasActiveClip ? "text-slate-200 hover:bg-slate-800 hover:text-white" : "text-slate-600 cursor-not-allowed"}`}
                disabled={!hasActiveClip}
                onClick={() => openRecordMenu("clip")}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="font-bold text-slate-300">Record Current Clip</span>
                  <span className="text-[9px] text-slate-500 truncate">
                    {hasActiveClip ? `"${clipName}"` : "No active clip under playhead"}
                  </span>
                </div>
                <i className="icon-[ri--music-2-line] w-4 h-4 shrink-0 text-emerald-400" />
              </button>

              {/* Option 2: Record Full Timeline */}
              <button
                className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide flex items-center justify-between text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                onClick={() => openRecordMenu("timeline")}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-slate-300">Record Full Video</span>
                  <span className="text-[9px] text-slate-500">
                    Duration: {formatTime(Math.floor(getTotalDuration(clipsToSearch)))}
                  </span>
                </div>
                <i className="icon-[ri--movie-2-line] w-4 h-4 text-blue-400" />
              </button>
            </div>
          );
        })()}

        {(() => {
          if (currentRoute === "/image") {
            return (
              <button
                title="Save Thumbnail Image"
                className="h-8 px-3 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-md border border-blue-500/35"
                onClick={() => {
                  const canvas = runtime.canvas;
                  if (!canvas) return;

                  // Capture current canvas rendering (hide brief guides)
                  const state2 = editorStore.getState();
                  const oldSnaps = state2.canvasSnaps;
                  editorStore.setState({ canvasSnaps: [] });

                  setTimeout(() => {
                    const dataURL = canvas.toDataURL("image/png");
                    const link = document.createElement("a");
                    link.download = `lofi-thumbnail-${Date.now()}.png`;
                    link.href = dataURL;
                    link.click();
                    editorStore.setState({ canvasSnaps: oldSnaps });
                  }, 50);
                }}
              >
                <i className="icon-[ri--download-line] w-3.5 h-3.5" />
                <span>Save Thumbnail</span>
              </button>
            );
          }

          const musicClipsCount = musicClips.length;
          const hasMultipleMusic = musicClipsCount >= 2;

          return (
            <button
              title={hasMultipleMusic ? "Record video options" : "Record video"}
              className={`h-8 px-2 md:px-3 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${isRecording ? "bg-red-500/20 text-red-500 border border-red-500/50" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isRecording) {
                  stopRecording();
                } else if (hasMultipleMusic) {
                  editorStore.setState({ showRecordMenu: !showRecordMenu });
                } else {
                  openRecordMenu("timeline");
                }
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-slate-600"}`} />
              <span className="hidden sm:inline">{isRecording ? "Stop" : "Record Video"}</span>
              {!isRecording && hasMultipleMusic && (
                <i className="icon-[ri--arrow-up-s-line] w-3.5 h-3.5 ml-0.5" />
              )}
            </button>
          );
        })()}
      </div>
    </div>
  );
};

