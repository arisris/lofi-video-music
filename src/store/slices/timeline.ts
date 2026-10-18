import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";
import type { TimelineClip, TimelineTrack, ClipSettings } from "../../types/clips";

const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "track-1", name: "Track 1 (Music)", locked: false },
  { id: "track-2", name: "Track 2", locked: false },
];

/** Timeline tracks, clips, selection, and scroll state. */
export interface TimelineSlice {
  /** Per-registry-clip default settings (shared across all track clips). */
  clipSettings: Record<string, ClipSettings>;
  /** VFX effect settings registry. */
  effectSettings: Record<string, ClipSettings>;

  timelineTracks: TimelineTrack[];
  timelineClips: TimelineClip[];
  selectedClipId: string | null;
  selectedTrackId: string;
  selectedTextItemIndex: number;
  /** Pixels per second. */
  timelineZoom: number;
  timelineScrollLeft: number;
  timelineScrollTop: number;
}

export const createTimelineSlice: StateCreator<EditorStore, [], [], TimelineSlice> = () => ({
  clipSettings: {},
  effectSettings: {},
  timelineTracks: [...DEFAULT_TRACKS],
  timelineClips: [],
  selectedClipId: null,
  selectedTrackId: "track-1",
  selectedTextItemIndex: -1,
  timelineZoom: 4,
  timelineScrollLeft: 0,
  timelineScrollTop: 0,
});
