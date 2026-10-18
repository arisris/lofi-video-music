import { useEffect } from "react";
import {
  formatTime,
  getTotalDuration,
  getClipsToSearch,
} from "../utils/helpers";
import {
  playAudio,
  pauseAudio,
  skipToNextTrack,
  skipToPrevTrack,
} from "../lib/audio";
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
  editorStore.setState({
    showRecordMenu: false,
    pendingRecordMode: mode,
    showRecordSettingsModal: true,
  });
};

/** Bottom transport bar: aspect ratio, playback, and record controls. */
export const PlaybackControls = () => {
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const isRecording = useEditorStore((s) => s.isRecording);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const showRecordMenu = useEditorStore((s) => s.showRecordMenu);
  const currentRoute = useEditorStore((s) => s.currentRoute);
  const currentTime = useEditorStore((s) => s.currentTime);

  // Close the record dropdown on any outside click.
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
  const musicClips = clipsToSearch.filter(
    (c: { type: string }) => c.type === "music",
  );

  return (
    <div className="flex w-full items-center justify-between gap-2 md:gap-4">
      {/* Left: Aspect Ratio Switcher */}
      <div className="flex w-auto items-center gap-3 md:w-1/3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-0.5">
          {RATIO_OPTIONS.map((item) => (
            <button
              key={item.ratio}
              title={item.ratio}
              className={`flex h-7 cursor-pointer items-center justify-center gap-1 rounded px-2.5 text-[10px] font-bold transition ${aspectRatio === item.ratio ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              onClick={() => selectAspectRatio(item.ratio)}
            >
              <i className={`${item.icon} h-3.5 w-3.5`} />
              <span className="hidden lg:inline">{item.ratio}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center: Transport Buttons */}
      <div className="flex flex-1 items-center justify-center gap-4">
        {/* Skip Prev */}
        <button
          className="text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          disabled={isRecording || musicClips.length === 0}
          onClick={() => skipToPrevTrack()}
        >
          <i className="icon-[ri--skip-back-fill] h-5 w-5" />
        </button>

        {/* Play / Pause */}
        <button
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full shadow-md transition ${isRecording ? "cursor-not-allowed bg-slate-800 text-slate-500 opacity-30" : isPlaying ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"}`}
          disabled={isRecording}
          onClick={() => (isPlaying ? pauseAudio() : playAudio())}
        >
          <i
            className={`${isPlaying ? "icon-[ri--pause-fill]" : "icon-[ri--play-fill]"} h-5 w-5`}
          />
        </button>

        {/* Skip Next */}
        <button
          className="text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          disabled={isRecording || musicClips.length === 0}
          onClick={() => skipToNextTrack()}
        >
          <i className="icon-[ri--skip-forward-fill] h-5 w-5" />
        </button>
      </div>

      {/* Right: Recording */}
      <div className="relative flex w-auto items-center justify-end gap-1.5 md:w-1/3 md:gap-2">
        {(() => {
          const showDropdown =
            showRecordMenu && !isRecording && musicClips.length >= 2;
          if (!showDropdown) return null;

          const activeClip = clipsToSearch.find(
            (c: any) =>
              c.type === "music" &&
              c.settings?.enabled !== false &&
              currentTime >= c.start &&
              currentTime <= c.start + c.duration,
          );
          const hasActiveClip = !!activeClip;
          const clipName = activeClip?.settings?.name || "";

          return (
            <div className="animate-in fade-in slide-in-from-bottom-2 absolute right-0 bottom-10 z-50 flex w-64 flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-md duration-200">
              {/* Option 1: Record Current Clip */}
              <button
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-semibold tracking-wide transition ${hasActiveClip ? "text-slate-200 hover:bg-slate-800 hover:text-white" : "cursor-not-allowed text-slate-600"}`}
                disabled={!hasActiveClip}
                onClick={() => openRecordMenu("clip")}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="font-bold text-slate-300">
                    Record Current Clip
                  </span>
                  <span className="truncate text-[9px] text-slate-500">
                    {hasActiveClip
                      ? `"${clipName}"`
                      : "No active clip under playhead"}
                  </span>
                </div>
                <i className="icon-[ri--music-2-line] h-4 w-4 shrink-0 text-emerald-400" />
              </button>

              {/* Option 2: Record Full Timeline */}
              <button
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-semibold tracking-wide text-slate-200 transition hover:bg-slate-800 hover:text-white"
                onClick={() => openRecordMenu("timeline")}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-slate-300">
                    Record Full Video
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Duration:{" "}
                    {formatTime(Math.floor(getTotalDuration(clipsToSearch)))}
                  </span>
                </div>
                <i className="icon-[ri--movie-2-line] h-4 w-4 text-blue-400" />
              </button>
            </div>
          );
        })()}

        {(() => {
          if (currentRoute === "/image") {
            return (
              <button
                title="Save Thumbnail Image"
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded border border-blue-500/35 bg-blue-600 px-3 text-[10px] font-bold tracking-wider text-white uppercase shadow-md transition hover:bg-blue-500"
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
                <i className="icon-[ri--download-line] h-3.5 w-3.5" />
                <span>Save Thumbnail</span>
              </button>
            );
          }

          const musicClipsCount = musicClips.length;
          const hasMultipleMusic = musicClipsCount >= 2;

          return (
            <button
              title={hasMultipleMusic ? "Record video options" : "Record video"}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-[10px] font-bold tracking-wider uppercase transition md:px-3 ${isRecording ? "border border-red-500/50 bg-red-500/20 text-red-500" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}
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
              <div
                className={`h-1.5 w-1.5 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-slate-600"}`}
              />
              <span className="hidden sm:inline">
                {isRecording ? "Stop" : "Record Video"}
              </span>
              {!isRecording && hasMultipleMusic && (
                <i className="ml-0.5 icon-[ri--arrow-up-s-line] h-3.5 w-3.5" />
              )}
            </button>
          );
        })()}
      </div>
    </div>
  );
};
