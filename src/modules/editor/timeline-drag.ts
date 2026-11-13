// Timeline drag & scrub
// to the new store (clips/tracks/snapLines, no bumpClips/redraw: zustand
// re-renders directly). The only model difference: audio search
// for snap uses the active route clips.
import { getTotalDuration, useEditorStore } from "../../store/editor-store";
import { seekTo } from "../audio/audio-engine";
import type { TimelineClip } from "../../shared/types/clip";

export type ClipDragType = "move" | "resize-start" | "resize-end";

type DragState = {
  clipId: string;
  type: ClipDragType;
  startX: number;
  initialStart: number;
  initialDuration: number;
  initialStartOffset: number;
};

let isDraggingPlayhead = false;
let isDraggingClip: DragState | null = null;

const TRACK_ROW_H = 48;

function trackIdOf(c: TimelineClip): string {
  return c.trackId ?? (c.type === "music" ? "track-1" : "track-2");
}

export const beginPlayheadDrag = (
  e: React.MouseEvent | MouseEvent,
  scrollLeft: number,
  zoom: number,
) => {
  isDraggingPlayhead = true;
  window.addEventListener("mousemove", handleWindowMouseMove);
  window.addEventListener("mouseup", handleWindowMouseUp);
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left + scrollLeft;
  seekTo(x / zoom);
};

export const beginClipDrag = (
  e: React.MouseEvent,
  clip: TimelineClip,
  type: ClipDragType,
) => {
  e.stopPropagation();
  useEditorStore.setState({ selectedClipId: clip.id });
  isDraggingClip = {
    clipId: clip.id,
    type,
    startX: e.clientX,
    initialStart: clip.start,
    initialDuration: clip.duration,
    initialStartOffset:
      typeof clip.settings.startOffset === "number" ? clip.settings.startOffset : 0,
  };
  window.addEventListener("mousemove", handleWindowMouseMove);
  window.addEventListener("mouseup", handleWindowMouseUp);
};

export const handleWindowMouseMove = (e: MouseEvent) => {
  const st = useEditorStore.getState();
  const zoom = st.timelineZoom;

  if (isDraggingPlayhead) {
    const timelineArea = document.getElementById("timeline-content-area");
    if (!timelineArea) return;
    const rect = timelineArea.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left + st.timelineScrollLeft);
    seekTo(x / zoom);
    return;
  }

  if (!isDraggingClip) return;
  const timelineArea = document.getElementById("timeline-content-area");
  if (!timelineArea) return;
  const rect = timelineArea.getBoundingClientRect();

  const mouseY = e.clientY - rect.top + (st.timelineScrollTop || 0);
  const trackIndex = Math.max(
    0,
    Math.min(st.tracks.length - 1, Math.floor(mouseY / TRACK_ROW_H)),
  );
  let targetTrackId = st.tracks[trackIndex]?.id;

  const dx = (e.clientX - isDraggingClip.startX) / zoom;
  const clip = st.clips.find((c) => c.id === isDraggingClip?.clipId);
  if (!clip) return;

  const nextSettings = { ...clip.settings };
  let nextTrackId = clip.trackId ?? trackIdOf(clip);
  const currentTrack = st.tracks.find((t) => t.id === clip.trackId);

  if (currentTrack?.locked && currentTrack.id !== "track-1") {
    st.setSnapLines([]);
    return;
  }

  if (clip.type === "music") {
    targetTrackId = "track-1";
  } else if (targetTrackId === "track-1") {
    targetTrackId = clip.trackId !== "track-1" ? (clip.trackId ?? "track-2") : "track-2";
  }

  const targetTrack = st.tracks.find((t) => t.id === targetTrackId);
  if (targetTrack && !targetTrack.locked) {
    nextTrackId = targetTrackId;
    if (st.selectedTrackId !== targetTrackId) {
      useEditorStore.setState({ selectedTrackId: targetTrackId });
    }
  }

  let newStart = clip.start;
  let newDur = clip.duration;

  if (isDraggingClip?.type === "move") {
    newStart = Math.max(0, isDraggingClip.initialStart + dx);
  } else if (isDraggingClip?.type === "resize-end") {
    if (clip.type === "music") {
      const maxDur =
        (typeof clip.settings.audioDuration === "number"
          ? (clip.settings.audioDuration as number)
          : clip.duration) - isDraggingClip.initialStartOffset;
      newDur = Math.max(0.1, Math.min(maxDur, isDraggingClip.initialDuration + dx));
    } else {
      newDur = Math.max(0.1, isDraggingClip.initialDuration + dx);
    }
  } else if (isDraggingClip?.type === "resize-start") {
    if (clip.type === "music") {
      newStart = Math.max(0, isDraggingClip.initialStart + dx);
      const dStart = newStart - isDraggingClip.initialStart;
      const base = isDraggingClip.initialStartOffset;
      let newOffset = base + dStart;
      if (newOffset < 0) {
        newOffset = 0;
        newStart = isDraggingClip.initialStart - base;
      }
      const audioLen =
        typeof clip.settings.audioDuration === "number"
          ? (clip.settings.audioDuration as number)
          : clip.duration;
      const maxOffset = Math.min(audioLen, base + isDraggingClip.initialDuration) - 0.1;
      if (newOffset > maxOffset) {
        newOffset = maxOffset;
        newStart = isDraggingClip.initialStart + (maxOffset - base);
      }
      nextSettings.startOffset = newOffset;
      newDur = Math.max(
        0.1,
        isDraggingClip.initialDuration - (newStart - isDraggingClip.initialStart),
      );
    } else {
      newStart = Math.max(0, isDraggingClip.initialStart + dx);
      const diff = clip.start - newStart;
      newDur = clip.duration + diff;
    }
  }

  const SNAP_THRESHOLD = 10 / zoom;
  const snapPoints: number[] = [];
  for (const other of st.clips) {
    if (other.id === clip.id) continue;
    snapPoints.push(other.start, other.start + other.duration);
  }
  snapPoints.push(st.currentTime);
  for (const m of st.clips) {
    if (m.type === "music" && m.id !== clip.id) {
      snapPoints.push(m.start, m.start + m.duration);
    }
  }

  const videoSnapPoints: number[] = [];
  const s = clip.settings as Record<string, unknown>;
  const isVideo =
    (clip.type === "background" && s.mediaType === "video") ||
    (clip.type === "overlay" && s.mediaType === "video");
  const videoDuration = typeof s.videoDuration === "number" ? s.videoDuration : 0;
  if (isVideo && videoDuration > 0) {
    const speed = typeof s.speed === "number" ? s.speed : 1.0;
    const visualLen = videoDuration / speed;
    if (visualLen > 0.05) {
      if (s.loop !== false) {
        const maxMultiples = Math.max(5, Math.min(100, Math.ceil(300 / visualLen)));
        for (let i = 1; i <= maxMultiples; i++) videoSnapPoints.push(clip.start + i * visualLen);
      } else {
        videoSnapPoints.push(clip.start + visualLen);
      }
    }
  }

  const nextSnap: Array<{
    time: number;
    type: "start" | "end";
    isVideoSnap?: boolean;
    trackIdx?: number;
  }> = [];
  let snapped = false;

  if (isDraggingClip?.type === "resize-end") {
    const newEnd = newStart + newDur;
    for (const point of videoSnapPoints) {
      if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
        newDur = point - newStart;
        const trackIdx = st.tracks.findIndex((t) => t.id === clip.trackId);
        nextSnap.push({ time: point, type: "end", isVideoSnap: true, trackIdx: trackIdx >= 0 ? trackIdx : 0 });
        snapped = true;
        break;
      }
    }
  }

  if (!snapped && (isDraggingClip?.type === "move" || isDraggingClip?.type === "resize-start")) {
    for (const point of snapPoints) {
      if (Math.abs(newStart - point) < SNAP_THRESHOLD) {
        newStart = point;
        nextSnap.push({ time: point, type: "start" });
        snapped = true;
        break;
      }
    }
  }
  if (!snapped && (isDraggingClip?.type === "move" || isDraggingClip?.type === "resize-end")) {
    const newEnd = newStart + newDur;
    for (const point of snapPoints) {
      if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
        if (isDraggingClip?.type === "move") newStart = Math.max(0, point - newDur);
        else newDur = point - newStart;
        nextSnap.push({ time: point, type: "end" });
        break;
      }
    }
  }

  if (
    clip.type === "overlay" &&
    s.mediaType === "video" &&
    s.loop === false &&
    typeof s.videoDuration === "number" &&
    isDraggingClip?.type !== "resize-start"
  ) {
    // Non-looping overlay: duration is locked to the media length. Skip this
    // on resize-start (the user is moving the left edge) so the snap above
    // is not immediately overwritten.
    const speed = typeof s.speed === "number" ? s.speed : 1.0;
    newDur = s.videoDuration / speed;
  }

  st.updateClip(clip.id, {
    start: Math.round(newStart * 100) / 100,
    duration: Math.round(newDur * 100) / 100,
    trackId: nextTrackId,
    settings: nextSettings,
  });
  st.setSnapLines(nextSnap);
};

export const handleWindowMouseUp = () => {
  if (!isDraggingPlayhead && !isDraggingClip) return;
  isDraggingPlayhead = false;
  isDraggingClip = null;
  useEditorStore.getState().setSnapLines([]);
  window.removeEventListener("mousemove", handleWindowMouseMove);
  window.removeEventListener("mouseup", handleWindowMouseUp);
};

export const handleWheelNative = (e: WheelEvent) => {
  e.preventDefault();
  const st = useEditorStore.getState();
  const clips = st.clips;
  const totalDuration = getTotalDuration(clips);
  const timelineWidth = totalDuration * st.timelineZoom;

  const timelineArea = document.getElementById("timeline-content-area");
  const visibleWidth = timelineArea ? timelineArea.clientWidth : window.innerWidth - 128;
  const maxScrollLeft = Math.max(0, timelineWidth - visibleWidth);

  const totalTracksHeight = st.tracks.length * TRACK_ROW_H;
  const maxScrollTop = Math.max(0, totalTracksHeight - 180);

  if (e.ctrlKey) {
    const delta = e.deltaY > 0 ? 0.8 : 1.2;
    const oldZoom = st.timelineZoom;
    const newZoom = Math.max(0.1, Math.min(50, oldZoom * delta));
    const centerTime = (st.timelineScrollLeft + visibleWidth / 2) / oldZoom;
    useEditorStore.setState({
      timelineZoom: newZoom,
      timelineScrollLeft: Math.max(0, Math.min(maxScrollLeft, centerTime * newZoom - visibleWidth / 2)),
    });
  } else if (e.shiftKey) {
    useEditorStore.setState({
      timelineScrollLeft: Math.max(
        0,
        Math.min(maxScrollLeft, st.timelineScrollLeft + e.deltaY + e.deltaX),
      ),
    });
  } else if (maxScrollTop === 0) {
    useEditorStore.setState({
      timelineScrollLeft: Math.max(
        0,
        Math.min(maxScrollLeft, st.timelineScrollLeft + e.deltaY + e.deltaX),
      ),
    });
  } else {
    useEditorStore.setState({
      timelineScrollLeft: Math.max(0, Math.min(maxScrollLeft, st.timelineScrollLeft + e.deltaX)),
      timelineScrollTop: Math.max(0, Math.min(maxScrollTop, st.timelineScrollTop + e.deltaY)),
    });
  }
};
