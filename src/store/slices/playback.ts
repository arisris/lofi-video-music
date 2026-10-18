import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";

/** Playlist playback + audio engine + visualizer analysis buffer. */
export interface PlaybackSlice {
  currentTime: number;
  isPlaying: boolean;

  playlist: unknown[];
  currentTrackIndex: number;
  isAudioInit: boolean;

  /** Track-transition bookkeeping for the music playlist. */
  bgTransitionStyle: string;
  prevTrackIndex: number;
  prevTrackTime: number;
  transitionStartTime: number;
  isTransitioning: boolean;
  transitionDuration: number;
}

export const createPlaybackSlice: StateCreator<
  EditorStore,
  [],
  [],
  PlaybackSlice
> = () => ({
  currentTime: 0,
  isPlaying: false,

  playlist: [],
  currentTrackIndex: -1,
  isAudioInit: false,

  bgTransitionStyle: "fade",
  prevTrackIndex: -1,
  prevTrackTime: 0,
  transitionStartTime: 0,
  isTransitioning: false,
  transitionDuration: 1500,
});
