import {
  getTotalDuration,
  getGlobalTime,
  getClipsToSearch,
} from "../../utils/helpers";
import { applyAudioSettings } from "../../lib/audio";
import { runtime } from "../../lib/runtime";
import { editorStore } from "../../store/editor-store";

let isDraggingPlayhead = false;
type DragState = {
  clipId: string;
  type: "move" | "resize-start" | "resize-end";
  startX: number;
  initialStart: number;
  initialDuration: number;
  initialStartOffset: number;
};
let isDraggingClip: DragState | null = null;
let contextMenu: { x: number; y: number; clipId: string } | null = null;

let requestRedraw: (() => void) | null = null;
export const setRequestRedraw = (fn: (() => void) | null) => {
  requestRedraw = fn;
};
export const redraw = () => requestRedraw?.();

export const getContextMenu = () => contextMenu;

const closeContextMenuInternal = () => {
  if (contextMenu) {
    contextMenu = null;
    window.removeEventListener("mousedown", handleWindowMouseDownCloseMenu);
    window.removeEventListener("wheel", closeContextMenuInternal);
    redraw();
  }
};
export const closeContextMenu = closeContextMenuInternal;

const handleWindowMouseDownCloseMenu = (e: MouseEvent) => {
  const menuEl = document.getElementById("timeline-context-menu");
  if (!menuEl || !menuEl.contains(e.target as Node)) {
    closeContextMenuInternal();
  }
};

export const showContextMenu = (
  e: { clientX: number; clientY: number },
  clipId: string,
) => {
  contextMenu = { x: e.clientX, y: e.clientY, clipId };
  window.addEventListener("mousedown", handleWindowMouseDownCloseMenu);
  window.addEventListener("wheel", closeContextMenuInternal, { passive: true });
  redraw();
};

export const seekGlobal = (globalTime: number) => {
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
      nextTime <= c.start + c.duration,
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
        if (
          playheadTime <
          (activeClip.settings.audioDuration || activeClip.duration)
        ) {
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
      if (
        playheadTime <
        (activeClip.settings.audioDuration || activeClip.duration)
      ) {
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

export const handleWindowMouseMove = (e: MouseEvent) => {
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

    const mouseY = e.clientY - rect.top + (state.timelineScrollTop || 0);
    const trackIndex = Math.max(
      0,
      Math.min(state.timelineTracks.length - 1, Math.floor(mouseY / 48)),
    );
    let targetTrackId = state.timelineTracks[trackIndex].id;

    const dx = (e.clientX - isDraggingClip.startX) / zoom;
    const clip = state.timelineClips.find(
      (c: any) => c.id === isDraggingClip?.clipId,
    ) as any;

    if (clip) {
      const nextClip: any = { ...clip };
      const nextSnapLines: any[] = [];
      const currentTrack = state.timelineTracks.find(
        (t: any) => t.id === clip.trackId,
      );

      if (
        currentTrack &&
        currentTrack.locked &&
        currentTrack.id !== "track-1"
      ) {
        editorStore.setState({ snapLines: [] });
        return;
      }

      if (clip.type === "music") {
        targetTrackId = "track-1";
      } else if (targetTrackId === "track-1") {
        targetTrackId = clip.trackId !== "track-1" ? clip.trackId : "track-2";
      }

      const targetTrack = state.timelineTracks.find(
        (t: any) => t.id === targetTrackId,
      );
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
          const maxDur =
            (clip.settings.audioDuration || clip.duration) -
            isDraggingClip.initialStartOffset;
          newDur = Math.max(
            0.1,
            Math.min(maxDur, isDraggingClip.initialDuration + dx),
          );
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
          const maxOffset =
            Math.min(
              clip.settings.audioDuration || clip.duration,
              base + isDraggingClip.initialDuration,
            ) - 0.1;
          if (newOffset > maxOffset) {
            newOffset = maxOffset;
            newStart = isDraggingClip.initialStart + (maxOffset - base);
          }

          nextClip.settings = { ...clip.settings, startOffset: newOffset };
          newDur = Math.max(
            0.1,
            isDraggingClip.initialDuration -
              (newStart - isDraggingClip.initialStart),
          );
        } else {
          newStart = Math.max(0, isDraggingClip.initialStart + dx);
          const diff = clip.start - newStart;
          newDur = clip.duration + diff;
        }
      }

      const SNAP_THRESHOLD = 10 / zoom;

      const snapPoints: number[] = [];
      const clipsToSearch = getClipsToSearch(state as never) as any[];

      clipsToSearch.forEach((other) => {
        if (other.id === clip.id) return;
        snapPoints.push(other.start);
        snapPoints.push(other.start + other.duration);
      });

      snapPoints.push(getGlobalTime(state as never));

      clipsToSearch
        .filter((c) => c.type === "music" && c.id !== clip.id)
        .forEach((musicClip) => {
          snapPoints.push(musicClip.start);
          snapPoints.push(musicClip.start + musicClip.duration);
        });

      const videoSnapPoints: number[] = [];
      const isVideo =
        (clip.type === "background" && clip.settings.bgType === "video") ||
        (clip.type === "overlay" && clip.settings.mediaType === "video");
      const videoDuration = clip.settings.videoDuration || 0;
      if (isVideo && typeof videoDuration === "number" && videoDuration > 0) {
        const speed = clip.settings.speed || 1.0;
        const visualVideoDuration = videoDuration / speed;
        if (
          typeof visualVideoDuration === "number" &&
          visualVideoDuration > 0.05
        ) {
          const shouldLoop = clip.settings.loop !== false;
          if (shouldLoop) {
            const maxMultiples = Math.max(
              5,
              Math.min(100, Math.ceil(300 / visualVideoDuration)),
            );
            for (let i = 1; i <= maxMultiples; i++) {
              videoSnapPoints.push(clip.start + i * visualVideoDuration);
            }
          } else {
            videoSnapPoints.push(clip.start + visualVideoDuration);
          }
        }
      }

      let snapped = false;

      if (isDraggingClip?.type === "resize-end") {
        const newEnd = newStart + newDur;
        for (const point of videoSnapPoints) {
          if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
            newDur = point - newStart;
            const trackIdx = state.timelineTracks.findIndex(
              (t: any) => t.id === clip.trackId,
            );
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

      if (!snapped) {
        if (
          isDraggingClip?.type === "move" ||
          isDraggingClip?.type === "resize-start"
        ) {
          for (const point of snapPoints) {
            if (Math.abs(newStart - point) < SNAP_THRESHOLD) {
              newStart = point;
              nextSnapLines.push({ time: point, type: "start" });
              snapped = true;
              break;
            }
          }
        }
        if (
          !snapped &&
          (isDraggingClip?.type === "move" ||
            isDraggingClip?.type === "resize-end")
        ) {
          const newEnd = newStart + newDur;
          for (const point of snapPoints) {
            if (Math.abs(newEnd - point) < SNAP_THRESHOLD) {
              newStart =
                isDraggingClip?.type === "move" ? point - newDur : newStart;
              newDur =
                isDraggingClip?.type === "resize-end"
                  ? point - newStart
                  : newDur;
              nextSnapLines.push({ time: point, type: "end" });
              break;
            }
          }
        }
      }

      if (
        clip.type === "overlay" &&
        clip.settings.mediaType === "video" &&
        clip.settings.loop === false
      ) {
        const speed = clip.settings.speed || 1.0;
        newDur = (clip.settings.videoDuration || clip.duration) / speed;
      }

      nextClip.start = Math.round(newStart * 100) / 100;
      nextClip.duration = Math.round(newDur * 100) / 100;

      editorStore.setState({
        snapLines: nextSnapLines as never,
        timelineClips: state.timelineClips.map((c) =>
          c.id === nextClip.id ? nextClip : c,
        ),
      });
      redraw();
    }
  }
};

export const handleWindowMouseUp = () => {
  if (isDraggingPlayhead || isDraggingClip) {
    isDraggingPlayhead = false;
    isDraggingClip = null;
    editorStore.setState({ snapLines: [] });
    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
    redraw();
  }
};

export const handleWheelNative = (e: WheelEvent) => {
  e.preventDefault();
  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state as never) as any[];
  const totalDuration = getTotalDuration(clipsToSearch as never);
  const timelineWidth = totalDuration * state.timelineZoom;

  const timelineArea = document.getElementById("timeline-content-area");
  const visibleWidth = timelineArea
    ? timelineArea.clientWidth
    : window.innerWidth - 128;
  const maxScrollLeft = Math.max(0, timelineWidth - visibleWidth);

  const totalTracksHeight = state.timelineTracks.length * 48;
  const maxScrollTop = Math.max(0, totalTracksHeight - 180);

  if (e.ctrlKey) {
    const delta = e.deltaY > 0 ? 0.8 : 1.2;
    const oldZoom = state.timelineZoom;
    const newZoom = Math.max(0.1, Math.min(50, oldZoom * delta));

    const centerTime = (state.timelineScrollLeft + 400) / oldZoom;
    editorStore.setState({
      timelineZoom: newZoom,
      timelineScrollLeft: Math.max(
        0,
        Math.min(maxScrollLeft, centerTime * newZoom - 400),
      ),
    });
  } else {
    if (e.shiftKey) {
      editorStore.setState({
        timelineScrollLeft: Math.max(
          0,
          Math.min(
            maxScrollLeft,
            state.timelineScrollLeft + e.deltaY + e.deltaX,
          ),
        ),
      });
    } else if (maxScrollTop === 0) {
      editorStore.setState({
        timelineScrollLeft: Math.max(
          0,
          Math.min(
            maxScrollLeft,
            state.timelineScrollLeft + e.deltaY + e.deltaX,
          ),
        ),
      });
    } else {
      editorStore.setState({
        timelineScrollLeft: Math.max(
          0,
          Math.min(maxScrollLeft, state.timelineScrollLeft + e.deltaX),
        ),
        timelineScrollTop: Math.max(
          0,
          Math.min(maxScrollTop, state.timelineScrollTop + e.deltaY),
        ),
      });
    }
  }
};

export const beginClipDrag = (
  e: React.MouseEvent,
  clip: any,
  type: DragState["type"],
) => {
  e.stopPropagation();
  if (type === "move") {
    editorStore.setState({
      selectedClipId: clip.id,
      activeClipTab: clip.type,
      activeInspectorTab: "properties",
    });
  }
  isDraggingClip = {
    clipId: clip.id,
    type,
    startX: e.clientX,
    initialStart: clip.start,
    initialDuration: clip.duration,
    initialStartOffset: clip.settings?.startOffset || 0,
  };
  window.addEventListener("mousemove", handleWindowMouseMove);
  window.addEventListener("mouseup", handleWindowMouseUp);
};

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
  seekGlobal(x / zoom);
};

