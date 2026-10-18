import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";
import type { TimelineClip, TimelineTrack } from "../../types/clips";

export type EditorRoute = "/" | "/image";

const DEFAULT_VIDEO_TRACKS: TimelineTrack[] = [
  { id: "track-1", name: "Track 1 (Music)", locked: false },
  { id: "track-2", name: "Track 2", locked: false },
];

const DEFAULT_THUMBNAIL_TRACKS: TimelineTrack[] = [
  { id: "track-1", name: "Track 1 (Music)", locked: false },
  { id: "track-2", name: "Track 2", locked: false },
  { id: "track-3", name: "Track 3", locked: false },
];

export const DEFAULT_THUMBNAIL_CLIPS: TimelineClip[] = [
  {
    id: "thumb-text-1",
    type: "text",
    trackId: "track-2",
    start: 0,
    duration: 60,
    settings: {
      content: "LOFI CHILL VIBES",
      fontFamily: "'Bangers', cursive",
      fontSize: 70,
      textColor: "#ffffff",
      strokeColor: "#f43f5e",
      strokeWidth: 6,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      x: 0,
      y: -80,
      rotation: -4,
      scaleX: 1,
      scaleY: 1,
      bgPadding: 0,
      bgRadius: 0,
      bgColor: "transparent",
    },
  },
  {
    id: "thumb-text-2",
    type: "text",
    trackId: "track-3",
    start: 0,
    duration: 60,
    settings: {
      content: "Late Night Study & Code",
      fontFamily: "'Lexend', sans-serif",
      fontSize: 36,
      textColor: "#ffffff",
      strokeColor: "#0f172a",
      strokeWidth: 4,
      shadowColor: "#000000",
      shadowBlur: 5,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      x: 0,
      y: 40,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      bgPadding: 10,
      bgRadius: 10,
      bgColor: "rgba(15, 23, 42, 0.75)",
    },
  },
];

/**
 * Route-scoped state. The active timeline state (tracks/clips/selection) is
 * mirrored in `TimelineSlice`; these snapshots preserve each mode's editor
 * content when switching between the video ("/") and thumbnail ("/image")
 * routes. Ported from `swapRouteClips()` / `initRouteState()` in `main.js`.
 */
export interface ModeSlice {
  currentRoute: EditorRoute;
  videoClips?: TimelineClip[];
  videoTracks?: TimelineTrack[];
  videoSelectedClipId?: string | null;
  videoSelectedTrackId?: string;
  thumbnailClips?: TimelineClip[];
  thumbnailTracks?: TimelineTrack[];
  thumbnailSelectedClipId?: string | null;
  thumbnailSelectedTrackId?: string;

  /** Set up the per-route snapshot fields on the first route change. */
  initRouteState(): void;
  /** Save the current editor state of `prevRoute`, then restore `nextRoute`'s. */
  swapRoute(prev: string | null, next: EditorRoute): void;
}

export const createModeSlice: StateCreator<EditorStore, [], [], ModeSlice> = (
  set,
  get,
) => ({
  currentRoute: "/",

  initRouteState: () => {
    const s = get();
    if (s.videoClips === undefined) set({ videoClips: [...s.timelineClips] });
    if (s.videoTracks === undefined)
      set({ videoTracks: [...DEFAULT_VIDEO_TRACKS] });
    if (s.thumbnailTracks === undefined)
      set({ thumbnailTracks: [...DEFAULT_THUMBNAIL_TRACKS] });
    if (s.thumbnailClips === undefined)
      set({ thumbnailClips: DEFAULT_THUMBNAIL_CLIPS.map((c) => ({ ...c })) });
    if (s.videoSelectedClipId === undefined) set({ videoSelectedClipId: null });
    if (s.thumbnailSelectedClipId === undefined)
      set({ thumbnailSelectedClipId: "thumb-text-1" });
    if (s.videoSelectedTrackId === undefined)
      set({ videoSelectedTrackId: "track-2" });
    if (s.thumbnailSelectedTrackId === undefined)
      set({ thumbnailSelectedTrackId: "track-2" });
  },

  swapRoute: (prev, next) => {
    get().initRouteState();

    if (prev !== next) {
      if (prev) {
        if (prev === "/")
          set({
            videoClips: [...get().timelineClips],
            videoSelectedClipId: get().selectedClipId,
            videoTracks: [...get().timelineTracks],
            videoSelectedTrackId: get().selectedTrackId,
          });
        else if (prev === "/image")
          set({
            thumbnailClips: [...get().timelineClips],
            thumbnailSelectedClipId: get().selectedClipId,
            thumbnailTracks: [...get().timelineTracks],
            thumbnailSelectedTrackId: get().selectedTrackId,
          });
      }

      if (next === "/")
        set({
          timelineClips: [...(get().videoClips ?? [])],
          selectedClipId: get().videoSelectedClipId ?? null,
          timelineTracks: [...(get().videoTracks ?? get().timelineTracks)],
          selectedTrackId: get().videoSelectedTrackId ?? "track-1",
        });
      else if (next === "/image")
        set({
          timelineClips: [...(get().thumbnailClips ?? [])],
          selectedClipId: get().thumbnailSelectedClipId ?? null,
          timelineTracks: [...(get().thumbnailTracks ?? get().timelineTracks)],
          selectedTrackId: get().thumbnailSelectedTrackId ?? "track-1",
        });
    }

    set({ currentRoute: next });
  },
});
