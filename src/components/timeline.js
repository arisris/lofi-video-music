import m from "mithril";
import { State } from "../lib/state";
import { formatTime, getTotalDuration, getGlobalTime, cloneVids, cloneMediaElement, getClipsToSearch, revokeClipUrls } from "../utils/helpers";
import { applyAudioSettings } from "../lib/audio";
import { runtime } from "../lib/runtime";

let isDraggingPlayhead = false;
let isDraggingClip = null; // { clipId, type: 'move' | 'resize-start' | 'resize-end', startX, initialStart, initialDuration }
let contextMenu = null; // { x, y, clipId }

const closeContextMenu = () => {
  if (contextMenu) {
    contextMenu = null;
    window.removeEventListener("mousedown", handleWindowMouseDownCloseMenu);
    window.removeEventListener("wheel", closeContextMenu);
    window.removeEventListener("resize", closeContextMenu);
    m.redraw();
  }
};

const handleWindowMouseDownCloseMenu = (e) => {
  const menuEl = document.getElementById("timeline-context-menu");
  if (!menuEl || !menuEl.contains(e.target)) {
    closeContextMenu();
  }
};

const showContextMenu = (e, clipId) => {
  contextMenu = { x: e.clientX, y: e.clientY, clipId };
  window.addEventListener("mousedown", handleWindowMouseDownCloseMenu);
  window.addEventListener("wheel", closeContextMenu, { passive: true });
  window.addEventListener("resize", closeContextMenu);
  m.redraw();
};

const seekGlobal = (globalTime) => {
  if (State.isRecording) return;
  const clipsToSearch = getClipsToSearch(State);
  const totalDuration = getTotalDuration(clipsToSearch);
  State.currentTime = Math.max(0, Math.min(totalDuration, globalTime));
  
  const activeClip = clipsToSearch.find(c => 
    c.type === 'music' && 
    c.settings?.enabled !== false &&
    State.currentTime >= c.start && 
    State.currentTime <= c.start + c.duration
  );

  if (activeClip) {
    const localTime = State.currentTime - activeClip.start;
    const playheadTime = localTime + (activeClip.settings.startOffset || 0);
    
    const getAbsoluteUrl = (url) => {
      if (!url) return "";
      try {
        return new URL(url, window.location.href).href;
      } catch (e) {
        return url;
      }
    };

    const currentAudioSrc = getAbsoluteUrl(runtime.audioEl.src);
    const targetAudioSrc = getAbsoluteUrl(activeClip.settings.audioUrl);

    if (currentAudioSrc !== targetAudioSrc) {
      runtime.audioEl.src = activeClip.settings.audioUrl;
      applyAudioSettings(activeClip);
      
      const onLoaded = () => {
        if (playheadTime < (activeClip.settings.audioDuration || activeClip.duration)) {
          runtime.audioEl.currentTime = playheadTime;
          applyAudioSettings(activeClip);
          if (State.isPlaying) {
            runtime.audioEl.play().catch(() => {});
          }
        } else {
          runtime.audioEl.pause();
        }
        runtime.audioEl.removeEventListener('loadedmetadata', onLoaded);
      };
      runtime.audioEl.addEventListener('loadedmetadata', onLoaded);
    } else {
      if (playheadTime < (activeClip.settings.audioDuration || activeClip.duration)) {
        runtime.audioEl.currentTime = playheadTime;
        applyAudioSettings(activeClip);
        if (State.isPlaying && runtime.audioEl.paused) {
          runtime.audioEl.play().catch(() => {});
        }
      } else {
        runtime.audioEl.pause();
      }
    }
  } else {
    if (runtime.audioEl && !runtime.audioEl.paused) {
      runtime.audioEl.pause();
    }
  }
  m.redraw();
};

const handleWindowMouseMove = (e) => {
    const zoom = State.timelineZoom;
    const scrollLeft = State.timelineScrollLeft;

    if (isDraggingPlayhead) {
        const timelineArea = document.getElementById("timeline-content-area");
        if (!timelineArea) return;
        const rect = timelineArea.getBoundingClientRect();
        const x = Math.max(0, e.clientX - rect.left + scrollLeft);
        seekGlobal(x / zoom);
        m.redraw();
    }

    if (isDraggingClip) {
        const timelineArea = document.getElementById("timeline-content-area");
        if (!timelineArea) return;
        const rect = timelineArea.getBoundingClientRect();
        
        // 1. Calculate Track Switching (Y-Axis)
        const mouseY = e.clientY - rect.top + (State.timelineScrollTop || 0);
        const trackIndex = Math.max(0, Math.min(State.timelineTracks.length - 1, Math.floor(mouseY / 48))); // 48 is track height
        let targetTrackId = State.timelineTracks[trackIndex].id;

        // 2. Calculate Time Displacement (X-Axis)
        const dx = (e.clientX - isDraggingClip.startX) / zoom;
        const clip = State.timelineClips.find(c => c.id === isDraggingClip.clipId);
        
        if (clip) {
            const currentTrack = State.timelineTracks.find(t => t.id === clip.trackId);
            
            // Lock Check: Don't move if current track is locked (Track 1 is never locked from horizontal dragging)
            if (currentTrack && currentTrack.locked && currentTrack.id !== "track-1") {
                State.snapLines = [];
                return;
            }

            // Enforce track constraints: Music clips are locked to Track 1; other clips cannot enter Track 1
            if (clip.type === 'music') {
                targetTrackId = "track-1";
            } else if (targetTrackId === "track-1") {
                targetTrackId = clip.trackId !== "track-1" ? clip.trackId : "track-2";
            }

            const targetTrack = State.timelineTracks.find(t => t.id === targetTrackId);
            if (targetTrack && !targetTrack.locked) {
                clip.trackId = targetTrackId;
                State.selectedTrackId = targetTrackId;
            }

            let newStart = clip.start;
            let newDur = clip.duration;

            if (isDraggingClip.type === 'move') {
                newStart = Math.max(0, isDraggingClip.initialStart + dx);
            } else if (isDraggingClip.type === 'resize-end') {
                if (clip.type === 'music') {
                    const maxDur = (clip.settings.audioDuration || clip.duration) - (clip.settings.startOffset || 0);
                    newDur = Math.max(0.1, Math.min(maxDur, isDraggingClip.initialDuration + dx));
                } else {
                    newDur = Math.max(0.1, isDraggingClip.initialDuration + dx);
                }
            } else if (isDraggingClip.type === 'resize-start') {
                if (clip.type === 'music') {
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
                    
                    clip.settings.startOffset = newOffset;
                    newDur = Math.max(0.1, isDraggingClip.initialDuration - (newStart - isDraggingClip.initialStart));
                } else {
                    newStart = Math.max(0, isDraggingClip.initialStart + dx);
                    const diff = clip.start - newStart;
                    newDur = clip.duration + diff;
                }
            }

            // 3. Snapping Logic
            State.snapLines = [];
            const SNAP_THRESHOLD = 10 / zoom; // 10 pixels in time units
            
            const snapPoints = [];
            
            // 1. Snap to other clips
            const clipsToSearch = getClipsToSearch(State);

            clipsToSearch.forEach(other => {
                if (other.id === clip.id) return;
                snapPoints.push(other.start);
                snapPoints.push(other.start + other.duration);
            });

            // 2. Snap to Playhead
            snapPoints.push(getGlobalTime(State));

            // 3. Snap to Music Clip Boundaries
            clipsToSearch.filter(c => c.type === 'music' && c.id !== clip.id).forEach(musicClip => {
                snapPoints.push(musicClip.start);
                snapPoints.push(musicClip.start + musicClip.duration);
            });

            // Video-specific snap points (duration / speed and loops)
            const videoSnapPoints = [];
            const isVideo = (clip.type === 'background' && clip.settings.bgType === 'video') || (clip.type === 'overlay' && clip.settings.mediaType === 'video');
            const videoDuration = clip.settings.videoDuration || 0;
            if (isVideo && typeof videoDuration === 'number' && videoDuration > 0) {
                const speed = clip.settings.speed || 1.0;
                const visualVideoDuration = videoDuration / speed;
                if (typeof visualVideoDuration === 'number' && visualVideoDuration > 0.05) {
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
            if (isDraggingClip.type === 'resize-end') {
                const newEnd = newStart + newDur;
                for (const point of videoSnapPoints) {
                    if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
                        newDur = point - newStart;
                        const trackIdx = State.timelineTracks.findIndex(t => t.id === clip.trackId);
                        State.snapLines.push({ 
                            time: point, 
                            type: 'end', 
                            isVideoSnap: true,
                            trackIdx: trackIdx >= 0 ? trackIdx : 0
                        });
                        snapped = true;
                        break;
                    }
                }
            }

            // 2. Check Standard Snaps if not snapped to video duration
            if (!snapped) {
                if (isDraggingClip.type === 'move' || isDraggingClip.type === 'resize-start') {
                    for (const point of snapPoints) {
                        if (Math.abs(newStart - point) < SNAP_THRESHOLD) {
                            newStart = point;
                            State.snapLines.push({ time: point, type: 'start' });
                            snapped = true;
                            break;
                        }
                    }
                }
                if (!snapped && (isDraggingClip.type === 'move' || isDraggingClip.type === 'resize-end')) {
                    const newEnd = newStart + newDur;
                    for (const point of snapPoints) {
                        if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
                            newStart = isDraggingClip.type === 'move' ? point - newDur : newStart;
                            newDur = isDraggingClip.type === 'resize-end' ? point - newStart : newDur;
                            State.snapLines.push({ time: point, type: 'end' });
                            break;
                        }
                    }
                }
            }

            // If the clip is a video overlay with loop disabled, enforce the video duration adjusted for speed!
            if (clip.type === 'overlay' && clip.settings.mediaType === 'video' && clip.settings.loop === false) {
                const speed = clip.settings.speed || 1.0;
                newDur = (clip.settings.videoDuration || clip.duration) / speed;
            }

            clip.start = Math.round(newStart * 100) / 100;
            clip.duration = Math.round(newDur * 100) / 100;
            m.redraw();
        }
    }
};

const handleWindowMouseUp = () => {
    if (isDraggingPlayhead || isDraggingClip) {
        isDraggingPlayhead = false;
        isDraggingClip = null;
        State.snapLines = [];
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
        m.redraw();
    }
};

export const Timeline = {
  view() {
    const clipsToSearch = getClipsToSearch(State);
    const totalDuration = getTotalDuration(clipsToSearch); 
    const globalTime = getGlobalTime(State);
    const zoom = State.timelineZoom;

    const timelineWidth = totalDuration * zoom;

    const timelineArea = document.getElementById("timeline-content-area");
    const visibleWidth = timelineArea ? timelineArea.clientWidth : (window.innerWidth - 128);
    const showHorizScrollbar = timelineWidth > visibleWidth;
    const maxScrollLeft = Math.max(0, timelineWidth - visibleWidth);

    // Clamp scrollLeft to valid bounds
    State.timelineScrollLeft = Math.max(0, Math.min(maxScrollLeft, State.timelineScrollLeft || 0));
    const scrollLeft = State.timelineScrollLeft;

    const totalTracksHeight = State.timelineTracks.length * 48;
    const visibleHeight = 180; // approximate visible height of tracks area
    const showScrollbar = totalTracksHeight > visibleHeight;
    const maxScrollTop = Math.max(0, totalTracksHeight - visibleHeight);
    
    // Clamp scrollTop to valid bounds
    State.timelineScrollTop = Math.max(0, Math.min(maxScrollTop, State.timelineScrollTop || 0));
    const scrollTop = State.timelineScrollTop;

    return m("div", { 
      class: "flex flex-col h-64 bg-slate-900 border-t border-slate-800 select-none overflow-hidden" 
    }, [
      // TIMELINE HEADER / RULER
      m("div", { class: "flex-none h-8 border-b border-slate-800 flex bg-slate-950/50" }, [
        m("div", { class: "w-32 shrink-0 border-r border-slate-800 flex items-center justify-between px-3" }, [
            m("span", { class: "text-[9px] font-bold text-slate-500 uppercase tracking-widest" }, "Tracks"),
            m("button", {
                class: "text-green-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center p-0.5 rounded hover:bg-slate-800/80",
                title: "Add Track",
                onclick: () => {
                    const id = `track-${Date.now()}`;
                    State.timelineTracks.push({
                        id,
                        name: `Track ${State.timelineTracks.length + 1}`
                    });
                }
            }, m("i", { class: "icon-[ri--add-line] w-4 h-4" }))
        ]), 
        m("div", { 
          class: "flex-1 relative overflow-hidden cursor-crosshair",
          onmousedown: (e) => {
            isDraggingPlayhead = true;
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollLeft;
            seekGlobal(x / zoom);
          }
        }, [
          // Ruler Markers
          m("div", { 
            class: "absolute top-0 h-full flex items-end",
            style: { left: `${-scrollLeft}px`, width: `${timelineWidth}px` }
          }, 
            (() => {
              if (isNaN(totalDuration) || !isFinite(totalDuration) || totalDuration <= 0) {
                console.error("[Timeline] Invalid totalDuration:", totalDuration, clipsToSearch);
              }
              const rulerLength = (isNaN(totalDuration) || !isFinite(totalDuration) || totalDuration <= 0)
                ? 7
                : Math.ceil(totalDuration / 10) + 1;
              return Array.from({ length: rulerLength }).map((_, i) => {
                const time = i * 10;
                return m("div", { 
                  class: "absolute h-3 border-l border-slate-700 flex flex-col justify-end pb-1 px-1",
                  style: { left: `${time * zoom}px` }
                }, [
                  m("span", { class: "text-[8px] text-slate-500 font-mono" }, formatTime(time))
                ]);
              });
            })()
          ),
          // Sub-markers (every 2 seconds)
          m("div", { 
            class: "absolute top-0 h-full flex items-end",
            style: { left: `${-scrollLeft}px`, width: `${timelineWidth}px` }
          }, 
            (() => {
              const subRulerLength = (isNaN(totalDuration) || !isFinite(totalDuration) || totalDuration <= 0)
                ? 31
                : Math.ceil(totalDuration / 2) + 1;
              return Array.from({ length: subRulerLength }).map((_, i) => {
                const time = i * 2;
                if (time % 10 === 0) return null;
                return m("div", { 
                  class: "absolute h-1.5 border-l border-slate-800",
                  style: { left: `${time * zoom}px` }
                });
              });
            })()
          )
        ])
      ]),

      // TRACKS AREA
      m("div", { 
        class: "flex-1 flex overflow-hidden",
        onwheel: (e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.8 : 1.2;
            const oldZoom = State.timelineZoom;
            const newZoom = Math.max(0.1, Math.min(50, oldZoom * delta));
            
            // Adjust scroll to keep playhead or mouse relatively stable
            const centerTime = (State.timelineScrollLeft + 400) / oldZoom;
            State.timelineZoom = newZoom;
            State.timelineScrollLeft = Math.max(0, Math.min(maxScrollLeft, (centerTime * newZoom) - 400));
          } else {
            if (e.shiftKey) {
              State.timelineScrollLeft = Math.max(0, Math.min(maxScrollLeft, State.timelineScrollLeft + e.deltaY + e.deltaX));
            } else {
              // If vertical scroll is not needed, route scroll wheel to horizontal
              if (maxScrollTop === 0) {
                State.timelineScrollLeft = Math.max(0, Math.min(maxScrollLeft, State.timelineScrollLeft + e.deltaY + e.deltaX));
              } else {
                State.timelineScrollLeft = Math.max(0, Math.min(maxScrollLeft, State.timelineScrollLeft + e.deltaX));
                State.timelineScrollTop = Math.max(0, Math.min(maxScrollTop, (State.timelineScrollTop || 0) + e.deltaY));
              }
            }
          }
          m.redraw();
        }
      }, [
        // Track Headers
        m("div", { class: "w-32 shrink-0 bg-slate-900 border-r border-slate-800 relative z-10 overflow-hidden" }, 
          m("div", {
            class: "absolute left-0 right-0",
            style: { top: `${-scrollTop}px` }
          }, 
            State.timelineTracks.map((track, i) => {
              const isMusicTrack = track.id === "track-1";
              const isSelected = State.selectedTrackId === track.id;
              const borderClass = isSelected 
                ? (isMusicTrack ? "bg-emerald-600/10 border-r-2 border-r-emerald-500" : "bg-blue-600/10 border-r-2 border-r-blue-500") 
                : "hover:bg-slate-800/40";
              const textClass = isSelected 
                ? (isMusicTrack ? "text-emerald-400" : "text-blue-400") 
                : "text-slate-400";

              return m("div", {
                class: `h-12 border-b border-slate-800/50 flex items-center px-3 gap-2 group transition-colors cursor-pointer ${borderClass}`,
                onclick: () => State.selectedTrackId = track.id
              }, [
                isMusicTrack 
                  ? m("i", { class: "icon-[ri--music-2-line] w-3.5 h-3.5 text-emerald-500 shrink-0", title: "Dedicated Music Track" })
                  : m("button", {
                      class: `p-1 transition-colors ${track.locked ? "text-yellow-500" : "text-slate-600 hover:text-slate-400"}`,
                      title: track.locked ? "Unlock Track" : "Lock Track",
                      onclick: (e) => {
                          e.stopPropagation();
                          track.locked = !track.locked;
                      }
                    }, m("i", { class: `${track.locked ? "icon-[ri--lock-fill]" : "icon-[ri--lock-unlock-line]"} w-3.5 h-3.5` })),
                
                m("span", { class: `text-[10px] font-bold uppercase tracking-tighter truncate flex-1 ${textClass}` }, track.name),
                
                i > 1 && m("button", {
                    class: "opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-opacity p-1",
                    title: "Delete Track (And its clips)",
                    onclick: (e) => {
                      e.stopPropagation();
                      const hasClips = State.timelineClips.some(c => c.trackId === track.id);
                      if (!hasClips || confirm(`Delete ${track.name} and all clips inside it?`)) {
                        const clipsToDelete = State.timelineClips.filter(c => c.trackId === track.id);
                        State.timelineTracks = State.timelineTracks.filter(t => t.id !== track.id);
                        State.timelineClips = State.timelineClips.filter(c => c.trackId !== track.id);
                        clipsToDelete.forEach(c => revokeClipUrls(c, State));
                        if (State.selectedTrackId === track.id) State.selectedTrackId = State.timelineTracks[0].id;
                      }
                    }
                }, m("i", { class: "icon-[ri--delete-bin-7-line] w-3.5 h-3.5" }))
              ]);
            })
          )
        ),

        // Track Content Area
        m("div", { 
          id: "timeline-content-area",
          class: "flex-1 relative overflow-hidden bg-slate-950/40",
        }, [
            // SNAP LINES
            State.snapLines.map(line => {
                const snapClass = line.isVideoSnap
                    ? "absolute w-px bg-cyan-400/90 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                    : "absolute top-0 bottom-0 w-px bg-yellow-400/80 z-30 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.5)]";
                
                const style = line.isVideoSnap
                    ? { 
                        left: `${line.time * zoom - scrollLeft}px`,
                        top: `${line.trackIdx * 48 - (State.timelineScrollTop || 0)}px`,
                        height: '48px'
                      }
                    : { 
                        left: `${line.time * zoom - scrollLeft}px` 
                      };

                return m("div", {
                    class: snapClass,
                    style: style
                });
            }),

            // Grid Lines (Vertical)
            m("div", { 
                class: "absolute inset-0 pointer-events-none",
                style: { left: `${-scrollLeft}px`, width: `${timelineWidth}px` }
            }, Array.from({ length: Math.ceil(totalDuration / 10) + 1 }).map((_, i) => m("div", {
                class: "absolute h-full border-l border-slate-800/30",
                style: { left: `${i * 10 * zoom}px` }
            }))),

            // Track Rows
            m("div", { 
                class: "absolute left-0 right-0",
                style: { left: `${-scrollLeft}px`, top: `${-scrollTop}px`, width: `${timelineWidth}px` }
            }, State.timelineTracks.map((track, trackIdx) => m("div", {
                class: "h-12 border-b border-slate-800/30 relative"
            }, [
                // Clips
                State.timelineClips.filter(c => c.trackId === track.id).map(clip => {
                    const isDurationLocked = clip.type === 'overlay' && clip.settings.mediaType === 'video' && clip.settings.loop === false;
                    const isSelected = State.selectedClipId === clip.id;
                    const clipClass = isSelected
                      ? (clip.type === 'music' ? "bg-emerald-600/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-blue-600/40 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]")
                      : (clip.type === 'music' ? "bg-emerald-800/40 border-emerald-700/50 hover:bg-emerald-800/60 hover:border-emerald-600" : "bg-slate-700/60 border-slate-600 hover:bg-slate-700 hover:border-slate-500");

                    const isVideo = (clip.type === 'background' && clip.settings.bgType === 'video') || (clip.type === 'overlay' && clip.settings.mediaType === 'video');
                    const videoDuration = clip.settings.videoDuration || 0;
                    const speed = clip.settings.speed || 1.0;
                    const visualVideoDuration = videoDuration / speed;

                    const markers = [];
                    if (isVideo && typeof videoDuration === 'number' && videoDuration > 0 && typeof visualVideoDuration === 'number' && visualVideoDuration > 0.05) {
                        const shouldLoop = clip.settings.loop !== false;
                        if (shouldLoop) {
                            const maxMarkers = 500;
                            let count = 0;
                            for (let time = visualVideoDuration; time < clip.duration - 0.05 && count < maxMarkers; time += visualVideoDuration) {
                                markers.push(time);
                                count++;
                            }
                        } else if (visualVideoDuration < clip.duration - 0.05) {
                            markers.push(visualVideoDuration);
                        }
                    }

                    return m("div", {
                        class: `absolute top-2 bottom-2 rounded border transition-all ${clipClass}`,
                        style: { left: `${clip.start * zoom}px`, width: `${clip.duration * zoom}px` },
                        oncontextmenu: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            showContextMenu(e, clip.id);
                        },
                        onmousedown: (e) => {
                            e.stopPropagation();
                            State.selectedClipId = clip.id;
                            State.activeClipTab = clip.type;
                            State.activeInspectorTab = "properties";
                            isDraggingClip = {
                                clipId: clip.id,
                                type: 'move',
                                startX: e.clientX,
                                initialStart: clip.start,
                                initialDuration: clip.duration
                            };
                            window.addEventListener('mousemove', handleWindowMouseMove);
                            window.addEventListener('mouseup', handleWindowMouseUp);
                        }
                    }, [
                        // Original video duration/loop boundaries
                        markers.map(time => m("div", {
                            class: "absolute top-0 bottom-0 w-px border-l border-dashed border-cyan-400/60 pointer-events-none z-10",
                            style: { left: `${time * zoom}px` }
                        })),
                        // Resize Handles
                        !isDurationLocked && m("div", { 
                            class: "absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-400/50 rounded-l transition-colors",
                            onmousedown: (e) => {
                                e.stopPropagation();
                                isDraggingClip = {
                                    clipId: clip.id,
                                    type: 'resize-start',
                                    startX: e.clientX,
                                    initialStart: clip.start,
                                    initialDuration: clip.duration
                                };
                                window.addEventListener('mousemove', handleWindowMouseMove);
                                window.addEventListener('mouseup', handleWindowMouseUp);
                            }
                        }),
                        !isDurationLocked && m("div", { 
                            class: "absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-400/50 rounded-r transition-colors",
                            onmousedown: (e) => {
                                e.stopPropagation();
                                isDraggingClip = {
                                    clipId: clip.id,
                                    type: 'resize-end',
                                    startX: e.clientX,
                                    initialStart: clip.start,
                                    initialDuration: clip.duration
                                };
                                window.addEventListener('mousemove', handleWindowMouseMove);
                                window.addEventListener('mouseup', handleWindowMouseUp);
                            }
                        }),
                        // Content Preview
                        m("div", { class: "flex items-center h-full px-2 gap-2 overflow-hidden pointer-events-none w-full" }, [
                            clip.type === 'music'
                                ? m("i", { class: "icon-[ri--music-2-line] w-3 h-3 text-emerald-400 shrink-0" })
                                : (clip.type === 'background' || clip.type === 'overlay') && clip.settings?.thumbnail 
                                    ? m("img", { src: clip.settings.thumbnail, class: "w-4 h-4 rounded object-cover border border-slate-600 shrink-0" })
                                    : m("i", { 
                                        class: `${
                                          clip.type === 'text' 
                                            ? 'icon-[ri--text-spacing]' 
                                            : (clip.type === 'visualizer' ? 'icon-[ri--pulse-line]' : 'icon-[ri--image-line]')
                                        } w-3 h-3 text-slate-300 shrink-0` 
                                      }),
                            m("span", { class: "text-[9px] text-white font-medium truncate" }, 
                                clip.type === 'music'
                                    ? (clip.settings?.name || "Music")
                                    : (clip.type === 'background' || clip.type === 'overlay')
                                        ? (clip.settings?.fileName || (clip.type === 'background' ? "Background" : "Overlay"))
                                        : (clip.type === 'visualizer'
                                            ? `Visualizer (${clip.settings?.style || 'bars'})`
                                            : (clip.settings?.content || clip.type))
                            )
                        ])
                    ]);
                })
            ]))),

            // PLAYHEAD
            m("div", { 
              class: "absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.8)]",
              style: { left: `${globalTime * zoom - scrollLeft}px` }
            }, [
                // Playhead Handle
                m("div", { class: "absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 rotate-45" })
            ]),

            // VERTICAL SCROLLBAR
            showScrollbar && m("div", {
                class: "absolute right-1 top-1 bottom-3 w-1.5 bg-slate-950/30 rounded-full z-40 hover:bg-slate-950/50 transition-all cursor-pointer",
                onmousedown: (e) => {
                    e.stopPropagation();
                    const barEl = e.currentTarget;
                    const rect = barEl.getBoundingClientRect();
                    const updateScroll = (clientY) => {
                        const clickY = clientY - rect.top;
                        const handleHeight = Math.max(16, (visibleHeight / totalTracksHeight) * rect.height);
                        const scrollPct = rect.height > handleHeight ? (clickY - handleHeight / 2) / (rect.height - handleHeight) : 0;
                        State.timelineScrollTop = scrollPct * maxScrollTop;
                        State.timelineScrollTop = Math.max(0, Math.min(maxScrollTop, State.timelineScrollTop));
                        m.redraw();
                    };
                    updateScroll(e.clientY);
                    
                    const onMouseMove = (me) => {
                        updateScroll(me.clientY);
                    };
                    const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                }
            }, [
                m("div", {
                    class: "w-full bg-slate-600/60 rounded-full hover:bg-slate-500/80 transition-colors absolute",
                    style: {
                        height: `${Math.max(16, (visibleHeight / totalTracksHeight) * (visibleHeight - 16))}px`,
                        top: `${maxScrollTop > 0 ? (((State.timelineScrollTop || 0) / maxScrollTop) * (visibleHeight - 16 - Math.max(16, (visibleHeight / totalTracksHeight) * (visibleHeight - 16)))) : 0}px`
                    }
                })
            ]),

            // HORIZONTAL SCROLLBAR
            showHorizScrollbar && m("div", {
                class: "absolute left-1 right-3 bottom-1 h-1.5 bg-slate-950/30 rounded-full z-40 hover:bg-slate-950/50 transition-all cursor-pointer",
                onmousedown: (e) => {
                    e.stopPropagation();
                    const barEl = e.currentTarget;
                    const rect = barEl.getBoundingClientRect();
                    const updateScroll = (clientX) => {
                        const clickX = clientX - rect.left;
                        const handleWidth = Math.max(16, (visibleWidth / timelineWidth) * rect.width);
                        const scrollPct = rect.width > handleWidth ? (clickX - handleWidth / 2) / (rect.width - handleWidth) : 0;
                        State.timelineScrollLeft = scrollPct * maxScrollLeft;
                        State.timelineScrollLeft = Math.max(0, Math.min(maxScrollLeft, State.timelineScrollLeft));
                        m.redraw();
                    };
                    updateScroll(e.clientX);
                    
                    const onMouseMove = (me) => {
                        updateScroll(me.clientX);
                    };
                    const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                }
            }, [
                m("div", {
                    class: "h-full bg-slate-600/60 rounded-full hover:bg-slate-500/80 transition-colors absolute",
                    style: {
                        width: `${Math.max(16, (visibleWidth / timelineWidth) * (visibleWidth - 16))}px`,
                        left: `${maxScrollLeft > 0 ? ((State.timelineScrollLeft / maxScrollLeft) * (visibleWidth - 16 - Math.max(16, (visibleWidth / timelineWidth) * (visibleWidth - 16)))) : 0}px`
                    }
                })
            ])
        ])
      ]),

      // TIMELINE FOOTER / TOOLBAR
      m("div", { class: "flex-none h-10 border-t border-slate-800 bg-slate-950 flex items-center px-4 justify-between" }, [
        m("div", { class: "flex items-center gap-4" }, [
            m("label", {
                class: "flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-md transition shadow-lg uppercase tracking-wider border border-emerald-500 cursor-pointer",
                title: "Add Music Clip"
            }, [
                m("i", { class: "icon-[ri--music-2-line] w-3.5 h-3.5" }),
                "Add Music",
                m("input", {
                  type: "file",
                  accept: "audio/*",
                  multiple: true,
                  class: "hidden",
                  onchange: (e) => {
                    const files = Array.from(e.target.files);
                    files.forEach((file) => {
                      const audio = new Audio();
                      audio.src = URL.createObjectURL(file);
                      audio.onloadedmetadata = () => {
                        // Stack sequentially on Track 1
                        const musicClips = getClipsToSearch(State).filter(c => c.type === 'music');
                        let start = 0;
                        if (musicClips.length > 0) {
                          start = Math.max(...musicClips.map(c => c.start + c.duration));
                        }
 
                        const newClip = {
                          id: `clip-music-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
                            enabled: true
                          }
                        };
                        if (State.isThumbnailMode) {
                          if (!State.videoClips) State.videoClips = [];
                          State.videoClips.push(newClip);
                        } else {
                          State.timelineClips.push(newClip);
                        }
                        State.selectedClipId = newClip.id;
                        State.activeClipTab = "music";
                        State.activeInspectorTab = "properties";
                        m.redraw();
                      };
                    });
                  }
                })
            ]),
            m("div", { class: "h-4 w-px bg-slate-800 mx-2" }),
            m("span", { class: "text-[10px] font-mono text-slate-400" }, [
                m("span", { class: "text-blue-400" }, formatTime(globalTime)),
                " / ",
                formatTime(totalDuration)
            ])
        ]),
        m("div", { class: "flex items-center gap-3" }, [
            m("button", {
                class: "text-slate-500 hover:text-white transition-colors p-1",
                onclick: () => State.timelineZoom = Math.max(0.1, State.timelineZoom * 0.8)
            }, m("i", { class: "icon-[ri--zoom-out-line] w-3.5 h-3.5" })),
            m("input", {
                type: "range",
                min: 0.1,
                max: 50,
                step: 0.1,
                value: State.timelineZoom,
                oninput: (e) => State.timelineZoom = parseFloat(e.target.value),
                class: "w-32 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
            }),
            m("button", {
                class: "text-slate-500 hover:text-white transition-colors p-1",
                onclick: () => State.timelineZoom = Math.min(50, State.timelineZoom * 1.2)
            }, m("i", { class: "icon-[ri--zoom-in-line] w-3.5 h-3.5" }))
        ])
      ]),

      // CONTEXT MENU
      contextMenu && m("div", {
        id: "timeline-context-menu",
        class: "fixed bg-slate-900 border border-slate-700/80 shadow-2xl rounded-lg py-1.5 min-w-[140px] z-[9999]",
        style: { left: `${contextMenu.x}px`, top: `${contextMenu.y}px` },
        onmousedown: (e) => e.stopPropagation()
      }, [
        m("button", {
          class: "w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-blue-600/20 hover:text-blue-400 transition-colors flex items-center gap-1.5 cursor-pointer",
          onclick: (e) => {
            e.stopPropagation();
            const original = State.timelineClips.find(c => c.id === contextMenu.clipId);
            if (original) {
              const settingsCopy = JSON.parse(JSON.stringify(original.settings));
              if (original.settings.mediaElement) settingsCopy.mediaElement = cloneMediaElement(original.settings.mediaElement);
              if (original.settings.mediaElements) settingsCopy.mediaElements = cloneVids(original.settings.mediaElements);
              if (original.settings.bgElement) settingsCopy.bgElement = cloneMediaElement(original.settings.bgElement);
              if (original.settings.bgElements) settingsCopy.bgElements = cloneVids(original.settings.bgElements);
              if (original.settings.gifFrames) settingsCopy.gifFrames = original.settings.gifFrames;

              const duplicate = {
                id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: original.type,
                trackId: original.trackId,
                start: Math.round((original.start + original.duration) * 100) / 100,
                duration: original.duration,
                settings: settingsCopy
              };
              State.timelineClips.push(duplicate);
              State.selectedClipId = duplicate.id;
              State.activeClipTab = duplicate.type;
              State.activeInspectorTab = "properties";
            }
            closeContextMenu();
          }
        }, [
          m("i", { class: "icon-[ri--file-copy-line] w-3.5 h-3.5 text-blue-400" }),
          m("span", "Duplicate Clip")
        ]),
        m("button", {
          class: "w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-red-600/20 hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer",
          onclick: (e) => {
            e.stopPropagation();
            const clipToDelete = State.timelineClips.find(c => c.id === contextMenu.clipId);
            State.timelineClips = State.timelineClips.filter(c => c.id !== contextMenu.clipId);
            if (clipToDelete) {
              revokeClipUrls(clipToDelete, State);
            }
            if (State.selectedClipId === contextMenu.clipId) {
              State.selectedClipId = null;
            }
            closeContextMenu();
          }
        }, [
          m("i", { class: "icon-[ri--delete-bin-line] w-3.5 h-3.5 text-red-400" }),
          m("span", "Delete Clip")
        ])
      ])
    ]);
  }
};
