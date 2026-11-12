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
import { cloneClipSettings, getMediaUrls, revokeClipUrls } from "../shared/lib/media-urls";

export interface SnapLine {
  time: number;
  type: "start" | "end";
  isVideoSnap?: boolean;
  trackIdx?: number;
}

/** max(60, ceil(maxEnd)) — mirrors src_old getTotalDuration. */
export function getTotalDuration(clips: TimelineClip[]): number {
  if (!clips || clips.length === 0) return 60;
  const maxEnd = clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  return Math.max(60, Math.ceil(maxEnd));
}

/** One undo history entry: full clip state for both routes + selection.
 * Settings are shallow-copied (media-pool element references are shared,
 * so undo never disconnects an already-loaded image/video). */
export interface HistoryEntry {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  route: "/" | "/image";
  videoClips: TimelineClip[] | null;
  thumbClips: TimelineClip[] | null;
  videoSel: string | null;
  thumbSel: string | null;
  lyricsSettings: Record<string, unknown>;
}

interface HistoryNode extends HistoryEntry {
  mergeKey: string | null;
  at: number;
}

const HISTORY_LIMIT = 50;
/** Drag/slider churns dozens of writes per gesture — merge same-gesture writes. */
const MERGE_WINDOW_MS = 1200;

function snapClips(clips: TimelineClip[]): TimelineClip[] {
  return clips.map((c) => {
    const settings = cloneClipSettings(c.settings);
    // Nested arrays (lyrics lines, keyframes) must not be shared with live
    // state, otherwise in-place edits corrupt the undo snapshot.
    if (Array.isArray(settings.lines)) {
      settings.lines = (settings.lines as Array<Record<string, unknown>>).map((l) =>
        l && typeof l === "object" ? { ...l } : l,
      );
    }
    return { ...c, settings };
  });
}

function takeSnapshot(s: EditorState): HistoryEntry {
  return {
    clips: snapClips(s.clips),
    tracks: s.tracks.map((t) => ({ ...t })),
    selectedClipId: s.selectedClipId,
    route: s.route,
    videoClips: s.videoClips ? snapClips(s.videoClips) : null,
    thumbClips: s.thumbClips ? snapClips(s.thumbClips) : null,
    videoSel: s.videoSel,
    thumbSel: s.thumbSel,
    lyricsSettings: { ...s.lyricsSettings },
  };
}

/** Re-link media-pool references (safe if the pool changes mid-flight). */
function reattachPoolMedia(
  clips: TimelineClip[],
  pool: MediaItem[],
): TimelineClip[] {
  return clips.map((c) => {
    const mid = c.settings.mediaId;
    if (typeof mid !== "string" || !mid) return c;
    const hit = pool.find((m) => m.id === mid);
    if (!hit) return c;
    const next = { ...c, settings: { ...c.settings } };
    if (hit.type === "video" && hit.elements) {
      next.settings.mediaElements = hit.elements;
      next.settings.mediaType = "video";
    } else if (hit.type === "gif") {
      const g = hit as MediaItem & { gifFrames?: unknown; gifDuration?: number };
      if (g.gifFrames) next.settings.gifFrames = g.gifFrames;
      if (typeof g.gifDuration === "number") next.settings.gifDuration = g.gifDuration;
      next.settings.mediaType = "gif";
    } else if (hit.type === "image" && hit.element) {
      next.settings.mediaElement = hit.element;
      next.settings.mediaType = "image";
    }
    return next;
  });
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
  /** Canvas drag/transform status (mirrors src_old interaction slice). */
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
  /** Global lyric style (production/src_old model: one global layer
   * following the active music). */
  lyricsSettings: Record<string, unknown>;
  updateLyricsSettings: (patch: Record<string, unknown>) => void;
  setPlaying: (p: boolean) => void;
}

const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "track-1", name: "Track 1 (Music)" },
  { id: "track-2", name: "Track 2" },
];

/** Initial sidebar width follows the viewport (mirrors src_old layout slice). */
export function defaultPanelWidth(kind: "left" | "right"): number {
  const min = kind === "left" ? 300 : 320;
  if (typeof window === "undefined") return min;
  return Math.max(min, Math.floor(window.innerWidth * 0.22));
}

const DEFAULT_THUMB_CLIPS: TimelineClip[] = [
  {
    id: "thumb-text-1",
    type: "text",
    start: 0,
    duration: 60,
    settings: {
      content: "LOFI CHILL VIBES",
      fontFamily: "sans-serif",
      fontWeight: "bold",
      fontSize: 70,
      textColor: "#ffffff",
      strokeColor: "#f43f5e",
      strokeWidth: 6,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      bgColor: "transparent",
      textEffect: "none",
    },
  },
  {
    id: "thumb-text-2",
    type: "text",
    start: 0,
    duration: 60,
    settings: {
      content: "Late Night Study & Code",
      fontFamily: "sans-serif",
      fontWeight: "normal",
      fontSize: 36,
      textColor: "#ffffff",
      strokeColor: "#0f172a",
      strokeWidth: 4,
      shadowColor: "#000000",
      shadowBlur: 5,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      bgColor: "rgba(15, 23, 42, 0.75)",
      bgPadding: 10,
      bgRadius: 10,
      textEffect: "none",
    },
  },
];

export const DEFAULT_LYRICS_SETTINGS: Record<string, unknown> = {
  enabled: true,
  // Bottom-center anchor so the gizmo/box follows the text (as before).
  originX: 0.5,
  originY: 1,
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  fontFamily: "sans-serif",
  fontSize: 48,
  fontWeight: "bold",
  lineHeight: 1.2,
  textAlign: "center",
  textColor: "#ffffff",
  activeColor: "#ffffff",
  inactiveColor: "#94a3b8",
  inactiveOpacity: 0.45,
  activeSizeBoost: 1,
  lineTransitionIn: "fade",
  lineTransitionOut: "fade",
  lineTransitionDuration: 0.3,
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowColor: "rgba(0,0,0,0.8)",
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  bgColor: "transparent",
  bgPadding: 10,
  bgRadius: 8,
  lineGap: 8,
  contextLines: 0,
  offsetSeconds: 0,
  fallbackLineDuration: 4,
  unstampedAutoAdvance: false,
};

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
    if (s.route === next && (next === "/" ? s.videoClips !== null : s.thumbClips !== null)) {
      return;
    }
    // Save the old route's snapshot (except the first boot when the snapshot is still null).
    if (s.route === "/" && (s.videoClips !== null || s.clips.length > 0 || s.selectedClipId)) {
      set({ videoClips: snapClips(s.clips), videoSel: s.selectedClipId });
    } else if (s.route === "/image" && (s.thumbClips !== null || s.clips.length > 0)) {
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
        set({ thumbClips: DEFAULT_THUMB_CLIPS.map((c) => ({ ...c, settings: cloneClipSettings(c.settings) })) });
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
          ? { ...c, start: Math.max(0, start), duration: Math.max(0.1, duration) }
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
              start: patch.start !== undefined ? Math.max(0, patch.start) : c.start,
              duration:
                patch.duration !== undefined ? Math.max(0.1, patch.duration) : c.duration,
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
    if (mergeKey && top && top.mergeKey === mergeKey && now - top.at < MERGE_WINDOW_MS) {
      // Same gesture: no new snapshot, but a prior undo must not keep a
      // redo path alive — any new write invalidates it.
      if (s.future.length > 0) set({ future: [] });
      return;
    }
    set({
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), { ...takeSnapshot(s), mergeKey: mergeKey ?? null, at: now }],
      future: [],
    });
  },
  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [...s.future, { ...takeSnapshot(s), mergeKey: null, at: Date.now() }],
      clips: reattachPoolMedia(prev.clips, s.mediaPool),
      tracks: prev.tracks,
      selectedClipId: prev.selectedClipId,
      route: prev.route,
      videoClips: prev.videoClips ? reattachPoolMedia(prev.videoClips, s.mediaPool) : null,
      thumbClips: prev.thumbClips ? reattachPoolMedia(prev.thumbClips, s.mediaPool) : null,
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
      past: [...s.past.slice(-(HISTORY_LIMIT - 1)), { ...takeSnapshot(s), mergeKey: null, at: Date.now() }],
      clips: reattachPoolMedia(next.clips, s.mediaPool),
      tracks: next.tracks,
      selectedClipId: next.selectedClipId,
      route: next.route,
      videoClips: next.videoClips ? reattachPoolMedia(next.videoClips, s.mediaPool) : null,
      thumbClips: next.thumbClips ? reattachPoolMedia(next.thumbClips, s.mediaPool) : null,
      videoSel: next.videoSel,
      thumbSel: next.thumbSel,
      lyricsSettings: { ...next.lyricsSettings },
      snapLines: [],
    });
  },
  clearHistory: () => set({ past: [], future: [] }),
  addMediaItem: (item) =>
    set((s) => ({ mediaPool: [item, ...s.mediaPool] })),
  removeMediaItem: (id) =>
    set((s) => {
      const gone = s.mediaPool.find((m) => m.id === id);
      if (gone && gone.url.startsWith("blob:")) {
        const stillUsed =
          s.clips.some((c) => getMediaUrls(c).includes(gone.url)) ||
          (s.videoClips ?? []).some((c) => getMediaUrls(c).includes(gone.url)) ||
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
  setRecordOptions: (resolution, fps) => set({ recordResolution: resolution, recordFps: fps }),
  setTime: (t) =>
    set((s) => ({
      currentTime: Math.min(Math.max(0, t), getTotalDuration(s.clips)),
    })),
  setPlaying: (p) => set({ playing: p }),
}));

export type { ClipType };
