import { useEffect, useReducer, useRef } from "react";
import { Button } from "../../shared/ui/Button";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import {
  processMediaFile,
  processMediaUrl,
  type MediaItem,
} from "../media/media-helper";
import {
  deleteDownload,
  formatBytes,
  getDownloadsUsage,
  hydrateDownloads,
  putDownload,
} from "../media/download-cache";
import { useEditorStore } from "../../store/editor-store";
import { addClipOfType } from "../dock/clip-actions";
import { getDesignSize } from "../../shared/lib/canvas-space";
import { buildPresetKeyframes } from "../../shared/lib/motion-keyframes";
import {
  MISSING_PEXELS_KEY_MESSAGE,
  MISSING_PIXABAY_KEY_MESSAGE,
  STOCK_KEYS_EVENT,
  getPexelsKey,
  getPixabayKey,
} from "../media/stock/api-keys";
import {
  searchPexelsDirect,
  type PexelsPhoto,
  type PexelsVideo,
} from "../media/stock/pexels-client";
import {
  searchPixabayDirect,
  type PixabayItem,
} from "../media/stock/pixabay-client";
import emojisData from "../../data/animated-emojis.json";

type SubTab = "uploads" | "pixabay" | "pexels" | "emoji";

const SUB_TABS: Array<{ id: SubTab; label: string; icon: string }> = [
  { id: "uploads", label: "Uploads", icon: "icon-[ri--upload-cloud-2-line]" },
  { id: "pixabay", label: "Pixabay", icon: "icon-[ri--global-line]" },
  { id: "pexels", label: "Pexels", icon: "icon-[ri--camera-lens-line]" },
  { id: "emoji", label: "Emoji", icon: "icon-[ri--emotion-happy-line]" },
];

const EMOJI_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  { id: "Smileys and emotions", label: "Smileys" },
  { id: "People", label: "People" },
  { id: "Animals and nature", label: "Animals" },
  { id: "Food and drink", label: "Food" },
  { id: "Travel and places", label: "Places" },
  { id: "Activities and events", label: "Activities" },
  { id: "Objects", label: "Objects" },
  { id: "Symbols", label: "Symbols" },
  { id: "Flags", label: "Flags" },
];

const MISSING_KEY_ERRORS = new Set([
  MISSING_PEXELS_KEY_MESSAGE,
  MISSING_PIXABAY_KEY_MESSAGE,
]);

/** Empty-state shown when the provider API key is missing, with a shortcut to Settings. */
function MissingKeyNotice({ message }: { message: string }) {
  const openSettings = () => {
    useEditorStore.setState({
      activeLeftTab: "settings",
      leftPanelCollapsed: false,
    });
  };
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
      <i className="icon-[ri--key-2-line] h-8 w-8 text-neutral-700" />
      <p className="text-xs font-medium text-neutral-500">{message}</p>
      <button
        className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-blue-500"
        onClick={openSettings}
      >
        <i className="icon-[ri--settings-3-line] h-3 w-3" />
        Open Settings
      </button>
    </div>
  );
}

/** Shared stock-tab search header (Pixabay + Pexels). */
function StockSearchBar({
  query,
  placeholder,
  showFilters,
  onQueryChange,
  onToggleFilters,
  onSearch,
}: {
  query: string;
  placeholder: string;
  showFilters: boolean;
  onQueryChange: (v: string) => void;
  onToggleFilters: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 pl-8 text-[11px] text-neutral-300 outline-none focus:border-blue-500/50"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
        />
        <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-neutral-500" />
      </div>
      <button
        title="Toggle Filters"
        className={`flex cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-all ${showFilters ? "border-blue-500/30 bg-blue-600/20 text-blue-400" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
        onClick={onToggleFilters}
      >
        <i className="icon-[ri--filter-3-line] h-3.5 w-3.5" />
      </button>
      <button
        className="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent bg-blue-600 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500"
        onClick={onSearch}
      >
        <i className="icon-[ri--search-2-line] h-3 w-3" />
        Search
      </button>
    </div>
  );
}

/** Shared filter chip row (Type / Orientation / Duration). */
function FilterChipRow<T extends string>({
  label,
  options,
  value,
  variant = "solid",
  onPick,
}: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  variant?: "solid" | "outline";
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
        {label}
      </span>
      <div className="flex rounded-lg border border-neutral-850 bg-neutral-950 p-0.5">
        {options.map(([val, optLabel]) => (
          <button
            key={val}
            className={
              variant === "solid"
                ? `cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${value === val ? "bg-blue-600 text-white" : "text-neutral-500 hover:text-neutral-300"}`
                : `cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${value === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-neutral-500 hover:text-neutral-300"}`
            }
            onClick={() => onPick(val)}
          >
            {optLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Shared "add as background / overlay" hover buttons. */
function TimelineAddButtons({
  onBackground,
  onOverlay,
}: {
  onBackground: () => void;
  onOverlay: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        title="Add as Background"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-500"
        onClick={onBackground}
      >
        <i className="icon-[ri--image-line] h-4 w-4" />
      </button>
      <button
        title="Add as Overlay"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-200 shadow-lg transition-all hover:scale-110 hover:bg-neutral-700"
        onClick={onOverlay}
      >
        <i className="icon-[ri--image-add-line] h-4 w-4" />
      </button>
    </div>
  );
}

/** Shared loading / error / load-more blocks for stock tabs. */
function StockLoading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <span className="text-xs font-medium text-neutral-400">{text}</span>
    </div>
  );
}

function StockError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 p-4">
      <i className="mt-0.5 icon-[ri--error-warning-line] h-4.5 w-4.5 text-red-500" />
      <div>
        <p className="text-[10px] font-bold tracking-wide text-red-400 uppercase">
          Search Error
        </p>
        <p className="mt-0.5 text-[9px] leading-relaxed text-red-300/80">
          {message}
        </p>
      </div>
    </div>
  );
}

function StockLoadMore({
  show,
  loading,
  onLoad,
}: {
  show: boolean;
  loading: boolean;
  onLoad: () => void;
}) {
  if (!show) return null;
  return (
    <div className="mt-4 flex items-center justify-center border-t border-neutral-800 pt-4">
      <Button variant="ghost" disabled={loading} onClick={onLoad}>
        {loading ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
            Loading More...
          </>
        ) : (
          <>
            <i className="icon-[ri--arrow-down-s-line] h-3.5 w-3.5" />
            Load More
          </>
        )}
      </Button>
    </div>
  );
}

/** Shared library card (local files + downloads). */
function LibraryMediaCard({
  asset,
  onBackground,
  onOverlay,
  onDelete,
}: {
  asset: MediaItem;
  onBackground: () => void;
  onOverlay: () => void;
  onDelete?: () => void;
}) {
  const width = asset.width || (asset.type === "video" ? 16 : 1);
  const height = asset.height || (asset.type === "video" ? 9 : 1);
  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {asset.thumbnail ? (
        <img
          src={asset.thumbnail}
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-neutral-900">
          <i
            className={
              asset.type === "video"
                ? "icon-[ri--film-line] h-6 w-6 text-neutral-700"
                : "icon-[ri--image-line] h-6 w-6 text-neutral-700"
            }
          />
        </div>
      )}
      {onDelete && (
        <button
          title="Delete download"
          className="absolute top-1.5 left-1.5 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-neutral-300 transition-colors hover:bg-red-600 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <i className="icon-[ri--close-line] h-3.5 w-3.5" />
        </button>
      )}
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        {onDelete && !asset.persisted && (
          <span className="rounded bg-amber-600/80 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-white uppercase">
            Session only
          </span>
        )}
        {asset.type === "video" && (
          <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-neutral-300">
            {`${Math.round(asset.duration)}s`}
          </span>
        )}
      </div>
      {asset.type === "video" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity group-hover:opacity-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur-sm">
            <i className="icon-[ri--play-fill] h-4.5 w-4.5 text-neutral-200" />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-10 flex-col justify-end bg-linear-to-t from-black/80 via-black/40 to-transparent p-2">
        <span className="truncate pr-1 text-[9px] font-bold text-neutral-200">
          {asset.name}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-neutral-950/80 opacity-0 transition-opacity group-hover:opacity-100">
        <TimelineAddButtons onBackground={onBackground} onOverlay={onOverlay} />
      </div>
    </div>
  );
}

interface EmojiItem {
  tag: string;
  codepoint: string;
}

interface PanelState {
  activeSubTab: SubTab;
  activeUploadsCount: number;
  totalUploadsCount: number;
  loadingAssetId: string | null;
  downloadWarning: string | null;
  downloadsReady: boolean;
  pexelsQuery: string;
  pexelsVideos: PexelsVideo[];
  pexelsPhotos: PexelsPhoto[];
  pexelsMediaType: "video" | "photo";
  pexelsOrientation: "all" | "landscape" | "portrait" | "square";
  pexelsDuration: string;
  pexelsCurrentPage: number;
  pexelsVisibleCount: number;
  hasMorePexels: boolean;
  showPexelsFilters: boolean;
  storageBytes: number | null;
  storageQuota: number | null;
  isSearchingPexels: boolean;
  pexelsError: string | null;
  emojiQuery: string;
  emojiCategory: string;
  emojiVisibleCount: number;
  hoveredEmojiCodepoint: string | null;
  pixabayQuery: string;
  pixabayMediaType: "video" | "photo" | "illustration" | "vector";
  pixabayOrientation: "all" | "landscape" | "portrait";
  pixabayTransparentOnly: boolean;
  pixabayItems: PixabayItem[];
  pixabayVisibleCount: number;
  pixabayCurrentPage: number;
  hasMorePixabay: boolean;
  isSearchingPixabay: boolean;
  pixabayError: string | null;
  showPixabayFilters: boolean;
}

const createPanelState = (): PanelState => ({
  activeSubTab: "uploads",
  activeUploadsCount: 0,
  totalUploadsCount: 0,
  loadingAssetId: null,
  downloadWarning: null,
  downloadsReady: false,
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
  storageBytes: null,
  storageQuota: null,
  isSearchingPexels: false,
  pexelsError: null,
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

export const MediaLibraryPanel = () => {
  const stRef = useRef<PanelState>(createPanelState());
  const hoverTimeoutRef = useRef<number | null>(null);
  const hoverScheduledRef = useRef<string | null>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const apply = (patch: Partial<PanelState>) => {
    Object.assign(stRef.current, patch);
    forceUpdate();
  };

  const selectSubTab = (tabId: SubTab) => {
    apply({ activeSubTab: tabId });
    if (
      tabId === "pexels" &&
      stRef.current.pexelsVideos.length === 0 &&
      stRef.current.pexelsPhotos.length === 0 &&
      !stRef.current.isSearchingPexels
    ) {
      searchPexels(stRef.current.pexelsQuery);
    }
    if (
      tabId === "pixabay" &&
      stRef.current.pixabayItems.length === 0 &&
      !stRef.current.isSearchingPixabay
    ) {
      searchPixabay(stRef.current.pixabayQuery);
    }
  };

  const searchPexels = (query: string, resetPage = true) => {
    if (!query || !query.trim()) return;
    const key = getPexelsKey();
    if (!key) {
      apply({
        pexelsError: MISSING_PEXELS_KEY_MESSAGE,
        isSearchingPexels: false,
      });
      return;
    }
    if (resetPage) {
      apply({
        pexelsCurrentPage: 1,
        pexelsVisibleCount: 10,
        hasMorePexels: true,
        ...(stRef.current.pexelsMediaType === "photo"
          ? { pexelsPhotos: [] }
          : { pexelsVideos: [] }),
      });
    }
    const state = stRef.current;
    apply({ isSearchingPexels: true, pexelsError: null });
    searchPexelsDirect({
      key,
      query: query.trim(),
      type: state.pexelsMediaType,
      orientation: state.pexelsOrientation,
      page: state.pexelsCurrentPage,
      per_page: 50,
    })
      .then((data) => {
        const newPhotos = data.photos || [];
        const newVideos = data.videos || [];
        const newItems =
          stRef.current.pexelsMediaType === "photo" ? newPhotos : newVideos;
        apply({ hasMorePexels: newItems.length >= 50 });
        if (stRef.current.pexelsMediaType === "photo") {
          apply({
            pexelsPhotos: stRef.current.pexelsPhotos.concat(newPhotos),
            pexelsVideos: [],
          });
        } else {
          apply({
            pexelsVideos: stRef.current.pexelsVideos.concat(newVideos),
            pexelsPhotos: [],
          });
        }
        apply({ isSearchingPexels: false });
      })
      .catch((err) => {
        apply({
          pexelsError:
            (err as { message?: string }).message ||
            "Failed to fetch from Pexels",
          isSearchingPexels: false,
        });
      });
  };

  const loadMorePexels = () => {
    apply({ pexelsVisibleCount: stRef.current.pexelsVisibleCount + 10 });
    const isVideoMode = stRef.current.pexelsMediaType === "video";
    let items: PexelsVideo[] | PexelsPhoto[] = isVideoMode
      ? stRef.current.pexelsVideos
      : stRef.current.pexelsPhotos;
    if (isVideoMode && stRef.current.pexelsDuration !== "all") {
      const vids = items as PexelsVideo[];
      items = vids.filter((v) => {
        if (stRef.current.pexelsDuration === "short") return v.duration <= 15;
        if (stRef.current.pexelsDuration === "medium")
          return v.duration > 15 && v.duration <= 30;
        if (stRef.current.pexelsDuration === "long") return v.duration > 30;
        return true;
      });
    }
    if (
      stRef.current.pexelsVisibleCount >= items.length &&
      !stRef.current.isSearchingPexels &&
      stRef.current.hasMorePexels
    ) {
      apply({ pexelsCurrentPage: stRef.current.pexelsCurrentPage + 1 });
      searchPexels(stRef.current.pexelsQuery, false);
    }
  };

  const searchPixabay = (query: string, resetPage = true) => {
    if (!query || !query.trim()) return;
    const key = getPixabayKey();
    if (!key) {
      apply({
        pixabayError: MISSING_PIXABAY_KEY_MESSAGE,
        isSearchingPixabay: false,
      });
      return;
    }
    if (resetPage) {
      apply({
        pixabayCurrentPage: 1,
        pixabayVisibleCount: 10,
        hasMorePixabay: true,
        pixabayItems: [],
      });
    }
    const state = stRef.current;
    apply({ isSearchingPixabay: true, pixabayError: null });
    searchPixabayDirect({
      key,
      query: query.trim(),
      type: state.pixabayMediaType,
      orientation: state.pixabayOrientation,
      colors:
        state.pixabayMediaType !== "video" && state.pixabayTransparentOnly
          ? "transparent"
          : "",
      page: state.pixabayCurrentPage,
      per_page: 55,
    })
      .then((data) => {
        const hits = data.hits || [];
        apply({ hasMorePixabay: hits.length >= 55 });
        apply({
          pixabayItems: stRef.current.pixabayItems.concat(hits),
          isSearchingPixabay: false,
        });
      })
      .catch((err) => {
        apply({
          pixabayError:
            (err as { message?: string }).message ||
            "Failed to fetch from Pixabay",
          isSearchingPixabay: false,
        });
      });
  };

  const loadMorePixabay = () => {
    apply({ pixabayVisibleCount: stRef.current.pixabayVisibleCount + 10 });
    if (
      stRef.current.pixabayVisibleCount >= stRef.current.pixabayItems.length &&
      !stRef.current.isSearchingPixabay &&
      stRef.current.hasMorePixabay
    ) {
      apply({ pixabayCurrentPage: stRef.current.pixabayCurrentPage + 1 });
      searchPixabay(stRef.current.pixabayQuery, false);
    }
  };

  const addAssetToTimeline = (asset: MediaItem, asType: string) => {
    if (asType === "background") {
      // New backgrounds start from an editable wander template, not an
      // opaque procedural preset — every point is tweakable in the panel.
      const { w, h } = getDesignSize();
      const wander =
        asset.type === "video" ? [] : buildPresetKeyframes("random", 60, w, h);
      addClipOfType("background", {
        mediaId: asset.id,
        mediaType: asset.type,
        mediaElement: asset.element ?? null,
        mediaElements: asset.type === "video" ? (asset.elements ?? null) : null,
        gifFrames: (asset as { gifFrames?: unknown }).gifFrames ?? null,
        gifDuration: (asset as { gifDuration?: unknown }).gifDuration ?? 0,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        motionPreset: wander.length > 0 ? "random" : "none",
        motionKeyframes: wander,
        style: "media",
      });
    } else {
      addClipOfType("overlay", {
        mediaId: asset.id,
        mediaType: asset.type,
        mediaElement: asset.element ?? null,
        mediaElements: asset.type === "video" ? (asset.elements ?? null) : null,
        gifFrames: (asset as { gifFrames?: unknown }).gifFrames ?? null,
        gifDuration: (asset as { gifDuration?: unknown }).gifDuration ?? 0,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        loop: true,
        opacity: 1.0,
      });
    }
  };

  const handleAssetAdd = (asset: MediaItem, asType: string) => {
    const existing = useEditorStore
      .getState()
      .mediaPool.find((m) => m.id === asset.id || m.url === asset.url);
    if (existing) {
      addAssetToTimeline(existing, asType);
      return;
    }
    apply({ loadingAssetId: asset.id });
    processMediaUrl(
      asset.url,
      asset.type,
      asset.name,
      asset.source || "stock",
      (processed) => {
        (processed as MediaItem).id = asset.id;
        useEditorStore.setState((s) => ({
          mediaPool: [...s.mediaPool, processed],
        }));
        apply({ loadingAssetId: null });
        addAssetToTimeline(processed, asType);
        forceUpdate();
        // Persist provider downloads in IndexedDB for cross-session reuse.
        // Best effort: on failure the item stays usable for this session only.
        if (
          (asset.source === "pexels" || asset.source === "pixabay") &&
          processed.url.startsWith("blob:")
        ) {
          void (async () => {
            try {
              const blob = await (await fetch(processed.url)).blob();
              if (!blob || blob.size === 0) throw new Error("empty bytes");
              await putDownload({
                id: asset.id,
                name: asset.name,
                type: processed.type,
                source: asset.source as string,
                mime: blob.type,
                blob,
                thumbnail: processed.thumbnail,
                duration: processed.duration,
                width: processed.width ?? 0,
                height: processed.height ?? 0,
                remoteUrl: asset.url,
                createdAt: Date.now(),
              });
              useEditorStore.setState((s) => ({
                mediaPool: s.mediaPool.map((m) =>
                  m.id === asset.id ? { ...m, persisted: true } : m,
                ),
              }));
              refreshStorage();
              forceUpdate();
            } catch {
              apply({
                downloadWarning:
                  "Could not save the download locally (storage full or blocked). It remains available for this session only.",
              });
            }
          })();
        }
      },
    );
  };

  const handlePexelsAdd = (
    media: PexelsPhoto | PexelsVideo,
    asType: string,
  ) => {
    if (stRef.current.pexelsMediaType === "photo") {
      const photo = media as PexelsPhoto;
      handleAssetAdd(
        {
          id: `pexels-photo-${photo.id}`,
          name: `Pexels - ${photo.photographer || "Photo"}`,
          type: "image",
          source: "pexels",
          url: photo.src.large || photo.src.original,
          thumbnail: photo.src.medium || photo.src.small,
          duration: 0,
          width: photo.width,
          height: photo.height,
        } as MediaItem,
        asType,
      );
    } else {
      const vid = media as PexelsVideo;
      const files = vid.video_files || [];
      let bestFile =
        files.find(
          (f) =>
            f.width >= 960 && f.width <= 1280 && f.file_type === "video/mp4",
        ) ||
        files.find((f) => f.quality === "sd" && f.file_type === "video/mp4") ||
        files.find((f) => f.file_type === "video/mp4") ||
        files[0];
      if (!bestFile || !bestFile.link) return;
      handleAssetAdd(
        {
          id: `pexels-${vid.id}`,
          name: `Pexels - ${vid.user?.name || "Video"}`,
          type: "video",
          source: "pexels",
          url: bestFile.link,
          thumbnail: vid.image,
          duration: vid.duration,
          width: vid.width,
          height: vid.height,
        } as MediaItem,
        asType,
      );
    }
  };

  const handlePixabayAdd = (item: PixabayItem, asType: string) => {
    if (stRef.current.pixabayMediaType === "video") {
      const videos = item.videos || {};
      const bestVid =
        videos.medium ||
        videos.small ||
        videos.large ||
        videos.tiny ||
        ({} as PixabayItem["videos"][string]);
      handleAssetAdd(
        {
          id: `pixabay-video-${item.id}`,
          name: `Pixabay - ${item.user || "Video"}`,
          type: "video",
          source: "pixabay",
          url: bestVid.url,
          thumbnail: bestVid.thumbnail || "",
          duration: item.duration,
          width: bestVid.width || 1280,
          height: bestVid.height || 720,
        } as MediaItem,
        asType,
      );
    } else {
      handleAssetAdd(
        {
          id: `pixabay-image-${item.id}`,
          name: `Pixabay - ${item.user || "Image"}`,
          type: "image",
          source: "pixabay",
          url: item.largeImageURL || item.webformatURL,
          thumbnail: item.previewURL || item.webformatURL,
          duration: 0,
          width: item.imageWidth || 1920,
          height: item.imageHeight || 1080,
        } as MediaItem,
        asType,
      );
    }
  };

  const handleEmojiAdd = (emoji: EmojiItem) => {
    handleAssetAdd(
      {
        id: `emoji-${emoji.codepoint}`,
        name: `Emoji - ${emoji.tag}`,
        type: "image",
        source: "emoji",
        url: `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.gif`,
        thumbnail: `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.webp`,
        duration: 0,
        width: 512,
        height: 512,
      } as MediaItem,
      "overlay",
    );
  };

  const refreshStorage = () => {
    void (async () => {
      try {
        const { bytes } = await getDownloadsUsage();
        let quota: number | null = null;
        try {
          const est = await navigator.storage?.estimate?.();
          if (typeof est?.quota === "number" && Number.isFinite(est.quota)) {
            quota = est.quota;
          }
        } catch {
          /* estimate unavailable — show bytes only */
        }
        apply({ storageBytes: bytes, storageQuota: quota });
      } catch {
        /* keep previous values on failure */
      }
    })();
  };

  const handleDownloadDelete = (id: string) => {
    void deleteDownload(id).finally(refreshStorage);
    useEditorStore.getState().removeMediaItem(id);
    forceUpdate();
  };

  const triggerUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length === 0) return;
      apply({
        activeUploadsCount: stRef.current.activeUploadsCount + files.length,
        totalUploadsCount: stRef.current.totalUploadsCount + files.length,
      });
      files.forEach((file) => {
        processMediaFile(file, (asset: MediaItem) => {
          useEditorStore.setState((s) => ({
            mediaPool: [...s.mediaPool, asset],
          }));
          apply({ activeUploadsCount: stRef.current.activeUploadsCount - 1 });
          if (stRef.current.activeUploadsCount === 0)
            apply({ totalUploadsCount: 0 });
          forceUpdate();
        });
      });
    };
    input.click();
  };

  useEffect(() => {
    // Restore persisted provider downloads (fresh blob: URLs per session).
    hydrateDownloads().then((items) => {
      if (items.length > 0) {
        useEditorStore.setState((s) => {
          const ids = new Set(s.mediaPool.map((m) => m.id));
          const fresh = items.filter((m) => !ids.has(m.id));
          return fresh.length > 0
            ? { mediaPool: [...s.mediaPool, ...fresh] }
            : s;
        });
      }
      apply({ downloadsReady: true });
      refreshStorage();
    });
    if (
      stRef.current.activeSubTab === "pexels" &&
      stRef.current.pexelsVideos.length === 0 &&
      stRef.current.pexelsPhotos.length === 0 &&
      !stRef.current.isSearchingPexels
    ) {
      searchPexels(stRef.current.pexelsQuery);
    }
    if (
      stRef.current.activeSubTab === "pixabay" &&
      stRef.current.pixabayItems.length === 0 &&
      !stRef.current.isSearchingPixabay
    ) {
      searchPixabay(stRef.current.pixabayQuery);
    }
    // A key saved in Settings while this panel is mounted clears the
    // missing-key notice and retries the current tab's search.
    const onStockKeysChanged = () => {
      const s = stRef.current;
      if (
        s.activeSubTab === "pexels" &&
        s.pexelsError === MISSING_PEXELS_KEY_MESSAGE &&
        getPexelsKey()
      ) {
        searchPexels(s.pexelsQuery);
      } else if (
        s.activeSubTab === "pixabay" &&
        s.pixabayError === MISSING_PIXABAY_KEY_MESSAGE &&
        getPixabayKey()
      ) {
        searchPixabay(s.pixabayQuery);
      } else {
        forceUpdate();
      }
    };
    window.addEventListener(STOCK_KEYS_EVENT, onStockKeysChanged);
    return () => {
      window.removeEventListener(STOCK_KEYS_EVENT, onStockKeysChanged);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = stRef.current;
  useEditorStore((s) => s.selectedClipId);
  const pool = useEditorStore((s) => s.mediaPool);
  const localFiles = pool.filter(
    (m) => m.source === "upload" && m.type !== "audio",
  );
  // Provider downloads (persisted across sessions via IndexedDB, or
  // session-only when the local save failed).
  const downloads = pool.filter(
    (m) =>
      (m.source === "pexels" || m.source === "pixabay") && m.type !== "audio",
  );

  const emojis = emojisData as {
    categories: Array<{ id: string; items: EmojiItem[] }>;
  };
  let filteredEmojis: EmojiItem[] = [];
  {
    const cats = emojis.categories || [];
    if (st.emojiCategory === "all") {
      filteredEmojis = cats.flatMap((cat) => cat.items || []);
    } else {
      filteredEmojis = (
        cats.find((c) => c.id === st.emojiCategory)?.items || []
      ).slice();
    }
    if (st.emojiQuery.trim()) {
      const q = st.emojiQuery.toLowerCase().trim();
      filteredEmojis = filteredEmojis.filter((em) =>
        em.tag.toLowerCase().includes(q),
      );
    }
  }
  const visibleEmojis = filteredEmojis.slice(0, st.emojiVisibleCount);

  const isVideoPexels = st.pexelsMediaType === "video";
  let pexelsItems: Array<PexelsVideo | PexelsPhoto> = isVideoPexels
    ? st.pexelsVideos
    : st.pexelsPhotos;
  if (isVideoPexels && st.pexelsDuration !== "all") {
    pexelsItems = (pexelsItems as PexelsVideo[]).filter((v) => {
      if (st.pexelsDuration === "short") return v.duration <= 15;
      if (st.pexelsDuration === "medium")
        return v.duration > 15 && v.duration <= 30;
      if (st.pexelsDuration === "long") return v.duration > 30;
      return true;
    });
  }
  const visiblePexels = pexelsItems.slice(0, st.pexelsVisibleCount);
  const visiblePixabay = st.pixabayItems.slice(0, st.pixabayVisibleCount);
  const isVideoPixabay = st.pixabayMediaType === "video";
  const storagePercent =
    st.storageBytes != null && st.storageQuota != null && st.storageQuota > 0
      ? Math.min(100, (st.storageBytes / st.storageQuota) * 100)
      : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900/50 p-4">
      <div className="mb-4 flex gap-1 border-b border-neutral-800 pb-1.5">
        {SUB_TABS.map((tab) => {
          const isActive = st.activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              title={tab.label}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[9px] font-bold tracking-tight uppercase transition-all ${isActive ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-300"}`}
              onClick={() => selectSubTab(tab.id)}
            >
              <i className={`${tab.icon} h-3.5 w-3.5`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        {st.activeSubTab === "uploads" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <SectionTitle className="">Local Files</SectionTitle>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[9px] font-bold text-white transition-colors hover:bg-blue-500"
                onClick={triggerUpload}
              >
                <i className="icon-[ri--upload-2-fill] h-3 w-3" />
                Upload
              </button>
            </div>

            {st.activeUploadsCount > 0 && (
              <div className="flex items-center justify-center gap-2.5 rounded-xl border border-blue-900/20 bg-blue-950/10 p-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-[10px] font-semibold text-blue-400">
                  Processing media (
                  {st.totalUploadsCount - st.activeUploadsCount}/
                  {st.totalUploadsCount})...
                </span>
              </div>
            )}

            {localFiles.length === 0 && st.activeUploadsCount === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
                <i className="icon-[ri--folder-upload-line] h-8 w-8 text-neutral-700" />
                <p className="text-xs font-medium text-neutral-500">
                  No local files uploaded yet.
                </p>
              </div>
            )}

            {localFiles.length > 0 && (
              <div className="grid grid-cols-2 items-start gap-3">
                {localFiles.map((asset: MediaItem) => (
                  <LibraryMediaCard
                    key={asset.id}
                    asset={asset}
                    onBackground={() => addAssetToTimeline(asset, "background")}
                    onOverlay={() => addAssetToTimeline(asset, "overlay")}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <SectionTitle className="">Downloaded</SectionTitle>
              {!st.downloadsReady && downloads.length === 0 && (
                <span className="text-[9px] font-medium text-neutral-600">
                  Loading downloads...
                </span>
              )}
            </div>

            {st.downloadWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3">
                <i className="mt-0.5 icon-[ri--alert-line] h-4 w-4 shrink-0 text-amber-400" />
                <p className="flex-1 text-[10px] leading-relaxed text-amber-200/90">
                  {st.downloadWarning}
                </p>
                <button
                  title="Dismiss"
                  className="cursor-pointer text-amber-400/70 transition-colors hover:text-amber-200"
                  onClick={() => apply({ downloadWarning: null })}
                >
                  <i className="icon-[ri--close-line] h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {st.downloadsReady && downloads.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
                <i className="icon-[ri--download-cloud-2-line] h-8 w-8 text-neutral-700" />
                <p className="text-xs font-medium text-neutral-500">
                  No downloads yet. Add photos or videos from Pixabay or Pexels
                  and they will be saved here for every session.
                </p>
              </div>
            )}

            {downloads.length > 0 && (
              <div className="grid grid-cols-2 items-start gap-3">
                {downloads.map((asset: MediaItem) => (
                  <LibraryMediaCard
                    key={asset.id}
                    asset={asset}
                    onBackground={() => addAssetToTimeline(asset, "background")}
                    onOverlay={() => addAssetToTimeline(asset, "overlay")}
                    onDelete={() => handleDownloadDelete(asset.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {st.activeSubTab === "pixabay" && (
          <div className="space-y-4">
            <StockSearchBar
              query={st.pixabayQuery || ""}
              placeholder={`Search ${st.pixabayMediaType}s on Pixabay...`}
              showFilters={st.showPixabayFilters}
              onQueryChange={(v) => apply({ pixabayQuery: v })}
              onToggleFilters={() =>
                apply({ showPixabayFilters: !st.showPixabayFilters })
              }
              onSearch={() => searchPixabay(st.pixabayQuery)}
            />

            {st.showPixabayFilters && (
              <div className="animate-tab-fade-in mt-1.5 mb-1.5 space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3">
                <FilterChipRow
                  label="Type"
                  value={st.pixabayMediaType}
                  options={
                    [
                      ["video", "Video"],
                      ["photo", "Photo"],
                      ["illustration", "Illust"],
                      ["vector", "Vector"],
                    ] as const
                  }
                  onPick={(val) => {
                    apply({ pixabayMediaType: val });
                    searchPixabay(st.pixabayQuery);
                  }}
                />
                <FilterChipRow
                  label="Orientation"
                  variant="outline"
                  value={st.pixabayOrientation}
                  options={
                    [
                      ["all", "Any"],
                      ["landscape", "Horiz"],
                      ["portrait", "Vert"],
                    ] as const
                  }
                  onPick={(val) => {
                    apply({ pixabayOrientation: val });
                    searchPixabay(st.pixabayQuery);
                  }}
                />
                {st.pixabayMediaType !== "video" && (
                  <div className="border-neutral-855 flex items-center justify-between rounded-lg border bg-neutral-950/40 p-1">
                    <div className="flex flex-col pl-1">
                      <span className="text-[9px] font-bold text-neutral-300">
                        Transparent BG (Stickers)
                      </span>
                      <span className="text-[8px] text-neutral-500">
                        Filters transparent PNG elements
                      </span>
                    </div>
                    <button
                      className={`relative h-4 w-8 rounded-full transition-colors ${st.pixabayTransparentOnly ? "bg-blue-600" : "bg-neutral-850"}`}
                      onClick={() => {
                        apply({
                          pixabayTransparentOnly: !st.pixabayTransparentOnly,
                        });
                        searchPixabay(st.pixabayQuery);
                      }}
                    >
                      <div
                        className={`absolute top-0.5 bottom-0.5 w-3 rounded-full bg-white transition-all ${st.pixabayTransparentOnly ? "right-0.5" : "left-0.5"}`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}

            {st.isSearchingPixabay && st.pixabayItems.length === 0 && (
              <StockLoading text="Searching Pixabay..." />
            )}

            {st.pixabayError &&
              (MISSING_KEY_ERRORS.has(st.pixabayError) ? (
                <MissingKeyNotice message={st.pixabayError} />
              ) : (
                <StockError message={st.pixabayError} />
              ))}

            {(!st.isSearchingPixabay || st.pixabayItems.length > 0) &&
              !st.pixabayError && (
                <>
                  {st.pixabayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
                      <i className="icon-[ri--image-line] h-8 w-8 text-neutral-700" />
                      <p className="text-xs font-medium text-neutral-500">{`No items found on Pixabay for "${st.pixabayQuery}".`}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 items-start gap-3">
                        {visiblePixabay.map((item) => {
                          const assetId = isVideoPixabay
                            ? `pixabay-video-${item.id}`
                            : `pixabay-image-${item.id}`;
                          const isLoading = st.loadingAssetId === assetId;
                          let thumbnail = "";
                          let width = 1;
                          let height = 1;
                          if (isVideoPixabay) {
                            const videos = item.videos || {};
                            const bestVid =
                              videos.small ||
                              videos.tiny ||
                              videos.medium ||
                              ({} as PixabayItem["videos"][string]);
                            thumbnail = bestVid.thumbnail || "";
                            width = bestVid.width || 16;
                            height = bestVid.height || 9;
                          } else {
                            thumbnail =
                              item.previewURL || item.webformatURL || "";
                            width = item.previewWidth || 1;
                            height = item.previewHeight || 1;
                          }
                          return (
                            <div
                              key={item.id}
                              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                              style={{ aspectRatio: `${width} / ${height}` }}
                            >
                              {thumbnail ? (
                                <img
                                  src={thumbnail}
                                  className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-neutral-900">
                                  <i
                                    className={
                                      isVideoPixabay
                                        ? "icon-[ri--film-line] h-6 w-6 text-neutral-700"
                                        : "icon-[ri--image-line] h-6 w-6 text-neutral-700"
                                    }
                                  />
                                </div>
                              )}
                              {isVideoPixabay && (
                                <span className="absolute top-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-neutral-300">
                                  {`${Math.round(item.duration)}s`}
                                </span>
                              )}
                              {isVideoPixabay && !isLoading && (
                                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity group-hover:opacity-0">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur-sm">
                                    <i className="icon-[ri--play-fill] h-4.5 w-4.5 text-neutral-200" />
                                  </div>
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-10 flex-col justify-end bg-linear-to-t from-black/80 via-black/40 to-transparent p-2">
                                <span className="truncate pr-1 text-[9px] font-bold text-neutral-200">{`By ${item.user || "Pixabay"}`}</span>
                              </div>
                              {isLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-neutral-950/80">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                                  <span className="text-[8px] font-bold tracking-wider text-neutral-400 uppercase">
                                    Importing...
                                  </span>
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/80 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                  <TimelineAddButtons
                                    onBackground={() =>
                                      handlePixabayAdd(item, "background")
                                    }
                                    onOverlay={() =>
                                      handlePixabayAdd(item, "overlay")
                                    }
                                  />
                                  <a
                                    href={item.pageURL || "https://pixabay.com"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="pointer-events-auto flex cursor-pointer items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-neutral-400 transition-colors hover:text-blue-400"
                                  >
                                    <i className="icon-[ri--external-link-line] h-2.5 w-2.5" />
                                    View on Pixabay
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <StockLoadMore
                        show={
                          st.hasMorePixabay ||
                          st.pixabayItems.length > st.pixabayVisibleCount
                        }
                        loading={st.isSearchingPixabay}
                        onLoad={loadMorePixabay}
                      />
                    </div>
                  )}
                </>
              )}
          </div>
        )}

        {st.activeSubTab === "pexels" && (
          <div className="space-y-4">
            <StockSearchBar
              query={st.pexelsQuery || ""}
              placeholder={`Search ${st.pexelsMediaType}s on Pexels...`}
              showFilters={st.showPexelsFilters}
              onQueryChange={(v) => apply({ pexelsQuery: v })}
              onToggleFilters={() =>
                apply({ showPexelsFilters: !st.showPexelsFilters })
              }
              onSearch={() => searchPexels(st.pexelsQuery)}
            />

            {st.showPexelsFilters && (
              <div className="animate-tab-fade-in mt-1.5 mb-1.5 space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3">
                <FilterChipRow
                  label="Type"
                  value={st.pexelsMediaType}
                  options={
                    [
                      ["video", "Video"],
                      ["photo", "Photo"],
                    ] as const
                  }
                  onPick={(val) => {
                    apply({ pexelsMediaType: val });
                    searchPexels(st.pexelsQuery);
                  }}
                />
                <FilterChipRow
                  label="Orientation"
                  variant="outline"
                  value={st.pexelsOrientation}
                  options={
                    [
                      ["all", "Any"],
                      ["landscape", "Horiz"],
                      ["portrait", "Vert"],
                      ["square", "Sq"],
                    ] as const
                  }
                  onPick={(val) => {
                    apply({ pexelsOrientation: val });
                    searchPexels(st.pexelsQuery);
                  }}
                />
                {st.pexelsMediaType === "video" && (
                  <FilterChipRow
                    label="Duration"
                    variant="outline"
                    value={
                      st.pexelsDuration as "all" | "short" | "medium" | "long"
                    }
                    options={
                      [
                        ["all", "Any"],
                        ["short", "< 15s"],
                        ["medium", "15-30s"],
                        ["long", "> 30s"],
                      ] as const
                    }
                    onPick={(val) => apply({ pexelsDuration: val })}
                  />
                )}
              </div>
            )}

            {st.isSearchingPexels &&
              st.pexelsPhotos.length === 0 &&
              st.pexelsVideos.length === 0 && (
                <StockLoading
                  text={`Searching Pexels ${st.pexelsMediaType}s...`}
                />
              )}

            {st.pexelsError &&
              (MISSING_KEY_ERRORS.has(st.pexelsError) ? (
                <MissingKeyNotice message={st.pexelsError} />
              ) : (
                <StockError message={st.pexelsError} />
              ))}

            {(pexelsItems.length > 0 || !st.isSearchingPexels) &&
              !st.pexelsError && (
                <>
                  {pexelsItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
                      <i
                        className={
                          isVideoPexels
                            ? "icon-[ri--video-chat-line] h-8 w-8 text-neutral-700"
                            : "icon-[ri--image-line] h-8 w-8 text-neutral-700"
                        }
                      />
                      <p className="text-xs font-medium text-neutral-500">{`No ${st.pexelsMediaType}s found for "${st.pexelsQuery}" with current filters.`}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 items-start gap-3">
                        {visiblePexels.map((item) => {
                          const assetId = isVideoPexels
                            ? `pexels-${item.id}`
                            : `pexels-photo-${item.id}`;
                          const isLoading = st.loadingAssetId === assetId;
                          const thumbnail = isVideoPexels
                            ? (item as PexelsVideo).image
                            : (item as PexelsPhoto).src.medium ||
                              (item as PexelsPhoto).src.small;
                          const artist = isVideoPexels
                            ? (item as PexelsVideo).user?.name
                            : (item as PexelsPhoto).photographer;
                          const width = item.width || 1;
                          const height = item.height || 1;
                          return (
                            <div
                              key={assetId}
                              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                              style={{ aspectRatio: `${width} / ${height}` }}
                            >
                              <img
                                src={thumbnail}
                                className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
                              />
                              {isVideoPexels && (
                                <span className="absolute top-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-neutral-300">
                                  {`${Math.round((item as PexelsVideo).duration)}s`}
                                </span>
                              )}
                              {isVideoPexels && !isLoading && (
                                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity group-hover:opacity-0">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur-sm">
                                    <i className="icon-[ri--play-fill] h-4.5 w-4.5 text-neutral-200" />
                                  </div>
                                </div>
                              )}
                              {isLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-neutral-950/80">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                                  <span className="text-[8px] font-bold tracking-wider text-neutral-400 uppercase">
                                    Importing...
                                  </span>
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/80 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                  <TimelineAddButtons
                                    onBackground={() =>
                                      handlePexelsAdd(item, "background")
                                    }
                                    onOverlay={() =>
                                      handlePexelsAdd(item, "overlay")
                                    }
                                  />
                                  <span className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-neutral-400">
                                    <i className="icon-[ri--external-link-line] h-2.5 w-2.5" />
                                    {`By ${artist || "Pexels"}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <StockLoadMore
                        show={
                          st.hasMorePexels ||
                          pexelsItems.length > st.pexelsVisibleCount
                        }
                        loading={st.isSearchingPexels}
                        onLoad={loadMorePexels}
                      />
                    </div>
                  )}
                </>
              )}
          </div>
        )}

        {st.activeSubTab === "emoji" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search animated emojis..."
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 pl-8 text-[11px] text-neutral-300 outline-none focus:border-blue-500/50"
                  value={st.emojiQuery || ""}
                  onChange={(e) =>
                    apply({ emojiQuery: e.target.value, emojiVisibleCount: 24 })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
                <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-neutral-500" />
              </div>
            </div>

            <div className="scrollbar-none mb-1 flex snap-x gap-1 overflow-x-auto pb-1">
              {EMOJI_CATEGORIES.map((cat) => {
                const isSel = st.emojiCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={`shrink-0 cursor-pointer snap-start rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase transition-all ${isSel ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20" : "hover:bg-neutral-750 border border-transparent bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
                    onClick={() =>
                      apply({ emojiCategory: cat.id, emojiVisibleCount: 24 })
                    }
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {filteredEmojis.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
                <i className="icon-[ri--emotion-unhappy-line] h-8 w-8 text-neutral-700" />
                <p className="text-xs font-medium text-neutral-500">
                  No emojis found matching filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {visibleEmojis.map((emoji) => {
                    const isLoading =
                      st.loadingAssetId === `emoji-${emoji.codepoint}`;
                    const isHovered =
                      st.hoveredEmojiCodepoint === emoji.codepoint;
                    return (
                      <div
                        key={emoji.codepoint}
                        className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40 p-2.5 transition-all hover:border-blue-500/50 hover:bg-neutral-900/50"
                        onMouseEnter={() => {
                          if (hoverTimeoutRef.current)
                            clearTimeout(hoverTimeoutRef.current);
                          hoverScheduledRef.current = emoji.codepoint;
                          hoverTimeoutRef.current = setTimeout(() => {
                            if (hoverScheduledRef.current === emoji.codepoint) {
                              apply({ hoveredEmojiCodepoint: emoji.codepoint });
                            }
                          }, 250) as unknown as number;
                        }}
                        onMouseLeave={() => {
                          if (hoverScheduledRef.current === emoji.codepoint) {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = null;
                            }
                            hoverScheduledRef.current = null;
                          }
                          if (st.hoveredEmojiCodepoint === emoji.codepoint) {
                            apply({ hoveredEmojiCodepoint: null });
                          }
                        }}
                        onClick={() => {
                          if (!isLoading) handleEmojiAdd(emoji);
                        }}
                      >
                        <img
                          src={
                            isHovered
                              ? `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.gif`
                              : `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.png`
                          }
                          alt={emoji.tag}
                          loading="lazy"
                          className="h-10 w-10 object-contain transition-transform duration-200 group-hover:scale-110"
                        />
                        {isLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-950/80">
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                            <span className="text-[7px] font-bold tracking-wider text-blue-400 uppercase">
                              Importing
                            </span>
                          </div>
                        ) : (
                          <div className="pointer-events-none absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                            <i className="icon-[ri--add-line] h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {filteredEmojis.length > st.emojiVisibleCount && (
                  <div className="mt-1 flex items-center justify-center border-t border-neutral-800 pt-3">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        apply({ emojiVisibleCount: st.emojiVisibleCount + 24 })
                      }
                    >
                      <i className="icon-[ri--arrow-down-s-line] h-3.5 w-3.5" />
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {st.activeSubTab === "uploads" && (
        <div
          className="mt-3 shrink-0 border-t border-neutral-800 pt-3"
          role="status"
          aria-label="Download storage usage"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
              <i className="icon-[ri--database-2-line] h-3.5 w-3.5" />
              Storage
            </span>
            <span className="font-mono text-[9px] text-neutral-400">
              {st.storageBytes == null
                ? "Calculating…"
                : `${formatBytes(st.storageBytes)}${st.storageQuota ? ` of ${formatBytes(st.storageQuota)}` : ""} used`}
            </span>
          </div>
          {storagePercent != null && (
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(storagePercent)}
              aria-label="Downloaded storage quota usage"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          )}
          <p className="mt-1.5 text-[9px] text-neutral-600">
            {`${downloads.length} downloaded • ${localFiles.length} local files`}
          </p>
        </div>
      )}
    </div>
  );
};
