import type { MediaItem } from "../../lib/media-helper";
import type React from "react";

export type SubTab = "uploads" | "pixabay" | "pexels" | "emoji";

// ─── Pexels ─────────────────────────────────────────────────────────────────

export interface PexelsPhotoSrc {
  original: string;
  large: string;
  large2x: string;
  medium: string;
  small: string;
  tiny: string;
}

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: PexelsPhotoSrc;
}

export interface PexelsVideoFile {
  width: number;
  height: number;
  link: string;
  file_type: string;
  size?: number;
  quality?: "sd" | "hd" | "original";
}

export interface PexelsVideoUser {
  name: string;
  url: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
  user?: PexelsVideoUser;
}

// ─── Pixabay ────────────────────────────────────────────────────────────────

export interface PixabayVideoFile {
  url: string;
  width: number;
  height: number;
  size?: number;
  thumbnail?: string;
}

export interface PixabayItem {
  id: number;
  type: string;
  tags: string;
  user: string;
  user_id: number;
  duration: number;
  videos: Record<string, PixabayVideoFile>;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  pageURL: string;
}

// ─── Emoji ──────────────────────────────────────────────────────────────────

export interface EmojiItem {
  tag: string;
  codepoint: string;
}

export interface EmojiCategory {
  id: string;
  items: EmojiItem[];
}

export interface EmojisData {
  categories: EmojiCategory[];
}

// ─── PanelState ─────────────────────────────────────────────────────────────

export interface PanelState {
  activeSubTab: SubTab;
  activeUploadsCount: number;
  totalUploadsCount: number;
  loadingAssetId: string | null;

  pexelsQuery: string;
  pexelsVideos: PexelsVideo[];
  pexelsPhotos: PexelsPhoto[];
  pexelsMediaType: "video" | "photo";
  pexelsOrientation: "all" | "landscape" | "portrait" | "square";
  pexelsDuration: "all" | "short" | "medium" | "long";
  pexelsCurrentPage: number;
  pexelsVisibleCount: number;
  hasMorePexels: boolean;
  showPexelsFilters: boolean;
  isSearchingPexels: boolean;
  pexelsError: string | null;

  emojisData: EmojisData | null;
  emojiQuery: string;
  emojiCategory: string;
  emojiVisibleCount: number;
  hoveredEmojiCodepoint: string | null;

  pixabayQuery: string;
  pixabayMediaType: string;
  pixabayOrientation: string;
  pixabayTransparentOnly: boolean;
  pixabayItems: PixabayItem[];
  pixabayVisibleCount: number;
  pixabayCurrentPage: number;
  hasMorePixabay: boolean;
  isSearchingPixabay: boolean;
  pixabayError: string | null;
  showPixabayFilters: boolean;
}

export const createPanelState = (): PanelState => ({
  activeSubTab: "uploads",
  activeUploadsCount: 0,
  totalUploadsCount: 0,
  loadingAssetId: null,

  pexelsQuery: "Rain forest",
  pexelsVideos: [],
  pexelsPhotos: [],
  pexelsMediaType: "video",
  pexelsOrientation: "landscape",
  pexelsDuration: "all",
  pexelsCurrentPage: 1,
  pexelsVisibleCount: 10,
  hasMorePexels: true,
  showPexelsFilters: false,
  isSearchingPexels: false,
  pexelsError: null,

  emojisData: null,
  emojiQuery: "",
  emojiCategory: "all",
  emojiVisibleCount: 24,
  hoveredEmojiCodepoint: null,

  pixabayQuery: "cozy lofi",
  pixabayMediaType: "video",
  pixabayOrientation: "all",
  pixabayTransparentOnly: false,
  pixabayItems: [],
  pixabayVisibleCount: 10,
  pixabayCurrentPage: 1,
  hasMorePixabay: true,
  isSearchingPixabay: false,
  pixabayError: null,
  showPixabayFilters: false,
});

// ─── API surface exposed to sub-tabs ────────────────────────────────────────

export interface MediaLibraryApi {
  st: PanelState;
  apply: (patch: Partial<PanelState>) => void;
  uploads: MediaItem[];
  hoverTimeoutRef: React.MutableRefObject<number | null>;
  hoverScheduledRef: React.MutableRefObject<string | null>;
  selectSubTab: (tabId: SubTab) => void;
  searchPexels: (query: string, resetPage?: boolean) => void;
  loadMorePexels: () => void;
  searchPixabay: (query: string, resetPage?: boolean) => void;
  loadMorePixabay: () => void;
  addAssetToTimeline: (asset: MediaItem, asType: string) => void;
  handleAssetAdd: (asset: MediaItem, asType: string) => void;
  handlePexelsAdd: (media: PexelsPhoto | PexelsVideo, asType: string) => void;
  handlePixabayAdd: (item: PixabayItem, asType: string) => void;
  handleEmojiAdd: (emoji: EmojiItem) => void;
  triggerUpload: () => void;
}
