import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";
import type { MediaItem } from "../../types/media";

/** Loose bags of search/filter UI state per media panel (persisted on unmount). */
export interface EmojiPanelState {
  emojiQuery?: string;
  emojiCategory?: string;
  emojiVisibleCount?: number;
  [key: string]: unknown;
}

export interface PexelsPanelState {
  activeSubTab?: string;
  activeUploadsCount?: number;
  totalUploadsCount?: number;
  loadingAssetId?: string | null;
  pexelsQuery?: string;
  pexelsVideos?: unknown[];
  pexelsPhotos?: unknown[];
  pexelsMediaType?: string;
  pexelsOrientation?: string;
  pexelsDuration?: string;
  pexelsCurrentPage?: number;
  pexelsVisibleCount?: number;
  hasMorePexels?: boolean;
  showPexelsFilters?: boolean;
  isSearchingPexels?: boolean;
  pexelsError?: string | null;
  [key: string]: unknown;
}

export interface PixabayPanelState {
  pixabayQuery?: string;
  pixabayMediaType?: string;
  pixabayOrientation?: string;
  pixabayTransparentOnly?: boolean;
  pixabayItems?: unknown[];
  pixabayVisibleCount?: number;
  pixabayCurrentPage?: number;
  hasMorePixabay?: boolean;
  isSearchingPixabay?: boolean;
  pixabayError?: string | null;
  showPixabayFilters?: boolean;
  [key: string]: unknown;
}

/** Central media library + left/inspector tab state. */
export interface MediaPoolSlice {
  mediaPool: MediaItem[];
  /** Left panel tab; undefined until the media pool initializes it. */
  activeLeftTab?: string;
  /** Clip type tab active in the main panels. */
  activeClipTab: string;
  activeInspectorTab?: string;

  emojiPanelState: EmojiPanelState | null;
  pexelsPanelState: PexelsPanelState | null;
  pixabayPanelState: PixabayPanelState | null;
}

export const createMediaPoolSlice: StateCreator<
  EditorStore,
  [],
  [],
  MediaPoolSlice
> = () => ({
  mediaPool: [],
  activeClipTab: "visualizer",

  emojiPanelState: null,
  pexelsPanelState: null,
  pixabayPanelState: null,
});
