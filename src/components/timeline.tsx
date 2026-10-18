import { useEffect, useReducer, useRef } from "react";
import {
  formatTime,
  getTotalDuration,
  getGlobalTime,
  cloneVids,
  cloneMediaElement,
  getClipsToSearch,
  revokeClipUrls,
} from "../utils/helpers";
import { applyAudioSettings } from "../lib/audio";
import { runtime } from "../lib/runtime";
import { editorStore, useEditorStore } from "../store/editor-store";

/**
 * Drag/menu state lives at module level so it survives re-renders.
 * Handlers mutate these freely (they run outside React) and call
 * `bumpClips()` afterwards, since plain variable changes are invisible to
 * React and cannot trigger a re-render on their own.
 */
let isDraggingPlayhead = false;
type DragState = {
  clipId: string;
  type: "move" | "resize-start" | "resize-end";
  startX: number;
  initialStart: number;
  initialDuration: number;
};
let isDraggingClip: DragState | null = null;
let contextMenu: { x: number; y: number; clipId: string } | null = null;

/** Re-render hook installed by the Timeline component at mount. */
let requestRedraw: (() => void) | null = null;
const redraw = () => requestRedraw?.();

const closeContextMenu = () => {
  if (contextMenu) {
    contextMenu = null;
    window.removeEventListener("mousedown", handleWindowMouseDownCloseMenu);
    window.removeEventListener("wheel", closeContextMenu);
    window.removeEventListener("resize", closeContextMenu);
    redraw();
  }
};

const handleWindowMouseDownCloseMenu = (e: MouseEvent) => {
  const menuEl = document.getElementById("timeline-context-menu");
  if (!menuEl || !menuEl.contains(e.target as Node)) {
    closeContextMenu();
  }
};

const showContextMenu = (e: { clientX: number; clientY: number }, clipId: string) => {
  contextMenu = { x: e.clientX, y: e.clientY, clipId };
  window.addEventListener("mousedown", handleWindowMouseDownCloseMenu);
  window.addEventListener("wheel", closeContextMenu, { passive: true });
  window.addEventListener("resize", closeContextMenu);
  redraw();
};

const seekGlobal = (globalTime: number) => {
  const state = editorStore.getState();
  if (state.isRecording) return;
  const clipsToSearch = getClipsToSearch(state as never) as any[];
  const totalDuration = getTotalDuration(clipsToSearch as never);
  const nextTime = Math.max(0, Math.min(totalDuration, globalTime));
  editorStore.setState({ currentTime: nextTime });

  const activeClip = clipsToSearch.find(
    (c) =>
      c.type === "music" &&
      c.settings?.enabled !== false &&
      nextTime >= c.start &&
      nextTime <= c.start + c.duration
  );

  if (activeClip) {
    const localTime = nextTime - activeClip.start;
    const playheadTime = localTime + (activeClip.settings.startOffset || 0);

    const getAbsoluteUrl = (url: string) => {
      if (!url) return "";
      try {
        return new URL(url, window.location.href).href;
      } catch {
        return url;
      }
    };

    const audio = runtime.audioEl!;
    const currentAudioSrc = getAbsoluteUrl(audio.src);
    const targetAudioSrc = getAbsoluteUrl(activeClip.settings.audioUrl);

    if (currentAudioSrc !== targetAudioSrc) {
      audio.src = activeClip.settings.audioUrl;
      applyAudioSettings(activeClip);

      const onLoaded = () => {
        if (playheadTime < (activeClip.settings.audioDuration || activeClip.duration)) {
          audio.currentTime = playheadTime;
          applyAudioSettings(activeClip);
          if (editorStore.getState().isPlaying) {
            audio.play().catch(() => {});
          }
        } else {
          audio.pause();
        }
        audio.removeEventListener("loadedmetadata", onLoaded);
      };
      audio.addEventListener("loadedmetadata", onLoaded);
    } else {
      if (playheadTime < (activeClip.settings.audioDuration || activeClip.duration)) {
        audio.currentTime = playheadTime;
        applyAudioSettings(activeClip);
        if (editorStore.getState().isPlaying && audio.paused) {
          audio.play().catch(() => {});
        }
      } else {
        audio.pause();
      }
    }
  } else {
    if (runtime.audioEl && !runtime.audioEl.paused) {
      runtime.audioEl.pause();
    }
  }
  redraw();
};

const handleWindowMouseMove = (e: MouseEvent) => {
  const state = editorStore.getState();
  const zoom = state.timelineZoom;
  const scrollLeft = state.timelineScrollLeft;

  if (isDraggingPlayhead) {
    const timelineArea = document.getElementById("timeline-content-area");
    if (!timelineArea) return;
    const rect = timelineArea.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left + scrollLeft);
    seekGlobal(x / zoom);
  }

  if (isDraggingClip) {
    const timelineArea = document.getElementById("timeline-content-area");
    if (!timelineArea) return;
    const rect = timelineArea.getBoundingClientRect();

    // 1. Calculate Track Switching (Y-Axis)
    const mouseY = e.clientY - rect.top + (state.timelineScrollTop || 0);
    const trackIndex = Math.max(0, Math.min(state.timelineTracks.length - 1, Math.floor(mouseY / 48))); // 48 is track height
    let targetTrackId = state.timelineTracks[trackIndex].id;

    // 2. Calculate Time Displacement (X-Axis)
    const dx = (e.clientX - isDraggingClip.startX) / zoom;
    const clip = state.timelineClips.find((c: any) => c.id === isDraggingClip?.clipId) as any;

    if (clip) {
      // Work on a copy; the store is updated immutably once at the end of the drag step.
      const nextClip: any = { ...clip, settings: { ...clip.settings } };
      const nextSnapLines: any[] = [];
      const currentTrack = state.timelineTracks.find((t: any) => t.id === clip.trackId);

      // Lock Check: Don't move if current track is locked (Track 1 is never locked from horizontal dragging)
      if (currentTrack && currentTrack.locked && currentTrack.id !== "track-1") {
        editorStore.setState({ snapLines: [] });
        return;
      }

      // Enforce track constraints: Music clips are locked to Track 1; other clips cannot enter Track 1
      if (clip.type === "music") {
        targetTrackId = "track-1";
      } else if (targetTrackId === "track-1") {
        targetTrackId = clip.trackId !== "track-1" ? clip.trackId : "track-2";
      }

      const targetTrack = state.timelineTracks.find((t: any) => t.id === targetTrackId);
      if (targetTrack && !targetTrack.locked) {
        nextClip.trackId = targetTrackId;
        editorStore.setState({ selectedTrackId: targetTrackId });
      }

      let newStart = clip.start;
      let newDur = clip.duration;

      if (isDraggingClip?.type === "move") {
        newStart = Math.max(0, isDraggingClip.initialStart + dx);
      } else if (isDraggingClip?.type === "resize-end") {
        if (clip.type === "music") {
          const maxDur = (clip.settings.audioDuration || clip.duration) - (clip.settings.startOffset || 0);
          newDur = Math.max(0.1, Math.min(maxDur, isDraggingClip.initialDuration + dx));
        } else {
          newDur = Math.max(0.1, isDraggingClip.initialDuration + dx);
        }
      } else if (isDraggingClip?.type === "resize-start") {
        if (clip.type === "music") {
          newStart = Math.max(0, isDraggingClip.initialStart + dx);
          const dStart = newStart - isDraggingClip.initialStart;
          let newOffset = (clip.settings.startOffset || 0) + dStart;

          if (newOffset < 0) {
            newOffset = 0;
            newStart = isDraggingClip.initialStart - (clip.settings.startOffset || 0);
          }
          const maxOffset = (clip.settings.audioDuration || clip.duration) - 0.1;
          if (newOffset > maxOffset) {
            newOffset = maxOffset;
            newStart = isDraggingClip.initialStart + (maxOffset - (clip.settings.startOffset || 0));
          }

          nextClip.settings.startOffset = newOffset;
          newDur = Math.max(0.1, isDraggingClip.initialDuration - (newStart - isDraggingClip.initialStart));
        } else {
          newStart = Math.max(0, isDraggingClip.initialStart + dx);
          const diff = clip.start - newStart;
          newDur = clip.duration + diff;
        }
      }

      // 3. Snapping Logic
      const SNAP_THRESHOLD = 10 / zoom; // 10 pixels in time units

      const snapPoints: number[] = [];

      // 1. Snap to other clips
      const clipsToSearch = getClipsToSearch(state as never) as any[];

      clipsToSearch.forEach((other) => {
        if (other.id === clip.id) return;
        snapPoints.push(other.start);
        snapPoints.push(other.start + other.duration);
      });

      // 2. Snap to Playhead
      snapPoints.push(getGlobalTime(state as never));

      // 3. Snap to Music Clip Boundaries
      clipsToSearch
        .filter((c) => c.type === "music" && c.id !== clip.id)
        .forEach((musicClip) => {
          snapPoints.push(musicClip.start);
          snapPoints.push(musicClip.start + musicClip.duration);
        });

      // Video-specific snap points (duration / speed and loops)
      const videoSnapPoints: number[] = [];
      const isVideo =
        (clip.type === "background" && clip.settings.bgType === "video") ||
        (clip.type === "overlay" && clip.settings.mediaType === "video");
      const videoDuration = clip.settings.videoDuration || 0;
      if (isVideo && typeof videoDuration === "number" && videoDuration > 0) {
        const speed = clip.settings.speed || 1.0;
        const visualVideoDuration = videoDuration / speed;
        if (typeof visualVideoDuration === "number" && visualVideoDuration > 0.05) {
          const shouldLoop = clip.settings.loop !== false;
          if (shouldLoop) {
            const maxMultiples = Math.max(5, Math.min(100, Math.ceil(300 / visualVideoDuration)));
            for (let i = 1; i <= maxMultiples; i++) {
              videoSnapPoints.push(clip.start + i * visualVideoDuration);
            }
          } else {
            videoSnapPoints.push(clip.start + visualVideoDuration);
          }
        }
      }

      let snapped = false;

      // 1. Check Video Specific Snaps first (Only during resize-end)
      if (isDraggingClip?.type === "resize-end") {
        const newEnd = newStart + newDur;
        for (const point of videoSnapPoints) {
          if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
            newDur = point - newStart;
            const trackIdx = state.timelineTracks.findIndex((t: any) => t.id === clip.trackId);
            nextSnapLines.push({
              time: point,
              type: "end",
              isVideoSnap: true,
              trackIdx: trackIdx >= 0 ? trackIdx : 0,
            });
            snapped = true;
            break;
          }
        }
      }

      // 2. Check Standard Snaps if not snapped to video duration
      if (!snapped) {
        if (isDraggingClip?.type === "move" || isDraggingClip?.type === "resize-start") {
          for (const point of snapPoints) {
            if (Math.abs(newStart - point) < SNAP_THRESHOLD) {
              newStart = point;
              nextSnapLines.push({ time: point, type: "start" });
              snapped = true;
              break;
            }
          }
        }
        if (!snapped && (isDraggingClip?.type === "move" || isDraggingClip?.type === "resize-end")) {
          const newEnd = newStart + newDur;
          for (const point of snapPoints) {
            if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
              newStart = isDraggingClip?.type === "move" ? point - newDur : newStart;
              newDur = isDraggingClip?.type === "resize-end" ? point - newStart : newDur;
              nextSnapLines.push({ time: point, type: "end" });
              break;
            }
          }
        }
      }

      // If the clip is a video overlay with loop disabled, enforce the video duration adjusted for speed!
      if (clip.type === "overlay" && clip.settings.mediaType === "video" && clip.settings.loop === false) {
        const speed = clip.settings.speed || 1.0;
        newDur = (clip.settings.videoDuration || clip.duration) / speed;
      }

      nextClip.start = Math.round(newStart * 100) / 100;
      nextClip.duration = Math.round(newDur * 100) / 100;

      editorStore.setState({
        snapLines: nextSnapLines as never,
        timelineClips: state.timelineClips.map((c) => (c.id === nextClip.id ? nextClip : c)),
      });
      redraw();
    }
  }
};

const handleWindowMouseUp = () => {
  if (isDraggingPlayhead || isDraggingClip) {
    isDraggingPlayhead = false;
    isDraggingClip = null;
    editorStore.setState({ snapLines: [] });
    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
    redraw();
  }
};

/** Non-passive wheel handler body (zoom / scroll). Shared by the native listener. */
const handleWheelNative = (e: WheelEvent) => {
  e.preventDefault();
  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state as never) as any[];
  const totalDuration = getTotalDuration(clipsToSearch as never);
  const timelineWidth = totalDuration * state.timelineZoom;

  const timelineArea = document.getElementById("timeline-content-area");
  const visibleWidth = timelineArea ? timelineArea.clientWidth : window.innerWidth - 128;
  const maxScrollLeft = Math.max(0, timelineWidth - visibleWidth);

  const totalTracksHeight = state.timelineTracks.length * 48;
  const maxScrollTop = Math.max(0, totalTracksHeight - 180);

  if (e.ctrlKey) {
    const delta = e.deltaY > 0 ? 0.8 : 1.2;
    const oldZoom = state.timelineZoom;
    const newZoom = Math.max(0.1, Math.min(50, oldZoom * delta));

    // Adjust scroll to keep playhead or mouse relatively stable
    const centerTime = (state.timelineScrollLeft + 400) / oldZoom;
    editorStore.setState({
      timelineZoom: newZoom,
      timelineScrollLeft: Math.max(0, Math.min(maxScrollLeft, centerTime * newZoom - 400)),
    });
  } else {
    if (e.shiftKey) {
      editorStore.setState({
        timelineScrollLeft: Math.max(0, Math.min(maxScrollLeft, state.timelineScrollLeft + e.deltaY + e.deltaX)),
      });
    } else if (maxScrollTop === 0) {
      // If vertical scroll is not needed, route scroll wheel to horizontal
      editorStore.setState({
        timelineScrollLeft: Math.max(
          0,
          Math.min(maxScrollLeft, state.timelineScrollLeft + e.deltaY + e.deltaX)
        ),
      });
    } else {
      editorStore.setState({
        timelineScrollLeft: Math.max(0, Math.min(maxScrollLeft, state.timelineScrollLeft + e.deltaX)),
        timelineScrollTop: Math.max(0, Math.min(maxScrollTop, state.timelineScrollTop + e.deltaY)),
      });
    }
  }
};

/** Multi-track timeline: ruler, tracks, clips, playhead, scrollbars. */
export const Timeline = () => {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  requestRedraw = forceUpdate;

  // External change triggers: per-frame playhead, cross-panel clip/selection
  // updates (pushed through the store) and zoom.
  useEditorStore((s) => s.currentTime);
  useEditorStore((s) => s.selectedClipId);
  useEditorStore((s) => s.timelineZoom);
  useEditorStore((s) => s.timelineScrollLeft);
  useEditorStore((s) => s.timelineScrollTop);

  const tracksAreaRef = useRef<HTMLDivElement>(null);

  // Non-passive native wheel listener (React onWheel is passive).
  useEffect(() => {
    const el = tracksAreaRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", handleWheelNative);
  }, []);

  useEffect(() => () => void (requestRedraw = null), []);

  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state as never) as any[];
  const totalDuration = getTotalDuration(clipsToSearch as never);
  const globalTime = getGlobalTime(state as never);
  const zoom = state.timelineZoom;

  const timelineWidth = totalDuration * zoom;

  const timelineArea = document.getElementById("timeline-content-area");
  const visibleWidth = timelineArea ? timelineArea.clientWidth : window.innerWidth - 128;
  const showHorizScrollbar = timelineWidth > visibleWidth;
  const maxScrollLeft = Math.max(0, timelineWidth - visibleWidth);

  // Clamp scrollLeft to valid bounds (stored value normalized via effect below)
  const scrollLeft = Math.max(0, Math.min(maxScrollLeft, state.timelineScrollLeft || 0));

  const totalTracksHeight = state.timelineTracks.length * 48;
  const visibleHeight = 180; // approximate visible height of tracks area
  const showScrollbar = totalTracksHeight > visibleHeight;
  const maxScrollTop = Math.max(0, totalTracksHeight - visibleHeight);

  // Clamp scrollTop to valid bounds
  const scrollTop = Math.max(0, Math.min(maxScrollTop, state.timelineScrollTop || 0));

  // Persist normalized scroll bounds back to the store after render.
  useEffect(() => {
    if (editorStore.getState().timelineScrollLeft !== scrollLeft) {
      editorStore.setState({ timelineScrollLeft: scrollLeft });
    }
  }, [scrollLeft]);
  useEffect(() => {
    if (editorStore.getState().timelineScrollTop !== scrollTop) {
      editorStore.setState({ timelineScrollTop: scrollTop });
    }
  }, [scrollTop]);

  return (
    <div className="flex flex-col h-64 bg-slate-900 border-t border-slate-800 select-none overflow-hidden">
      {/* TIMELINE HEADER / RULER */}
      <div className="flex-none h-8 border-b border-slate-800 flex bg-slate-950/50">
        <div className="w-32 shrink-0 border-r border-slate-800 flex items-center justify-between px-3">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tracks</span>
          <button
            className="text-green-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center p-0.5 rounded hover:bg-slate-800/80"
            title="Add Track"
            onClick={() => {
              const id = `track-${Date.now()}`;
              editorStore.setState({
                timelineTracks: [
                  ...editorStore.getState().timelineTracks,
                  { id, name: `Track ${editorStore.getState().timelineTracks.length + 1}`, locked: false },
                ],
              });
              redraw();
            }}
          >
            <i className="icon-[ri--add-line] w-4 h-4" />
          </button>
        </div>
        <div
          className="flex-1 relative overflow-hidden cursor-crosshair"
          onMouseDown={(e) => {
            isDraggingPlayhead = true;
            window.addEventListener("mousemove", handleWindowMouseMove);
            window.addEventListener("mouseup", handleWindowMouseUp);
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollLeft;
            seekGlobal(x / zoom);
          }}
        >
          {/* Ruler Markers */}
          <div
            className="absolute top-0 h-full flex items-end"
            style={{ left: `${-scrollLeft}px`, width: `${timelineWidth}px` }}
          >
            {(() => {
              const rulerLength =
                isNaN(totalDuration) || !isFinite(totalDuration) || totalDuration <= 0
                  ? 7
                  : Math.ceil(totalDuration / 10) + 1;
              return Array.from({ length: rulerLength }).map((_, i) => {
                const time = i * 10;
                return (
                  <div
                    key={`ruler-${time}`}
                    className="absolute h-3 border-l border-slate-700 flex flex-col justify-end pb-1 px-1"
                    style={{ left: `${time * zoom}px` }}
                  >
                    <span className="text-[8px] text-slate-500 font-mono">{formatTime(time)}</span>
                  </div>
                );
              });
            })()}
          </div>
          {/* Sub-markers (every 2 seconds) */}
          <div
            className="absolute top-0 h-full flex items-end"
            style={{ left: `${-scrollLeft}px`, width: `${timelineWidth}px` }}
          >
            {(() => {
              const subRulerLength =
                isNaN(totalDuration) || !isFinite(totalDuration) || totalDuration <= 0
                  ? 31
                  : Math.ceil(totalDuration / 2) + 1;
              return Array.from({ length: subRulerLength }).map((_, i) => {
                const time = i * 2;
                if (time % 10 === 0) return null;
                return (
                  <div
                    key={`sub-${time}`}
                    className="absolute h-1.5 border-l border-slate-800"
                    style={{ left: `${time * zoom}px` }}
                  />
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* TRACKS AREA */}
      <div ref={tracksAreaRef} className="flex-1 flex overflow-hidden">
        {/* Track Headers */}
        <div className="w-32 shrink-0 bg-slate-900 border-r border-slate-800 relative z-10 overflow-hidden">
          <div className="absolute left-0 right-0" style={{ top: `${-scrollTop}px` }}>
            {state.timelineTracks.map((track: any, i: number) => {
              const isMusicTrack = track.id === "track-1";
              const isSelected = state.selectedTrackId === track.id;
              const borderClass = isSelected
                ? isMusicTrack
                  ? "bg-emerald-600/10 border-r-2 border-r-emerald-500"
                  : "bg-blue-600/10 border-r-2 border-r-blue-500"
                : "hover:bg-slate-800/40";
              const textClass = isSelected
                ? isMusicTrack
                  ? "text-emerald-400"
                  : "text-blue-400"
                : "text-slate-400";

              return (
                <div
                  key={track.id}
                  className={`h-12 border-b border-slate-800/50 flex items-center px-3 gap-2 group transition-colors cursor-pointer ${borderClass}`}
                  onClick={() => {
                    editorStore.setState({ selectedTrackId: track.id });
                    redraw();
                  }}
                >
                  {isMusicTrack ? (
                    <i
                      className="icon-[ri--music-2-line] w-3.5 h-3.5 text-emerald-500 shrink-0"
                      title="Dedicated Music Track"
                    />
                  ) : (
                    <button
                      className={`p-1 transition-colors ${track.locked ? "text-yellow-500" : "text-slate-600 hover:text-slate-400"}`}
                      title={track.locked ? "Unlock Track" : "Lock Track"}
                      onClick={(e) => {
                        e.stopPropagation();
                        track.locked = !track.locked;
                        redraw();
                      }}
                    >
                      <i
                        className={`${track.locked ? "icon-[ri--lock-fill]" : "icon-[ri--lock-unlock-line]"} w-3.5 h-3.5`}
                      />
                    </button>
                  )}

                  <span className={`text-[10px] font-bold uppercase tracking-tighter truncate flex-1 ${textClass}`}>
                    {track.name}
                  </span>

                  {i > 1 && (
                    <button
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-opacity p-1"
                      title="Delete Track (And its clips)"
                      onClick={(e) => {
                        e.stopPropagation();
                        const hasClips = state.timelineClips.some((c: any) => c.trackId === track.id);
                        if (!hasClips || confirm(`Delete ${track.name} and all clips inside it?`)) {
                          const clipsToDelete = state.timelineClips.filter((c: any) => c.trackId === track.id);
                          editorStore.setState({
                            timelineTracks: state.timelineTracks.filter((t: any) => t.id !== track.id),
                            timelineClips: state.timelineClips.filter((c: any) => c.trackId !== track.id),
                          });
                          clipsToDelete.forEach((c: any) => revokeClipUrls(c, state as never));
                          if (state.selectedTrackId === track.id) {
                            editorStore.setState({ selectedTrackId: state.timelineTracks[0].id });
                          }
                          redraw();
                        }
                      }}
                    >
                      <i className="icon-[ri--delete-bin-7-line] w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Track Content Area */}
        <div id="timeline-content-area" className="flex-1 relative overflow-hidden bg-slate-950/40">
          {/* SNAP LINES */}
          {state.snapLines.map((line: any, idx: number) => {
            const snapClass = line.isVideoSnap
              ? "absolute w-px bg-cyan-400/90 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.6)]"
              : "absolute top-0 bottom-0 w-px bg-yellow-400/80 z-30 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.5)]";

            const style = line.isVideoSnap
              ? {
                  left: `${line.time * zoom - scrollLeft}px`,
                  top: `${line.trackIdx * 48 - (state.timelineScrollTop || 0)}px`,
                  height: "48px",
                }
              : { left: `${line.time * zoom - scrollLeft}px` };

            return <div key={`snap-${idx}`} className={snapClass} style={style} />;
          })}

          {/* Grid Lines (Vertical) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ left: `${-scrollLeft}px`, width: `${timelineWidth}px` }}
          >
            {Array.from({ length: Math.ceil(totalDuration / 10) + 1 }).map((_, i) => (
              <div
                key={`grid-${i}`}
                className="absolute h-full border-l border-slate-800/30"
                style={{ left: `${i * 10 * zoom}px` }}
              />
            ))}
          </div>

          {/* Track Rows */}
          <div
            className="absolute left-0 right-0"
            style={{ left: `${-scrollLeft}px`, top: `${-scrollTop}px`, width: `${timelineWidth}px` }}
          >
            {state.timelineTracks.map((track: any) => (
              <div key={track.id} className="h-12 border-b border-slate-800/30 relative">
                {/* Clips */}
                {state.timelineClips
                  .filter((c: any) => c.trackId === track.id)
                  .map((clip: any) => {
                    const isDurationLocked =
                      clip.type === "overlay" &&
                      clip.settings.mediaType === "video" &&
                      clip.settings.loop === false;
                    const isSelected = state.selectedClipId === clip.id;
                    const clipClass = isSelected
                      ? clip.type === "music"
                        ? "bg-emerald-600/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        : "bg-blue-600/40 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                      : clip.type === "music"
                        ? "bg-emerald-800/40 border-emerald-700/50 hover:bg-emerald-800/60 hover:border-emerald-600"
                        : "bg-slate-700/60 border-slate-600 hover:bg-slate-700 hover:border-slate-500";

                    const isVideo =
                      (clip.type === "background" && clip.settings.bgType === "video") ||
                      (clip.type === "overlay" && clip.settings.mediaType === "video");
                    const videoDuration = clip.settings.videoDuration || 0;
                    const speed = clip.settings.speed || 1.0;
                    const visualVideoDuration = videoDuration / speed;

                    const markers: number[] = [];
                    if (
                      isVideo &&
                      typeof videoDuration === "number" &&
                      videoDuration > 0 &&
                      typeof visualVideoDuration === "number" &&
                      visualVideoDuration > 0.05
                    ) {
                      const shouldLoop = clip.settings.loop !== false;
                      if (shouldLoop) {
                        const maxMarkers = 500;
                        let count = 0;
                        for (
                          let time = visualVideoDuration;
                          time < clip.duration - 0.05 && count < maxMarkers;
                          time += visualVideoDuration
                        ) {
                          markers.push(time);
                          count++;
                        }
                      } else if (visualVideoDuration < clip.duration - 0.05) {
                        markers.push(visualVideoDuration);
                      }
                    }

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-2 bottom-2 rounded border transition-all ${clipClass}`}
                        style={{ left: `${clip.start * zoom}px`, width: `${clip.duration * zoom}px` }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          showContextMenu(e, clip.id);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          editorStore.setState({
                            selectedClipId: clip.id,
                            activeClipTab: clip.type,
                            activeInspectorTab: "properties",
                          });
                          isDraggingClip = {
                            clipId: clip.id,
                            type: "move",
                            startX: e.clientX,
                            initialStart: clip.start,
                            initialDuration: clip.duration,
                          };
                          window.addEventListener("mousemove", handleWindowMouseMove);
                          window.addEventListener("mouseup", handleWindowMouseUp);
                        }}
                      >
                        {/* Original video duration/loop boundaries */}
                        {markers.map((time) => (
                          <div
                            key={`marker-${time}`}
                            className="absolute top-0 bottom-0 w-px border-l border-dashed border-cyan-400/60 pointer-events-none z-10"
                            style={{ left: `${time * zoom}px` }}
                          />
                        ))}
                        {/* Resize Handles */}
                        {!isDurationLocked && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-400/50 rounded-l transition-colors"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              isDraggingClip = {
                                clipId: clip.id,
                                type: "resize-start",
                                startX: e.clientX,
                                initialStart: clip.start,
                                initialDuration: clip.duration,
                              };
                              window.addEventListener("mousemove", handleWindowMouseMove);
                              window.addEventListener("mouseup", handleWindowMouseUp);
                            }}
                          />
                        )}
                        {!isDurationLocked && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-400/50 rounded-r transition-colors"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              isDraggingClip = {
                                clipId: clip.id,
                                type: "resize-end",
                                startX: e.clientX,
                                initialStart: clip.start,
                                initialDuration: clip.duration,
                              };
                              window.addEventListener("mousemove", handleWindowMouseMove);
                              window.addEventListener("mouseup", handleWindowMouseUp);
                            }}
                          />
                        )}
                        {/* Content Preview */}
                        <div className="flex items-center h-full px-2 gap-2 overflow-hidden pointer-events-none w-full">
                          {clip.type === "music" ? (
                            <i className="icon-[ri--music-2-line] w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (clip.type === "background" || clip.type === "overlay") && clip.settings?.thumbnail ? (
                            <img
                              src={clip.settings.thumbnail}
                              className="w-4 h-4 rounded object-cover border border-slate-600 shrink-0"
                            />
                          ) : (
                            <i
                              className={`${
                                clip.type === "text"
                                  ? "icon-[ri--text-spacing]"
                                  : clip.type === "visualizer"
                                    ? "icon-[ri--pulse-line]"
                                    : "icon-[ri--image-line]"
                              } w-3 h-3 text-slate-300 shrink-0`}
                            />
                          )}
                          <span className="text-[9px] text-white font-medium truncate">
                            {clip.type === "music"
                              ? clip.settings?.name || "Music"
                              : clip.type === "background" || clip.type === "overlay"
                                ? clip.settings?.fileName || (clip.type === "background" ? "Background" : "Overlay")
                                : clip.type === "visualizer"
                                  ? `Visualizer (${clip.settings?.style || "bars"})`
                                  : clip.settings?.content || clip.type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>

          {/* PLAYHEAD */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.8)]"
            style={{ left: `${globalTime * zoom - scrollLeft}px` }}
          >
            {/* Playhead Handle */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rotate-45" />
          </div>

          {/* VERTICAL SCROLLBAR */}
          {showScrollbar && (
            <div
              className="absolute right-1 top-1 bottom-3 w-1.5 bg-slate-950/30 rounded-full z-40 hover:bg-slate-950/50 transition-all cursor-pointer"
              onMouseDown={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const updateScroll = (clientY: number) => {
                  const clickY = clientY - rect.top;
                  const handleHeight = Math.max(16, (visibleHeight / totalTracksHeight) * rect.height);
                  const scrollPct = rect.height > handleHeight ? (clickY - handleHeight / 2) / (rect.height - handleHeight) : 0;
                  editorStore.setState({
                    timelineScrollTop: Math.max(0, Math.min(maxScrollTop, scrollPct * maxScrollTop)),
                  });
                };
                updateScroll(e.clientY);

                const onMouseMove = (me: MouseEvent) => updateScroll(me.clientY);
                const onMouseUp = () => {
                  window.removeEventListener("mousemove", onMouseMove);
                  window.removeEventListener("mouseup", onMouseUp);
                };
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div
                className="w-full bg-slate-600/60 rounded-full hover:bg-slate-500/80 transition-colors absolute"
                style={{
                  height: `${Math.max(16, (visibleHeight / totalTracksHeight) * (visibleHeight - 16))}px`,
                  top: `${
                    maxScrollTop > 0
                      ? ((scrollTop || 0) / maxScrollTop) *
                        (visibleHeight - 16 - Math.max(16, (visibleHeight / totalTracksHeight) * (visibleHeight - 16)))
                      : 0
                  }px`,
                }}
              />
            </div>
          )}

          {/* HORIZONTAL SCROLLBAR */}
          {showHorizScrollbar && (
            <div
              className="absolute left-1 right-3 bottom-1 h-1.5 bg-slate-950/30 rounded-full z-40 hover:bg-slate-950/50 transition-all cursor-pointer"
              onMouseDown={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const updateScroll = (clientX: number) => {
                  const clickX = clientX - rect.left;
                  const handleWidth = Math.max(16, (visibleWidth / timelineWidth) * rect.width);
                  const scrollPct = rect.width > handleWidth ? (clickX - handleWidth / 2) / (rect.width - handleWidth) : 0;
                  editorStore.setState({
                    timelineScrollLeft: Math.max(0, Math.min(maxScrollLeft, scrollPct * maxScrollLeft)),
                  });
                };
                updateScroll(e.clientX);

                const onMouseMove = (me: MouseEvent) => updateScroll(me.clientX);
                const onMouseUp = () => {
                  window.removeEventListener("mousemove", onMouseMove);
                  window.removeEventListener("mouseup", onMouseUp);
                };
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div
                className="h-full bg-slate-600/60 rounded-full hover:bg-slate-500/80 transition-colors absolute"
                style={{
                  width: `${Math.max(16, (visibleWidth / timelineWidth) * (visibleWidth - 16))}px`,
                  left: `${
                    maxScrollLeft > 0
                      ? ((scrollLeft || 0) / maxScrollLeft) *
                        (visibleWidth - 16 - Math.max(16, (visibleWidth / timelineWidth) * (visibleWidth - 16)))
                      : 0
                  }px`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* TIMELINE FOOTER / TOOLBAR */}
      <div className="flex-none h-10 border-t border-slate-800 bg-slate-950 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <label
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-md transition shadow-lg uppercase tracking-wider border border-emerald-500 cursor-pointer"
            title="Add Music Clip"
          >
            <i className="icon-[ri--music-2-line] w-3.5 h-3.5" />
            Add Music
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((file) => {
                  const audio = new Audio();
                  audio.src = URL.createObjectURL(file);
                  audio.onloadedmetadata = () => {
                    // Stack sequentially on Track 1
                    const musicClips = (getClipsToSearch(editorStore.getState() as never) as any[]).filter((c) => c.type === "music");
                    let start = 0;
                    if (musicClips.length > 0) {
                      start = Math.max(...musicClips.map((c) => c.start + c.duration));
                    }

                    const newClip = {
                      id: `clip-music-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                      type: "music",
                      trackId: "track-1",
                      start: start,
                      duration: audio.duration,
                      settings: {
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        audioUrl: audio.src,
                        audioDuration: audio.duration,
                        volume: 1.0,
                        playbackRate: 1.0,
                        pan: 0,
                        eqLow: 0,
                        eqMid: 0,
                        eqHigh: 0,
                        startOffset: 0,
                        enabled: true,
                      },
                    };
                    const isThumbnailMode = state.currentRoute === "/image";
                    if (isThumbnailMode) {
                      editorStore.setState({ videoClips: [...(state.videoClips || []), newClip] });
                    } else {
                      editorStore.setState({ timelineClips: [...state.timelineClips, newClip] });
                    }
                    editorStore.setState({
                      selectedClipId: newClip.id,
                      activeClipTab: "music",
                      activeInspectorTab: "properties",
                    });
                    redraw();
                  };
                });
              }}
            />
          </label>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          <span className="text-[10px] font-mono text-slate-400">
            <span className="text-blue-400">{formatTime(globalTime)}</span>
            {" / "}
            {formatTime(totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="text-slate-500 hover:text-white transition-colors p-1"
            onClick={() => {
              editorStore.setState({ timelineZoom: Math.max(0.1, state.timelineZoom * 0.8) });
              redraw();
            }}
          >
            <i className="icon-[ri--zoom-out-line] w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min={0.1}
            max={50}
            step={0.1}
            value={zoom}
            onChange={(e) => {
              editorStore.setState({ timelineZoom: parseFloat(e.target.value) });
              redraw();
            }}
            className="w-32 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
          />
          <button
            className="text-slate-500 hover:text-white transition-colors p-1"
            onClick={() => {
              editorStore.setState({ timelineZoom: Math.min(50, state.timelineZoom * 1.2) });
              redraw();
            }}
          >
            <i className="icon-[ri--zoom-in-line] w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div
          id="timeline-context-menu"
          className="fixed bg-slate-900 border border-slate-700/80 shadow-2xl rounded-lg py-1.5 min-w-[140px] z-[9999]"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              const original = state.timelineClips.find((c: any) => c.id === contextMenu?.clipId);
              if (original) {
                const settingsCopy = JSON.parse(JSON.stringify(original.settings));
                if (original.settings.mediaElement)
                  settingsCopy.mediaElement = cloneMediaElement(original.settings.mediaElement);
                if (original.settings.mediaElements) settingsCopy.mediaElements = cloneVids(original.settings.mediaElements);
                if (original.settings.bgElement) settingsCopy.bgElement = cloneMediaElement(original.settings.bgElement);
                if (original.settings.bgElements) settingsCopy.bgElements = cloneVids(original.settings.bgElements);
                if (original.settings.gifFrames) settingsCopy.gifFrames = original.settings.gifFrames;

                const duplicate = {
                  id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                  type: original.type,
                  trackId: original.trackId,
                  start: Math.round((original.start + original.duration) * 100) / 100,
                  duration: original.duration,
                  settings: settingsCopy,
                };
                editorStore.setState({
                  timelineClips: [...state.timelineClips, duplicate],
                  selectedClipId: duplicate.id,
                  activeClipTab: duplicate.type,
                  activeInspectorTab: "properties",
                });
              }
              closeContextMenu();
            }}
          >
            <i className="icon-[ri--file-copy-line] w-3.5 h-3.5 text-blue-400" />
            <span>Duplicate Clip</span>
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-red-600/20 hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              const clipToDelete = state.timelineClips.find((c: any) => c.id === contextMenu?.clipId);
              editorStore.setState({
                timelineClips: state.timelineClips.filter((c: any) => c.id !== contextMenu?.clipId),
              });
              if (clipToDelete) {
                revokeClipUrls(clipToDelete, editorStore.getState() as never);
              }
              if (state.selectedClipId === contextMenu?.clipId) {
                editorStore.setState({ selectedClipId: null });
              }
              closeContextMenu();
            }}
          >
            <i className="icon-[ri--delete-bin-line] w-3.5 h-3.5 text-red-400" />
            <span>Delete Clip</span>
          </button>
        </div>
      )}
    </div>
  );
};
