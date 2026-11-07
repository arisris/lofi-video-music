// Timeline: header Tracks, ruler, track rows, bottom Add Music + zoom.
// Interactions (move/resize across tracks, snap, audio-synced scrub, wheel)
// adapted from src_old/components/timeline/; drag state lives in timeline-drag.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "../../shared/lib/format";
import { revokeClipUrls } from "../../shared/lib/media-urls";
import { Button } from "../../shared/ui/Button";
import { RangeInput } from "../../shared/ui/RangeInput";
import { getTotalDuration, useEditorStore } from "../../store/editor-store";
import type { TimelineClip } from "../../shared/types/clip";
import { getClipDef } from "../clips";
import { VFX_ICONS } from "../vfx";
import {
  beginClipDrag,
  beginPlayheadDrag,
  handleWheelNative,
} from "./timeline-drag";
import { seekTo } from "../audio/audio-engine";
import { ClipContextMenu } from "./ClipContextMenu";

const TRACK_ROW_H = 48;

function trackIdOf(c: TimelineClip, tracks: Array<{ id: string }>, secondId: string): string {
  if (c.trackId && tracks.some((t) => t.id === c.trackId)) return c.trackId;
  return c.type === "music" ? "track-1" : secondId;
}

function clipLabel(c: TimelineClip): string {
  const s = c.settings as Record<string, unknown>;
  if (c.type === "music") return typeof s.name === "string" && s.name ? s.name : "Music";
  if (c.type === "background" || c.type === "overlay")
    return typeof s.fileName === "string" && s.fileName
      ? s.fileName
      : c.type === "background"
        ? "Background"
        : "Overlay";
  if (c.type === "glviz")
    return `Shader (${typeof s.style === "string" ? s.style : "bars"})`;
  if (typeof s.content === "string" && s.content) return s.content;
  return getClipDef(c.type)?.name ?? c.type;
}

function ClipBlock({ clip, zoom, selected }: { clip: TimelineClip; zoom: number; selected: boolean }) {
  const s = clip.settings as Record<string, unknown>;
  const isDurationLocked =
    clip.type === "overlay" && s.mediaType === "video" && s.loop === false;

  const clipClass = selected
    ? clip.type === "music"
      ? "bg-emerald-600/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      : "bg-blue-600/40 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
    : clip.type === "music"
      ? "bg-emerald-800/40 border-emerald-700/50 hover:bg-emerald-800/60 hover:border-emerald-600"
      : "bg-neutral-700/60 border-neutral-600 hover:bg-neutral-700 hover:border-neutral-500";

  const isVideo =
    (clip.type === "background" && s.mediaType === "video") ||
    (clip.type === "overlay" && s.mediaType === "video");
  const videoDuration = typeof s.videoDuration === "number" ? s.videoDuration : 0;
  const speed = typeof s.speed === "number" ? s.speed : 1.0;
  const visualLen = videoDuration / speed;
  const markers: number[] = [];
  if (isVideo && videoDuration > 0 && visualLen > 0.05) {
    if (s.loop !== false) {
      let count = 0;
      for (let t = visualLen; t < clip.duration - 0.05 && count < 500; t += visualLen) {
        markers.push(t);
        count++;
      }
    } else if (visualLen < clip.duration - 0.05) {
      markers.push(visualLen);
    }
  }

  const thumbnail = typeof s.thumbnail === "string" ? s.thumbnail : null;
  const vfxIcon = VFX_ICONS[clip.type];
  const icon =
    clip.type === "music"
      ? "icon-[ri--music-2-line] h-3 w-3 shrink-0 text-emerald-400"
      : clip.type === "text"
        ? "icon-[ri--text-spacing] h-3 w-3 shrink-0 text-neutral-300"
        : clip.type === "glviz"
          ? "icon-[ri--shapes-line] h-3 w-3 shrink-0 text-neutral-300"
          : vfxIcon
            ? `${vfxIcon} h-3 w-3 shrink-0 text-violet-300`
            : "icon-[ri--image-line] h-3 w-3 shrink-0 text-neutral-300";

  return (
    <div
      className={`absolute top-2 bottom-2 rounded border transition-colors ${clipClass}`}
      style={{ left: `${clip.start * zoom}px`, width: `${Math.max(1, clip.duration * zoom)}px` }}
      onMouseDown={(e) => beginClipDrag(e, clip, "move")}
    >
      {markers.map((t) => (
        <div
          key={`marker-${t}`}
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-px border-l border-dashed border-cyan-400/60"
          style={{ left: `${t * zoom}px` }}
        />
      ))}
      {!isDurationLocked && (
        <div
          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize rounded-l transition-colors hover:bg-blue-400/50"
          onMouseDown={(e) => beginClipDrag(e, clip, "resize-start")}
        />
      )}
      {!isDurationLocked && (
        <div
          className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize rounded-r transition-colors hover:bg-blue-400/50"
          onMouseDown={(e) => beginClipDrag(e, clip, "resize-end")}
        />
      )}
      <div className="pointer-events-none flex h-full w-full items-center gap-2 overflow-hidden px-2">
        {(clip.type === "background" || clip.type === "overlay") && thumbnail ? (
          <img src={thumbnail} className="h-4 w-4 shrink-0 rounded border border-neutral-600 object-cover" />
        ) : (
          <i className={icon} />
        )}
        <span className="truncate text-[9px] font-medium text-white">{clipLabel(clip)}</span>
      </div>
    </div>
  );
}

export function Timeline() {
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedTrackId = useEditorStore((s) => s.selectedTrackId);
  const currentTime = useEditorStore((s) => s.currentTime);
  const zoom = useEditorStore((s) => s.timelineZoom);
  const scrollLeft = useEditorStore((s) => s.timelineScrollLeft);
  const scrollTop = useEditorStore((s) => s.timelineScrollTop);
  const snapLines = useEditorStore((s) => s.snapLines);
  const pastLen = useEditorStore((s) => s.past.length);
  const futureLen = useEditorStore((s) => s.future.length);
  const isRecording = useEditorStore((s) => s.isRecording);

  const [menu, setMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const tracksAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tracksAreaRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", handleWheelNative);
  }, []);

  const secondId = tracks[1]?.id ?? tracks[0]?.id ?? "track-2";
  const totalDuration = useMemo(() => getTotalDuration(clips), [clips]);
  const timelineWidth = totalDuration * zoom;

  const byTrack = useMemo(() => {
    const map = new Map<string, TimelineClip[]>();
    for (const t of tracks) map.set(t.id, []);
    for (const c of clips) {
      const tid = trackIdOf(c, tracks, secondId);
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(c);
    }
    return map;
  }, [clips, tracks, secondId]);

  const rulerMajors = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= totalDuration; t += 10) out.push(t);
    return out;
  }, [totalDuration]);
  const rulerMinors = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= totalDuration; t += 2) {
      if (t % 10 !== 0) out.push(t);
    }
    return out;
  }, [totalDuration]);

  const seekFromClientX = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    seekTo((clientX - rect.left + scrollLeft) / zoom);
  };

  return (
    <div className="flex h-64 flex-col overflow-hidden border-t border-neutral-800 bg-neutral-900 select-none">
      {/* Header */}
      <div className="flex h-8 flex-none border-b border-neutral-800 bg-neutral-950/50">
        <div className="flex w-32 shrink-0 items-center justify-between border-r border-neutral-800 px-3">
          <span className="text-[9px] font-bold tracking-widest text-neutral-500 uppercase">
            Tracks
          </span>
          <button
            className="flex cursor-pointer items-center justify-center rounded p-0.5 text-green-500 transition-colors hover:bg-neutral-800/80 hover:text-white"
            title="Add Track"
            onClick={() => {
              const st = useEditorStore.getState();
              const id = `track-${Date.now()}`;
              useEditorStore.setState({
                tracks: [...st.tracks, { id, name: `Track ${st.tracks.length + 1}` }],
              });
            }}
          >
            <i className="icon-[ri--add-line] h-4 w-4" />
          </button>
        </div>
        <div
          className="relative flex-1 cursor-crosshair overflow-hidden"
          onMouseDown={(e) => beginPlayheadDrag(e, scrollLeft, zoom)}
        >
          <div className="absolute top-0 flex h-full items-end" style={{ left: `${-scrollLeft}px`, width: `${timelineWidth}px` }}>
            {rulerMajors.map((t) => (
              <div
                key={`ruler-${t}`}
                className="absolute flex h-3 flex-col justify-end border-l border-neutral-700 px-1 pb-1"
                style={{ left: `${t * zoom}px` }}
              >
                <span className="font-mono text-[8px] text-neutral-500">{formatTime(t)}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-0 flex h-full items-end" style={{ left: `${-scrollLeft}px`, width: `${timelineWidth}px` }}>
            {rulerMinors.map((t) => (
              <div
                key={`sub-${t}`}
                className="absolute h-1.5 border-l border-neutral-800"
                style={{ left: `${t * zoom}px` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div ref={tracksAreaRef} className="flex flex-1 overflow-hidden">
        {/* Track headers */}
        <div className="relative z-10 w-32 shrink-0 overflow-hidden border-r border-neutral-800 bg-neutral-900">
          <div className="absolute right-0 left-0" style={{ top: `${-scrollTop}px` }}>
            {tracks.map((track, i) => {
              const isMusicTrack = track.id === "track-1" || i === 0;
              const isSelected = selectedTrackId === track.id;
              const borderClass = isSelected
                ? isMusicTrack
                  ? "bg-emerald-600/10 border-r-2 border-r-emerald-500"
                  : "bg-blue-600/10 border-r-2 border-r-blue-500"
                : "hover:bg-neutral-800/40";
              const textClass = isSelected
                ? isMusicTrack
                  ? "text-emerald-400"
                  : "text-blue-400"
                : "text-neutral-400";
              const locked = track.locked;
              return (
                <div
                  key={track.id}
                  className={`group flex h-12 cursor-pointer items-center gap-2 border-b border-neutral-800/50 px-3 transition-colors ${borderClass}`}
                  onClick={() => useEditorStore.setState({ selectedTrackId: track.id })}
                >
                  {isMusicTrack ? (
                    <i
                      className="icon-[ri--music-2-line] h-3.5 w-3.5 shrink-0 text-emerald-500"
                      title="Dedicated Music Track"
                    />
                  ) : (
                    <button
                      className={`p-1 transition-colors ${locked ? "text-yellow-500" : "text-neutral-600 hover:text-neutral-400"}`}
                      title={locked ? "Unlock Track" : "Lock Track"}
                      onClick={(e) => {
                        e.stopPropagation();
                        const cur = useEditorStore.getState().tracks.map((t) =>
                          t.id === track.id ? { ...t, locked: !t.locked } : t,
                        );
                        useEditorStore.setState({ tracks: cur });
                      }}
                    >
                      <i className={`${locked ? "icon-[ri--lock-fill]" : "icon-[ri--lock-unlock-line]"} h-3.5 w-3.5`} />
                    </button>
                  )}
                  <span className={`flex-1 truncate text-[10px] font-bold tracking-tighter uppercase ${textClass}`}>
                    {track.name}
                  </span>
                  {i > 1 && (
                    <button
                      className="p-1 text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      title="Delete Track (And its clips)"
                      onClick={(e) => {
                        e.stopPropagation();
                        const st = useEditorStore.getState();
                        const hasClips = st.clips.some(
                          (c) => trackIdOf(c, st.tracks, secondId) === track.id,
                        );
                        if (!hasClips || confirm(`Delete ${track.name} and all clips inside it?`)) {
                          for (const c of st.clips) {
                            if (trackIdOf(c, st.tracks, secondId) === track.id) {
                              revokeClipUrls(c, st);
                            }
                          }
                          useEditorStore.setState({
                            tracks: st.tracks.filter((t) => t.id !== track.id),
                            clips: st.clips.filter(
                              (c) => trackIdOf(c, st.tracks, secondId) !== track.id,
                            ),
                            selectedTrackId:
                              st.selectedTrackId === track.id ? tracks[0].id : st.selectedTrackId,
                          });
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

        {/* Clips area */}
        <div id="timeline-content-area" className="relative flex-1 overflow-hidden bg-neutral-950/40">
          {/* Grid */}
          <div className="pointer-events-none absolute inset-0" style={{ left: `${-scrollLeft}px`, width: `${timelineWidth}px` }}>
            {rulerMajors.map((t) => (
              <div key={`grid-${t}`} className="absolute top-0 bottom-0 border-l border-neutral-800/40" style={{ left: `${t * zoom}px` }} />
            ))}
          </div>
          {/* Snap lines */}
          {snapLines.map((line, idx) => (
            <div
              key={`snap-${idx}`}
              className={
                line.isVideoSnap
                  ? "absolute w-px bg-cyan-400/90 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                  : "absolute top-0 bottom-0 w-px bg-yellow-400/80 z-30 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.5)]"
              }
              style={
                line.isVideoSnap
                  ? {
                      left: `${line.time * zoom - scrollLeft}px`,
                      top: `${(line.trackIdx ?? 0) * TRACK_ROW_H - scrollTop}px`,
                      height: "48px",
                    }
                  : { left: `${line.time * zoom - scrollLeft}px` }
              }
            />
          ))}
          {/* Rows */}
          <div
            className="absolute right-0 left-0"
            style={{ left: `${-scrollLeft}px`, top: `${-scrollTop}px`, width: `${timelineWidth}px` }}
          >
            {tracks.map((track) => (
              <div
                key={track.id}
                className="relative h-12 border-b border-neutral-800/30"
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) seekFromClientX(e.clientX, e.currentTarget);
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {(byTrack.get(track.id) ?? []).map((clip) => (
                  <div
                    key={clip.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      useEditorStore.setState({ selectedClipId: clip.id });
                      setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        clipId: clip.id,
                      });
                    }}
                  >
                    <ClipBlock clip={clip} zoom={zoom} selected={selectedClipId === clip.id} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
            style={{ left: `${currentTime * zoom - scrollLeft}px` }}
          >
            <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-blue-500" />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex h-10 flex-none items-center justify-between border-t border-neutral-800 bg-neutral-950 px-4">
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
                (e.target as HTMLInputElement).value = "";
                files.forEach((file) => {
                  const url = URL.createObjectURL(file);
                  const audio = new Audio();
                  audio.src = url;
                  audio.onloadedmetadata = () => {
                    const st = useEditorStore.getState();
                    const musics = st.clips.filter((c) => c.type === "music");
                    const start =
                      musics.length > 0 ? Math.max(...musics.map((c) => c.start + c.duration)) : 0;
                    st.addClip({
                      id: `clip-music-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                      type: "music",
                      trackId: "track-1",
                      start,
                      duration:
                        Number.isFinite(audio.duration) && audio.duration > 0
                          ? audio.duration
                          : 60,
                      settings: {
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        audioUrl: url,
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
                    } as TimelineClip);
                  };
                });
              }}
            />
          </label>
          <div className="mx-2 h-4 w-px bg-neutral-800" />
          <span className="font-mono text-[10px] text-neutral-400">
            <span className="text-blue-400">{formatTime(currentTime)}</span>
            {" / "}
            {formatTime(totalDuration)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="p-1 text-neutral-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="Undo (Ctrl+Z)"
            disabled={isRecording || pastLen === 0}
            onClick={() => useEditorStore.getState().undo()}
          >
            <i className="icon-[ri--arrow-go-back-line] h-3.5 w-3.5" />
          </button>
          <button
            className="p-1 text-neutral-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
            disabled={isRecording || futureLen === 0}
            onClick={() => useEditorStore.getState().redo()}
          >
            <i className="icon-[ri--arrow-go-forward-line] h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-neutral-800" />
          <Button
            variant="iconGhost"
            title="Zoom out"
            onClick={() => useEditorStore.setState({ timelineZoom: Math.max(0.1, zoom * 0.8) })}
          >
            <i className="icon-[ri--zoom-out-line] h-3.5 w-3.5" />
          </Button>
          <RangeInput
            value={zoom}
            min={0.1}
            max={50}
            step={0.1}
            onChange={(v) => useEditorStore.setState({ timelineZoom: v })}
            ariaLabel="Timeline zoom"
            className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-neutral-800"
          />
          <Button
            variant="iconGhost"
            title="Zoom in"
            onClick={() => useEditorStore.setState({ timelineZoom: Math.min(50, zoom * 1.2) })}
          >
            <i className="icon-[ri--zoom-in-line] h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <ClipContextMenu x={menu.x} y={menu.y} clipId={menu.clipId} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
