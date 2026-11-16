import { useEffect } from "react";
import { formatTime } from "../../shared/lib/format";
import {
  clipsForAudio,
  playAudio,
  pauseAudio,
  skipToNextTrack,
  skipToPrevTrack,
} from "../audio/audio-engine";
import { stopRecording } from "../recorder/recorder";
import { runtime } from "../../shared/lib/runtime";
import { getTotalDuration, useEditorStore } from "../../store/editor-store";

const RATIO_OPTIONS = [
  { ratio: "16:9", icon: "icon-[mdi--crop-landscape]" },
  { ratio: "9:16", icon: "icon-[mdi--crop-portrait]" },
];

const selectAspectRatio = (ratio: "16:9" | "9:16") => {
  useEditorStore.setState({ aspectRatio: ratio });
};

const openRecordMenu = (mode: "clip" | "timeline") => {
  useEditorStore.setState({
    showRecordMenu: false,
    pendingRecordMode: mode,
    showRecordSettingsModal: true,
  });
};

/** Bottom transport bar: aspect ratio, playback, and record controls. */
export function PlaybackControls() {
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const isRecording = useEditorStore((s) => s.isRecording);
  const playing = useEditorStore((s) => s.playing);
  const showRecordMenu = useEditorStore((s) => s.showRecordMenu);
  const route = useEditorStore((s) => s.route);
  const currentTime = useEditorStore((s) => s.currentTime);
  // Subscribe so musicClips (via clipsForAudio) is recomputed.
  useEditorStore((s) => s.clips);
  useEditorStore((s) => s.videoClips);

  // Close the record dropdown on any outside click.
  useEffect(() => {
    const closeMenu = () => {
      if (useEditorStore.getState().showRecordMenu) {
        useEditorStore.setState({ showRecordMenu: false });
      }
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  // Global undo/redo lives in use-global-shortcuts (single keydown handler).

  const musicClips = clipsForAudio().filter((c) => c.type === "music");

  return (
    <div
      role="toolbar"
      aria-label="Playback controls"
      className="flex w-full items-center justify-between gap-2 md:gap-4"
    >
      {/* Left: Aspect Ratio Switcher */}
      <div className="flex w-auto items-center gap-3 md:w-1/3">
        <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
          {RATIO_OPTIONS.map((item) => (
            <button
              key={item.ratio}
              title={item.ratio}
              aria-label={`Aspect ratio ${item.ratio}`}
              aria-pressed={aspectRatio === item.ratio}
              className={`flex h-7 cursor-pointer items-center justify-center gap-1 rounded px-2.5 text-[10px] font-bold transition outline-none focus-visible:outline-2 focus-visible:outline-blue-500 ${aspectRatio === item.ratio ? "bg-blue-600 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"}`}
              onClick={() => selectAspectRatio(item.ratio as "16:9" | "9:16")}
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
          aria-label="Previous track"
          title="Previous track"
          className="text-neutral-400 transition outline-none hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
          disabled={isRecording || musicClips.length === 0}
          onClick={() => skipToPrevTrack()}
        >
          <i className="icon-[ri--skip-back-fill] h-5 w-5" />
        </button>

        {/* Play / Pause */}
        <button
          aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full shadow-md transition outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${isRecording ? "cursor-not-allowed bg-neutral-800 text-neutral-500 opacity-30" : playing ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"}`}
          disabled={isRecording}
          onClick={() => (playing ? pauseAudio() : playAudio())}
        >
          <i
            className={`${playing ? "icon-[ri--pause-fill]" : "icon-[ri--play-fill]"} h-5 w-5`}
          />
        </button>

        {/* Skip Next */}
        <button
          aria-label="Next track"
          title="Next track"
          className="text-neutral-400 transition outline-none hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
          disabled={isRecording || musicClips.length === 0}
          onClick={() => skipToNextTrack()}
        >
          <i className="icon-[ri--skip-forward-fill] h-5 w-5" />
        </button>
      </div>

      {/* Right: Recording */}
      <div className="relative flex w-auto items-center justify-end gap-1.5 md:w-1/3 md:gap-2">
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={(e) => {
            e.stopPropagation();
            useEditorStore.setState({ showShortcutsHelp: true });
          }}
          className="flex h-8 w-8 items-center justify-center rounded text-neutral-500 transition outline-none hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <i className="icon-[ri--keyboard-line] h-4 w-4" />
        </button>
        {(() => {
          const showDropdown =
            showRecordMenu && !isRecording && musicClips.length >= 2;
          if (!showDropdown) return null;

          const activeClip = musicClips.find(
            (c) =>
              (c.settings?.enabled as boolean | undefined) !== false &&
              currentTime >= c.start &&
              currentTime <= c.start + c.duration,
          );
          const hasActiveClip = !!activeClip;
          const clipName =
            typeof activeClip?.settings?.name === "string"
              ? (activeClip.settings.name as string)
              : "";

          return (
            <div className="animate-in fade-in slide-in-from-bottom-2 absolute right-0 bottom-10 z-50 flex w-64 flex-col gap-1 rounded-xl border border-neutral-800 bg-neutral-900/95 p-2 shadow-2xl backdrop-blur-md duration-200">
              {/* Option 1: Record Current Clip */}
              <button
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-semibold tracking-wide transition ${hasActiveClip ? "text-neutral-200 hover:bg-neutral-800 hover:text-white" : "cursor-not-allowed text-neutral-600"}`}
                disabled={!hasActiveClip}
                onClick={() => openRecordMenu("clip")}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="font-bold text-neutral-300">
                    Record Current Clip
                  </span>
                  <span className="truncate text-[9px] text-neutral-500">
                    {hasActiveClip
                      ? `"${clipName}"`
                      : "No active clip under playhead"}
                  </span>
                </div>
                <i className="icon-[ri--music-2-line] h-4 w-4 shrink-0 text-emerald-400" />
              </button>

              {/* Option 2: Record Full Timeline */}
              <button
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-semibold tracking-wide text-neutral-200 transition hover:bg-neutral-800 hover:text-white"
                onClick={() => openRecordMenu("timeline")}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-neutral-300">
                    Record Full Video
                  </span>
                  <span className="text-[9px] text-neutral-500">
                    Duration: {formatTime(Math.floor(getTotalDuration(clipsForAudio())))}
                  </span>
                </div>
                <i className="icon-[ri--movie-2-line] h-4 w-4 text-blue-400" />
              </button>
            </div>
          );
        })()}

        {(() => {
          if (route === "/image") {
            return (
              <button
                title="Save Thumbnail Image"
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded border border-blue-500/35 bg-blue-600 px-3 text-[10px] font-bold tracking-wider text-white uppercase shadow-md transition hover:bg-blue-500"
                onClick={() => {
                  const canvas = runtime.canvas;
                  if (!canvas) return;
                  setTimeout(() => {
                    const dataURL = canvas.toDataURL("image/png");
                    const link = document.createElement("a");
                    link.download = `lofi-thumbnail-${Date.now()}.png`;
                    link.href = dataURL;
                    link.click();
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
              aria-label={isRecording ? "Stop recording" : "Record video"}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-[10px] font-bold tracking-wider uppercase transition outline-none focus-visible:outline-2 focus-visible:outline-blue-500 md:px-3 ${isRecording ? "border border-red-500/50 bg-red-500/20 text-red-500" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isRecording) {
                  stopRecording();
                } else if (hasMultipleMusic) {
                  useEditorStore.setState({ showRecordMenu: !showRecordMenu });
                } else {
                  openRecordMenu("timeline");
                }
              }}
            >
              <div
                className={`h-1.5 w-1.5 rounded-full ${isRecording ? "animate-pulse bg-red-500" : "bg-neutral-600"}`}
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
}

/** Backwards-compatible export name. */
export const TransportBar = PlaybackControls;
