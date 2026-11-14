import { create } from "zustand";
import type {
  CanvasSnap,
  CanvasSnapTarget,
  ClipType,
  TimelineClip,
  TimelineTrack,
} from "../shared/types/clip";
import type { RecordResolution } from "../shared/lib/canvas-space";
import type { MediaItem } from "../modules/media/media-helper";
import {
  cloneClipSettings,
  getMediaUrls,
  revokeClipUrls,
} from "../shared/lib/media-urls";
import {
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  reattachPoolMedia,
  snapClips,
  takeSnapshot,
  type HistoryEntry,
  type HistoryNode,
} from "./history-utils";
import {
  DEFAULT_LYRICS_SETTINGS,
  DEFAULT_TRACKS,
  createDefaultThumbClips,
  defaultPanelWidth,
  getTotalDuration,
} from "./project-defaults";

export interface SnapLine {
  time: number;
  type: "start" | "end";
  isVideoSnap?: boolean;
  trackIdx?: number;
}

interface EditorState {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  projectName: string;
  setProjectName: (name: string) => void;
  route: "/" | "/image";
  videoClips: TimelineClip[] | null;
  thumbClips: TimelineClip[] | null;
  videoSel: string | null;
  thumbSel: string | null;
  swapRoute: (next: "/" | "/image") => void;
  mediaPool: MediaItem[];
  currentTime: number;
  duration: number;
  playing: boolean;
  activeLeftTab: string;
  leftPanelCollapsed: boolean;
  mediaPoolWidth: number;
  inspectorWidth: number;
  aspectRatio: "16:9" | "9:16";
  timelineZoom: number;
  timelineScrollLeft: number;
  timelineScrollTop: number;
  selectedTrackId: string;
  snapLines: SnapLine[];
  setSnapLines: (lines: SnapLine[]) => void;
  /** Canvas drag/transform status. */
  isDragging: boolean;
  startDragX: number;
  startDragY: number;
  initialOffsetX: number;
  initialOffsetY: number;
  dragPivot: { x: number; y: number } | null;
  initialDragDistance: number;
  initialDragAngle: number;
  initialScaleX: number;
  initialScaleY: number;
  initialRotation: number;
  transformMode: string | null;
  interactionMode: string;
  canvasSnaps: CanvasSnap[];
  staticSnapTargetsX: CanvasSnapTarget[] | null;
  staticSnapTargetsY: CanvasSnapTarget[] | null;
  showRecordSettingsModal: boolean;
  showRecordMenu: boolean;
  pendingRecordMode: "timeline" | "clip";
  canvasCursor: string | null;

  addClip: (clip: TimelineClip) => void;
  updateClipSettings: (id: string, patch: Record<string, unknown>) => void;
  moveClip: (id: string, start: number) => void;
  trimClip: (id: string, start: number, duration: number) => void;
  /** Single write for a drag result (start/duration/trackId/settings). */
  updateClip: (
    id: string,
    patch: {
      start?: number;
      duration?: number;
      trackId?: string;
      settings?: Record<string, unknown>;
    },
  ) => void;
  duplicateClip: (id: string) => void;
  removeClip: (id: string) => void;
  select: (id: string | null) => void;
  /** Undo/redo history (pre-mutation snapshot; same-gesture drags merged). */
  past: HistoryNode[];
  future: HistoryNode[];
  pushHistory: (mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  addMediaItem: (item: MediaItem) => void;
  removeMediaItem: (id: string) => void;
  isRecording: boolean;
  recordingTime: string;
  recordStartTime: number;
  /** Clip-mode recording auto-stop bound (null = end of timeline). */
  recordingTargetEnd: number | null;
  recordResolution: RecordResolution;
  recordFps: number;
  setRecording: (recording: boolean, startedAt?: number) => void;
  setRecordingTime: (label: string) => void;
  setRecordOptions: (resolution: RecordResolution, fps: number) => void;
  setTime: (t: number) => void;
  /** Global lyric style (production model: one global layer
   * following the active music). */
  lyricsSettings: Record<string, unknown>;
  updateLyricsSettings: (patch: Record<string, unknown>) => void;
  setPlaying: (p: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  clips: [],
  tracks: DEFAULT_TRACKS,
  selectedClipId: null,
  projectName: "Untitled Project",
  setProjectName: (name) => set({ projectName: name }),
  route: "/",
  videoClips: null,
  thumbClips: null,
  videoSel: null,
  thumbSel: null,
  swapRoute: (next) => {
    const s = get();
    if (
      s.route === next &&
      (next === "/" ? s.videoClips !== null : s.thumbClips !== null)
    ) {
      return;
    }
    // Save the old route's snapshot (except the first boot when the snapshot is still null).
    if (
      s.route === "/" &&
      (s.videoClips !== null || s.clips.length > 0 || s.selectedClipId)
    ) {
      set({ videoClips: snapClips(s.clips), videoSel: s.selectedClipId });
    } else if (
      s.route === "/image" &&
      (s.thumbClips !== null || s.clips.length > 0)
    ) {
      set({ thumbClips: snapClips(s.clips), thumbSel: s.selectedClipId });
    }
    if (next === "/") {
      const cur = get();
      set({
        route: "/",
        clips: cur.videoClips ? snapClips(cur.videoClips) : [],
        selectedClipId: cur.videoSel ?? null,
      });
    } else {
      const cur = get();
      if (!cur.thumbClips) {
        set({ thumbClips: createDefaultThumbClips() });
      }
      const fresh = get();
      set({
        route: "/image",
        clips: snapClips(fresh.thumbClips ?? []),
        selectedClipId: fresh.thumbSel ?? "thumb-text-1",
      });
    }
  },
  mediaPool: [],
  lyricsSettings: { ...DEFAULT_LYRICS_SETTINGS },
  updateLyricsSettings: (patch) => {
    get().pushHistory("lyrics");
    set((s) => ({ lyricsSettings: { ...s.lyricsSettings, ...patch } }));
  },
  isRecording: false,
  recordingTime: "00:00",
  recordStartTime: 0,
  recordingTargetEnd: null,
  recordResolution: "720p" as RecordResolution,
  recordFps: 30,
  currentTime: 0,
  duration: 60,
  playing: false,
  activeLeftTab: "library",
  leftPanelCollapsed: false,
  mediaPoolWidth: defaultPanelWidth("left"),
  inspectorWidth: defaultPanelWidth("right"),
  aspectRatio: "16:9",
  timelineZoom: 4,
  timelineScrollLeft: 0,
  timelineScrollTop: 0,
  selectedTrackId: "track-1",
  snapLines: [],
  setSnapLines: (lines) => set({ snapLines: lines }),
  isDragging: false,
  startDragX: 0,
  startDragY: 0,
  initialOffsetX: 0,
  initialOffsetY: 0,
  dragPivot: null,
  initialDragDistance: 0,
  initialDragAngle: 0,
  initialScaleX: 1,
  initialScaleY: 1,
  initialRotation: 0,
  transformMode: null,
  interactionMode: "select",
  canvasSnaps: [],
  staticSnapTargetsX: null,
  staticSnapTargetsY: null,
  showRecordSettingsModal: false,
  showRecordMenu: false,
  pendingRecordMode: "timeline" as "timeline" | "clip",
  canvasCursor: null as string | null,

  addClip: (clip) => {
    get().pushHistory();
    set((s) => ({ clips: [...s.clips, clip], selectedClipId: clip.id }));
  },
  updateClipSettings: (id, patch) => {
    if (!get().clips.some((c) => c.id === id)) return;
    get().pushHistory(`set:${id}`);
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, settings: { ...c.settings, ...patch } } : c,
      ),
    }));
  },
  moveClip: (id, start) => {
    if (!get().clips.some((c) => c.id === id)) return;
    get().pushHistory(`move:${id}`);
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, start: Math.max(0, start) } : c,
      ),
    }));
  },
  trimClip: (id, start, duration) => {
    if (!get().clips.some((c) => c.id === id)) return;
    get().pushHistory(`trim:${id}`);
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id
          ? {
              ...c,
              start: Math.max(0, start),
              duration: Math.max(0.1, duration),
            }
          : c,
      ),
    }));
  },
  updateClip: (id, patch) => {
    if (!get().clips.some((c) => c.id === id)) return;
    get().pushHistory(`update:${id}`);
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id
          ? {
              ...c,
              start:
                patch.start !== undefined ? Math.max(0, patch.start) : c.start,
              duration:
                patch.duration !== undefined
                  ? Math.max(0.1, patch.duration)
                  : c.duration,
              trackId: patch.trackId ?? c.trackId,
              settings: patch.settings ?? c.settings,
            }
          : c,
      ),
    }));
  },
  duplicateClip: (id) => {
    const src = get().clips.find((c) => c.id === id);
    if (!src) return;
    get().pushHistory();
    set((s) => {
      const copy: TimelineClip = {
        ...src,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        start: Math.round((src.start + src.duration) * 100) / 100,
        settings: cloneClipSettings(src.settings),
      };
      return { clips: [...s.clips, copy], selectedClipId: copy.id };
    });
  },
  removeClip: (id) => {
    const gone = get().clips.find((c) => c.id === id);
    if (!gone) return;
    get().pushHistory();
    set((s) => {
      revokeClipUrls(gone, s);
      return {
        clips: s.clips.filter((c) => c.id !== id),
        snapLines: [],
        selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      };
    });
  },
  select: (id) => set({ selectedClipId: id }),
  past: [],
  future: [],
  pushHistory: (mergeKey) => {
    const s = get();
    const now = Date.now();
    const top = s.past[s.past.length - 1];
    if (
      mergeKey &&
      top &&
      top.mergeKey === mergeKey &&
      now - top.at < MERGE_WINDOW_MS
    ) {
      // Same gesture: no new snapshot, but a prior undo must not keep a
      // redo path alive — any new write invalidates it.
      if (s.future.length > 0) set({ future: [] });
      return;
    }
    set({
      past: [
        ...s.past.slice(-(HISTORY_LIMIT - 1)),
        { ...takeSnapshot(s), mergeKey: mergeKey ?? null, at: now },
      ],
      future: [],
    });
  },
  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [
        ...s.future,
        { ...takeSnapshot(s), mergeKey: null, at: Date.now() },
      ],
      clips: reattachPoolMedia(prev.clips, s.mediaPool),
      tracks: prev.tracks,
      selectedClipId: prev.selectedClipId,
      route: prev.route,
      videoClips: prev.videoClips
        ? reattachPoolMedia(prev.videoClips, s.mediaPool)
        : null,
      thumbClips: prev.thumbClips
        ? reattachPoolMedia(prev.thumbClips, s.mediaPool)
        : null,
      videoSel: prev.videoSel,
      thumbSel: prev.thumbSel,
      lyricsSettings: { ...prev.lyricsSettings },
      snapLines: [],
    });
  },
  redo: () => {
    const s = get();
    const next = s.future[s.future.length - 1];
    if (!next) return;
    set({
      future: s.future.slice(0, -1),
      past: [
        ...s.past.slice(-(HISTORY_LIMIT - 1)),
        { ...takeSnapshot(s), mergeKey: null, at: Date.now() },
      ],
      clips: reattachPoolMedia(next.clips, s.mediaPool),
      tracks: next.tracks,
      selectedClipId: next.selectedClipId,
      route: next.route,
      videoClips: next.videoClips
        ? reattachPoolMedia(next.videoClips, s.mediaPool)
        : null,
      thumbClips: next.thumbClips
        ? reattachPoolMedia(next.thumbClips, s.mediaPool)
        : null,
      videoSel: next.videoSel,
      thumbSel: next.thumbSel,
      lyricsSettings: { ...next.lyricsSettings },
      snapLines: [],
    });
  },
  clearHistory: () => set({ past: [], future: [] }),
  addMediaItem: (item) => set((s) => ({ mediaPool: [item, ...s.mediaPool] })),
  removeMediaItem: (id) =>
    set((s) => {
      const gone = s.mediaPool.find((m) => m.id === id);
      if (gone && gone.url.startsWith("blob:")) {
        const stillUsed =
          s.clips.some((c) => getMediaUrls(c).includes(gone.url)) ||
          (s.videoClips ?? []).some((c) =>
            getMediaUrls(c).includes(gone.url),
          ) ||
          (s.thumbClips ?? []).some((c) => getMediaUrls(c).includes(gone.url));
        if (!stillUsed) {
          try {
            URL.revokeObjectURL(gone.url);
          } catch {
            /* noop */
          }
        }
      }
      return { mediaPool: s.mediaPool.filter((m) => m.id !== id) };
    }),
  setRecording: (recording, startedAt) =>
    set((s) => ({
      isRecording: recording,
      recordingTime: recording ? "00:00" : s.recordingTime,
      recordStartTime: startedAt ?? s.recordStartTime,
    })),
  setRecordingTime: (label) => set({ recordingTime: label }),
  setRecordOptions: (resolution, fps) =>
    set({ recordResolution: resolution, recordFps: fps }),
  setTime: (t) =>
    set((s) => ({
      currentTime: Math.min(Math.max(0, t), getTotalDuration(s.clips)),
    })),
  setPlaying: (p) => set({ playing: p }),
}));

// Backward-compatible re-exports: single import site for existing modules.
export { DEFAULT_LYRICS_SETTINGS, defaultPanelWidth, getTotalDuration };
export type { ClipType, HistoryEntry, HistoryNode };
