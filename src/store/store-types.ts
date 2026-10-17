import type { PlaybackSlice } from "./slices/playback";
import type { RecordingSlice } from "./slices/recording";
import type { TimelineSlice } from "./slices/timeline";
import type { InteractionSlice } from "./slices/interaction";
import type { MediaPoolSlice } from "./slices/media-pool";
import type { LayoutSlice } from "./slices/layout";
import type { ModeSlice } from "./slices/mode";
import type { ThumbnailSlice } from "./slices/thumbnail";

/** Complete editor store shape: all slices composed. */
export type EditorStore = PlaybackSlice &
  RecordingSlice &
  TimelineSlice &
  InteractionSlice &
  MediaPoolSlice &
  LayoutSlice &
  ModeSlice &
  ThumbnailSlice;
