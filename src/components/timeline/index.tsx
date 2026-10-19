import { useEffect, useReducer, useRef } from "react";
import {
  getTotalDuration,
  getGlobalTime,
  getClipsToSearch,
  formatTime,
  revokeClipUrls,
} from "../../utils/helpers";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { setRequestRedraw, redraw, beginPlayheadDrag, getContextMenu, handleWheelNative } from "./drag";
import { RulerTicks } from "./ruler-ticks";
import { GridLines } from "./grid-lines";
import { SnapLines } from "./snap-lines";
import { Playhead } from "./playhead";
import { TrackRow } from "./track-row";
import { TimelineContextMenu } from "./context-menu";

export const Timeline = () => {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  setRequestRedraw(forceUpdate);

  useEditorStore((s) => s.currentTime);
  useEditorStore((s) => s.selectedClipId);
  useEditorStore((s) => s.timelineZoom);
  useEditorStore((s) => s.timelineScrollLeft);
  useEditorStore((s) => s.timelineScrollTop);

  const tracksAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tracksAreaRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", handleWheelNative);
  }, []);

  useEffect(() => () => void setRequestRedraw(null), []);

  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state as never) as any[];
  const totalDuration = getTotalDuration(clipsToSearch as never);
  const globalTime = getGlobalTime(state as never);
  const zoom = state.timelineZoom;

  const timelineWidth = totalDuration * zoom;

  const timelineArea = document.getElementById("timeline-content-area");
  const visibleWidth = timelineArea
    ? timelineArea.clientWidth
    : window.innerWidth - 128;
  const showHorizScrollbar = timelineWidth > visibleWidth;
  const maxScrollLeft = Math.max(0, timelineWidth - visibleWidth);

  const scrollLeft = Math.max(
    0,
    Math.min(maxScrollLeft, state.timelineScrollLeft || 0),
  );

  const totalTracksHeight = state.timelineTracks.length * 48;
  const visibleHeight = 180;
  const showScrollbar = totalTracksHeight > visibleHeight;
  const maxScrollTop = Math.max(0, totalTracksHeight - visibleHeight);

  const scrollTop = Math.max(
    0,
    Math.min(maxScrollTop, state.timelineScrollTop || 0),
  );

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

  const contextMenu = getContextMenu();

  return (
    <div className="flex h-64 flex-col overflow-hidden border-t border-slate-800 bg-slate-900 select-none">
      <div className="flex h-8 flex-none border-b border-slate-800 bg-slate-950/50">
        <div className="flex w-32 shrink-0 items-center justify-between border-r border-slate-800 px-3">
          <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
            Tracks
          </span>
          <button
            className="flex cursor-pointer items-center justify-center rounded p-0.5 text-green-500 transition-colors hover:bg-slate-800/80 hover:text-white"
            title="Add Track"
            onClick={() => {
              const id = `track-${Date.now()}`;
              editorStore.setState({
                timelineTracks: [
                  ...editorStore.getState().timelineTracks,
                  {
                    id,
                    name: `Track ${editorStore.getState().timelineTracks.length + 1}`,
                    locked: false,
                  },
                ],
              });
              redraw();
            }}
          >
            <i className="icon-[ri--add-line] h-4 w-4" />
          </button>
        </div>
        <div
          className="relative flex-1 cursor-crosshair overflow-hidden"
          onMouseDown={(e) => {
            beginPlayheadDrag(e, scrollLeft, zoom);
          }}
        >
          <RulerTicks
            totalDuration={totalDuration}
            zoom={zoom}
            scrollLeft={scrollLeft}
          />
        </div>
      </div>

      <div ref={tracksAreaRef} className="flex flex-1 overflow-hidden">
        <div className="relative z-10 w-32 shrink-0 overflow-hidden border-r border-slate-800 bg-slate-900">
          <div
            className="absolute right-0 left-0"
            style={{ top: `${-scrollTop}px` }}
          >
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
                  className={`group flex h-12 cursor-pointer items-center gap-2 border-b border-slate-800/50 px-3 transition-colors ${borderClass}`}
                  onClick={() => {
                    editorStore.setState({ selectedTrackId: track.id });
                    redraw();
                  }}
                >
                  {isMusicTrack ? (
                    <i
                      className="icon-[ri--music-2-line] h-3.5 w-3.5 shrink-0 text-emerald-500"
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
                        className={`${track.locked ? "icon-[ri--lock-fill]" : "icon-[ri--lock-unlock-line]"} h-3.5 w-3.5`}
                      />
                    </button>
                  )}

                  <span
                    className={`flex-1 truncate text-[10px] font-bold tracking-tighter uppercase ${textClass}`}
                  >
                    {track.name}
                  </span>

                  {i > 1 && (
                    <button
                      className="p-1 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      title="Delete Track (And its clips)"
                      onClick={(e) => {
                        e.stopPropagation();
                        const hasClips = state.timelineClips.some(
                          (c: any) => c.trackId === track.id,
                        );
                        if (
                          !hasClips ||
                          confirm(
                            `Delete ${track.name} and all clips inside it?`,
                          )
                        ) {
                          const clipsToDelete = state.timelineClips.filter(
                            (c: any) => c.trackId === track.id,
                          );
                          editorStore.setState({
                            timelineTracks: state.timelineTracks.filter(
                              (t: any) => t.id !== track.id,
                            ),
                            timelineClips: state.timelineClips.filter(
                              (c: any) => c.trackId !== track.id,
                            ),
                          });
                          clipsToDelete.forEach((c: any) =>
                            revokeClipUrls(c, state as never),
                          );
                          // revoke via helper import not available here; call below
                          if (state.selectedTrackId === track.id) {
                            editorStore.setState({
                              selectedTrackId: state.timelineTracks[0].id,
                            });
                          }
                          redraw();
                        }
                      }}
                    >
                      <i className="icon-[ri--delete-bin-7-line] h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          id="timeline-content-area"
          className="relative flex-1 overflow-hidden bg-slate-950/40"
        >
          <SnapLines
            snapLines={state.snapLines}
            zoom={zoom}
            scrollLeft={scrollLeft}
            scrollTop={state.timelineScrollTop || 0}
          />

          <GridLines
            totalDuration={totalDuration}
            zoom={zoom}
            scrollLeft={scrollLeft}
          />

          <div
            className="absolute right-0 left-0"
            style={{
              left: `${-scrollLeft}px`,
              top: `${-scrollTop}px`,
              width: `${timelineWidth}px`,
            }}
          >
            {state.timelineTracks.map((track: any) => (
              <TrackRow
                key={track.id}
                clips={state.timelineClips.filter(
                  (c: any) => c.trackId === track.id,
                )}
                zoom={zoom}
                selectedClipId={state.selectedClipId}
              />
            ))}
          </div>

          <Playhead time={globalTime} zoom={zoom} scrollLeft={scrollLeft} />

          {showScrollbar && (
            <div
              className="absolute top-1 right-1 bottom-3 z-40 w-1.5 cursor-pointer rounded-full bg-slate-950/30 transition-all hover:bg-slate-950/50"
              onMouseDown={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const updateScroll = (clientY: number) => {
                  const clickY = clientY - rect.top;
                  const handleHeight = Math.max(
                    16,
                    (visibleHeight / totalTracksHeight) * rect.height,
                  );
                  const scrollPct =
                    rect.height > handleHeight
                      ? (clickY - handleHeight / 2) /
                        (rect.height - handleHeight)
                      : 0;
                  editorStore.setState({
                    timelineScrollTop: Math.max(
                      0,
                      Math.min(maxScrollTop, scrollPct * maxScrollTop),
                    ),
                  });
                };
                updateScroll(e.clientY);

                const onMouseMove = (me: MouseEvent) =>
                  updateScroll(me.clientY);
                const onMouseUp = () => {
                  window.removeEventListener("mousemove", onMouseMove);
                  window.removeEventListener("mouseup", onMouseUp);
                };
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div
                className="absolute w-full rounded-full bg-slate-600/60 transition-colors hover:bg-slate-500/80"
                style={{
                  height: `${Math.max(16, (visibleHeight / totalTracksHeight) * (visibleHeight - 16))}px`,
                  top: `${
                    maxScrollTop > 0
                      ? ((scrollTop || 0) / maxScrollTop) *
                        (visibleHeight -
                          16 -
                          Math.max(
                            16,
                            (visibleHeight / totalTracksHeight) *
                              (visibleHeight - 16),
                          ))
                      : 0
                  }px`,
                }}
              />
            </div>
          )}

          {showHorizScrollbar && (
            <div
              className="absolute right-3 bottom-1 left-1 z-40 h-1.5 cursor-pointer rounded-full bg-slate-950/30 transition-all hover:bg-slate-950/50"
              onMouseDown={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const updateScroll = (clientX: number) => {
                  const clickX = clientX - rect.left;
                  const handleWidth = Math.max(
                    16,
                    (visibleWidth / timelineWidth) * rect.width,
                  );
                  const scrollPct =
                    rect.width > handleWidth
                      ? (clickX - handleWidth / 2) / (rect.width - handleWidth)
                      : 0;
                  editorStore.setState({
                    timelineScrollLeft: Math.max(
                      0,
                      Math.min(maxScrollLeft, scrollPct * maxScrollLeft),
                    ),
                  });
                };
                updateScroll(e.clientX);

                const onMouseMove = (me: MouseEvent) =>
                  updateScroll(me.clientX);
                const onMouseUp = () => {
                  window.removeEventListener("mousemove", onMouseMove);
                  window.removeEventListener("mouseup", onMouseUp);
                };
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
              }}
            >
              <div
                className="absolute h-full rounded-full bg-slate-600/60 transition-colors hover:bg-slate-500/80"
                style={{
                  width: `${Math.max(16, (visibleWidth / timelineWidth) * (visibleWidth - 16))}px`,
                  left: `${
                    maxScrollLeft > 0
                      ? ((scrollLeft || 0) / maxScrollLeft) *
                        (visibleWidth -
                          16 -
                          Math.max(
                            16,
                            (visibleWidth / timelineWidth) *
                              (visibleWidth - 16),
                          ))
                      : 0
                  }px`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex h-10 flex-none items-center justify-between border-t border-slate-800 bg-slate-950 px-4">
        <div className="flex items-center gap-4">
          <label
            className="flex cursor-pointer items-center gap-2 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-lg transition hover:bg-emerald-500"
            title="Add Music Clip"
          >
            <i className="icon-[ri--music-2-line] h-3.5 w-3.5" />
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
                    const musicClips = (
                      getClipsToSearch(editorStore.getState() as never) as any[]
                    ).filter((c) => c.type === "music");
                    let start = 0;
                    if (musicClips.length > 0) {
                      start = Math.max(
                        ...musicClips.map((c) => c.start + c.duration),
                      );
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
                      editorStore.setState({
                        videoClips: [...(state.videoClips || []), newClip],
                      });
                    } else {
                      editorStore.setState({
                        timelineClips: [...state.timelineClips, newClip],
                      });
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
          <div className="mx-2 h-4 w-px bg-slate-800" />
          <span className="font-mono text-[10px] text-slate-400">
            <span className="text-blue-400">{formatTime(globalTime)}</span>
            {" / "}
            {formatTime(totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="p-1 text-slate-500 transition-colors hover:text-white"
            onClick={() => {
              editorStore.setState({
                timelineZoom: Math.max(0.1, state.timelineZoom * 0.8),
              });
              redraw();
            }}
          >
            <i className="icon-[ri--zoom-out-line] h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={0.1}
            max={50}
            step={0.1}
            value={zoom}
            onChange={(e) => {
              editorStore.setState({
                timelineZoom: parseFloat(e.target.value),
              });
              redraw();
            }}
            className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
          />
          <button
            className="p-1 text-slate-500 transition-colors hover:text-white"
            onClick={() => {
              editorStore.setState({
                timelineZoom: Math.min(50, state.timelineZoom * 1.2),
              });
              redraw();
            }}
          >
            <i className="icon-[ri--zoom-in-line] h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <TimelineContextMenu state={state} contextMenu={contextMenu} />
    </div>
  );
};

