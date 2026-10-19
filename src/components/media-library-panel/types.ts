export type SubTab = "uploads" | "pixabay" | "pexels" | "emoji";

export interface PanelState {
  activeSubTab: SubTab;
  activeUploadsCount: number;
  totalUploadsCount: number;
  loadingAssetId: string | null;

  pexelsQuery: string;
  pexelsVideos: any[];
  pexelsPhotos: any[];
  pexelsMediaType: "video" | "photo";
  pexelsOrientation: "all" | "landscape" | "portrait" | "square";
  pexelsDuration: "all" | "short" | "medium" | "long";
  pexelsCurrentPage: number;
  pexelsVisibleCount: number;
  hasMorePexels: boolean;
  showPexelsFilters: boolean;
  isSearchingPexels: boolean;
  pexelsError: string | null;

  emojisData: any;
  emojiQuery: string;
  emojiCategory: string;
  emojiVisibleCount: number;
  hoveredEmojiCodepoint: string | null;

  pixabayQuery: string;
  pixabayMediaType: string;
  pixabayOrientation: string;
  pixabayTransparentOnly: boolean;
  pixabayItems: any[];
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
