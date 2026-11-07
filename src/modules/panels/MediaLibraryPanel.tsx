import { useEffect, useReducer, useRef } from "react";
import { Button } from "../../shared/ui/Button";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import {
  processMediaFile,
  processMediaUrl,
  type MediaItem,
} from "../media/media-helper";
import { useEditorStore } from "../../store/editor-store";
import { addClipOfType } from "../dock/clip-actions";
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

const stockRequest = (url: string, params: Record<string, unknown>): Promise<any> =>
  fetch(`${url}?${new URLSearchParams(params as Record<string, string>).toString()}`).then(
    (res) => {
      if (!res.ok) throw new Error(`Stock API ${url} failed (${res.status})`);
      return res.json();
    },
  );

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  src: Record<string, string>;
}
interface PexelsVideoFile {
  width: number;
  height: number;
  link: string;
  file_type: string;
  quality?: string;
}
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
  user?: { name: string; url: string };
}
interface PixabayItem {
  id: number;
  user: string;
  duration: number;
  videos: Record<string, { url: string; width: number; height: number; thumbnail?: string }>;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  pageURL: string;
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
  pexelsQuery: string;
  pexelsVideos: PexelsVideo[];
  pexelsPhotos: PexelsPhoto[];
  pexelsMediaType: "video" | "photo";
  pexelsOrientation: string;
  pexelsDuration: string;
  pexelsCurrentPage: number;
  pexelsVisibleCount: number;
  hasMorePexels: boolean;
  showPexelsFilters: boolean;
  isSearchingPexels: boolean;
  pexelsError: string | null;
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

const createPanelState = (): PanelState => ({
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
    stockRequest("/api/pexels/search", {
      query: query.trim(),
      type: state.pexelsMediaType,
      orientation: state.pexelsOrientation === "all" ? "" : state.pexelsOrientation,
      page: state.pexelsCurrentPage,
      per_page: 50,
    })
      .then((data) => {
        const newPhotos = data.photos || [];
        const newVideos = data.videos || [];
        const newItems = stRef.current.pexelsMediaType === "photo" ? newPhotos : newVideos;
        apply({ hasMorePexels: newItems.length >= 50 });
        if (stRef.current.pexelsMediaType === "photo") {
          apply({ pexelsPhotos: stRef.current.pexelsPhotos.concat(newPhotos), pexelsVideos: [] });
        } else {
          apply({ pexelsVideos: stRef.current.pexelsVideos.concat(newVideos), pexelsPhotos: [] });
        }
        apply({ isSearchingPexels: false });
      })
      .catch((err) => {
        apply({
          pexelsError: (err as { message?: string }).message || "Failed to fetch from Pexels",
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
        if (stRef.current.pexelsDuration === "medium") return v.duration > 15 && v.duration <= 30;
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
    stockRequest("/api/pixabay/search", {
      query: query.trim(),
      type: state.pixabayMediaType,
      orientation: state.pixabayOrientation === "all" ? "" : state.pixabayOrientation,
      colors: state.pixabayMediaType !== "video" && state.pixabayTransparentOnly ? "transparent" : "",
      page: state.pixabayCurrentPage,
      per_page: 55,
    })
      .then((data) => {
        const hits = data.hits || [];
        apply({ hasMorePixabay: hits.length >= 55 });
        apply({ pixabayItems: stRef.current.pixabayItems.concat(hits), isSearchingPixabay: false });
      })
      .catch((err) => {
        apply({
          pixabayError: (err as { message?: string }).message || "Failed to fetch from Pixabay",
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
        currentEffect: "random",
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
    processMediaUrl(asset.url, asset.type, asset.name, asset.source || "stock", (processed) => {
      (processed as MediaItem).id = asset.id;
      useEditorStore.setState((s) => ({ mediaPool: [...s.mediaPool, processed] }));
      apply({ loadingAssetId: null });
      addAssetToTimeline(processed, asType);
      forceUpdate();
    });
  };

  const handlePexelsAdd = (media: PexelsPhoto | PexelsVideo, asType: string) => {
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
        files.find((f) => f.width >= 960 && f.width <= 1280 && f.file_type === "video/mp4") ||
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
      const bestVid = videos.medium || videos.small || videos.large || videos.tiny || ({} as PixabayItem["videos"][string]);
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
          useEditorStore.setState((s) => ({ mediaPool: [...s.mediaPool, asset] }));
          apply({ activeUploadsCount: stRef.current.activeUploadsCount - 1 });
          if (stRef.current.activeUploadsCount === 0) apply({ totalUploadsCount: 0 });
          forceUpdate();
        });
      });
    };
    input.click();
  };

  useEffect(() => {
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
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = stRef.current;
  useEditorStore((s) => s.selectedClipId);
  const uploads = useEditorStore((s) => s.mediaPool).filter(
    (m) =>
      (m.source === "upload" || m.source === "pexels" || m.source === "pixabay") &&
      m.type !== "audio",
  );

  const emojis = emojisData as { categories: Array<{ id: string; items: EmojiItem[] }> };
  let filteredEmojis: EmojiItem[] = [];
  {
    const cats = emojis.categories || [];
    if (st.emojiCategory === "all") {
      filteredEmojis = cats.flatMap((cat) => cat.items || []);
    } else {
      filteredEmojis = (cats.find((c) => c.id === st.emojiCategory)?.items || []).slice();
    }
    if (st.emojiQuery.trim()) {
      const q = st.emojiQuery.toLowerCase().trim();
      filteredEmojis = filteredEmojis.filter((em) => em.tag.toLowerCase().includes(q));
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
      if (st.pexelsDuration === "medium") return v.duration > 15 && v.duration <= 30;
      if (st.pexelsDuration === "long") return v.duration > 30;
      return true;
    });
  }
  const visiblePexels = pexelsItems.slice(0, st.pexelsVisibleCount);
  const visiblePixabay = st.pixabayItems.slice(0, st.pixabayVisibleCount);
  const isVideoPixabay = st.pixabayMediaType === "video";

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
              <SectionTitle className="">
                Uploaded &amp; Imported
            </SectionTitle>
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
                  Processing media ({st.totalUploadsCount - st.activeUploadsCount}/
                  {st.totalUploadsCount})...
                </span>
              </div>
            )}

            {uploads.length === 0 && st.activeUploadsCount === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-8 text-center">
                <i className="icon-[ri--folder-upload-line] h-8 w-8 text-neutral-700" />
                <p className="text-xs font-medium text-neutral-500">
                  No uploaded or imported assets yet.
                </p>
              </div>
            )}

            {uploads.length > 0 && (
              <div className="grid grid-cols-2 items-start gap-3">
                {uploads.map((asset: MediaItem) => {
                  const width = asset.width || (asset.type === "video" ? 16 : 1);
                  const height = asset.height || (asset.type === "video" ? 9 : 1);
                  return (
                    <div
                      key={asset.id}
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
                      {asset.type === "video" && (
                        <span className="absolute top-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-neutral-300">
                          {`${Math.round(asset.duration)}s`}
                        </span>
                      )}
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
                        <button
                          title="Add as Background"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-500"
                          onClick={() => addAssetToTimeline(asset, "background")}
                        >
                          <i className="icon-[ri--image-line] h-4 w-4" />
                        </button>
                        <button
                          title="Add as Overlay"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-200 shadow-lg transition-all hover:scale-110 hover:bg-neutral-700"
                          onClick={() => addAssetToTimeline(asset, "overlay")}
                        >
                          <i className="icon-[ri--image-add-line] h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {st.activeSubTab === "pixabay" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${st.pixabayMediaType}s on Pixabay...`}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 pl-8 text-[11px] text-neutral-300 outline-none focus:border-blue-500/50"
                  value={st.pixabayQuery || ""}
                  onChange={(e) => apply({ pixabayQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPixabay(st.pixabayQuery);
                    }
                  }}
                />
                <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-neutral-500" />
              </div>
              <button
                title="Toggle Filters"
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-all ${st.showPixabayFilters ? "border-blue-500/30 bg-blue-600/20 text-blue-400" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
                onClick={() => apply({ showPixabayFilters: !st.showPixabayFilters })}
              >
                <i className="icon-[ri--filter-3-line] h-3.5 w-3.5" />
              </button>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent bg-blue-600 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500"
                onClick={() => searchPixabay(st.pixabayQuery)}
              >
                <i className="icon-[ri--search-2-line] h-3 w-3" />
                Search
              </button>
            </div>

            {st.showPixabayFilters && (
              <div className="animate-tab-fade-in mt-1.5 mb-1.5 space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
                    Type
                  </span>
                  <div className="border-neutral-850 scrollbar-none flex overflow-x-auto rounded-lg border bg-neutral-950 p-0.5">
                    {(
                      [
                        ["video", "Video"],
                        ["photo", "Photo"],
                        ["illustration", "Illust"],
                        ["vector", "Vector"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${st.pixabayMediaType === val ? "bg-blue-600 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                        onClick={() => {
                          apply({ pixabayMediaType: val });
                          searchPixabay(st.pixabayQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
                    Orientation
                  </span>
                  <div className="border-neutral-850 flex rounded-lg border bg-neutral-950 p-0.5">
                    {(
                      [
                        ["all", "Any"],
                        ["landscape", "Horiz"],
                        ["portrait", "Vert"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        className={`cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${st.pixabayOrientation === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-neutral-500 hover:text-neutral-300"}`}
                        onClick={() => {
                          apply({ pixabayOrientation: val });
                          searchPixabay(st.pixabayQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
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
                        apply({ pixabayTransparentOnly: !st.pixabayTransparentOnly });
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
              <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs font-medium text-neutral-400">Searching Pixabay...</span>
              </div>
            )}

            {st.pixabayError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 p-4">
                <i className="mt-0.5 icon-[ri--error-warning-line] h-4.5 w-4.5 text-red-500" />
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-red-400 uppercase">
                    Search Error
                  </p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-red-300/80">
                    {st.pixabayError}
                  </p>
                </div>
              </div>
            )}

            {(!st.isSearchingPixabay || st.pixabayItems.length > 0) && !st.pixabayError && (
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
                          const bestVid = videos.small || videos.tiny || videos.medium || ({} as PixabayItem["videos"][string]);
                          thumbnail = bestVid.thumbnail || "";
                          width = bestVid.width || 16;
                          height = bestVid.height || 9;
                        } else {
                          thumbnail = item.previewURL || item.webformatURL || "";
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
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    title="Add as Background"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-500"
                                    onClick={() => handlePixabayAdd(item, "background")}
                                  >
                                    <i className="icon-[ri--image-line] h-4 w-4" />
                                  </button>
                                  <button
                                    title="Add as Overlay"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-200 shadow-lg transition-all hover:scale-110 hover:bg-neutral-700"
                                    onClick={() => handlePixabayAdd(item, "overlay")}
                                  >
                                    <i className="icon-[ri--image-add-line] h-4 w-4" />
                                  </button>
                                </div>
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
                    {(st.hasMorePixabay || st.pixabayItems.length > st.pixabayVisibleCount) && (
                      <div className="mt-4 flex items-center justify-center border-t border-neutral-800 pt-4">
                        <Button
                          variant="ghost"
                          disabled={st.isSearchingPixabay}
                          onClick={loadMorePixabay}
                        >
                          {st.isSearchingPixabay ? (
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
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {st.activeSubTab === "pexels" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${st.pexelsMediaType}s on Pexels...`}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 pl-8 text-[11px] text-neutral-300 outline-none focus:border-blue-500/50"
                  value={st.pexelsQuery || ""}
                  onChange={(e) => apply({ pexelsQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPexels(st.pexelsQuery);
                    }
                  }}
                />
                <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-neutral-500" />
              </div>
              <button
                title="Toggle Filters"
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-all ${st.showPexelsFilters ? "border-blue-500/30 bg-blue-600/20 text-blue-400" : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
                onClick={() => apply({ showPexelsFilters: !st.showPexelsFilters })}
              >
                <i className="icon-[ri--filter-3-line] h-3.5 w-3.5" />
              </button>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent bg-blue-600 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500"
                onClick={() => searchPexels(st.pexelsQuery)}
              >
                <i className="icon-[ri--search-2-line] h-3 w-3" />
                Search
              </button>
            </div>

            {st.showPexelsFilters && (
              <div className="animate-tab-fade-in mt-1.5 mb-1.5 space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
                    Type
                  </span>
                  <div className="border-neutral-850 flex rounded-lg border bg-neutral-950 p-0.5">
                    <button
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${st.pexelsMediaType === "video" ? "bg-blue-600 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                      onClick={() => {
                        apply({ pexelsMediaType: "video" });
                        searchPexels(st.pexelsQuery);
                      }}
                    >
                      Video
                    </button>
                    <button
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${st.pexelsMediaType === "photo" ? "bg-blue-600 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                      onClick={() => {
                        apply({ pexelsMediaType: "photo" });
                        searchPexels(st.pexelsQuery);
                      }}
                    >
                      Photo
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
                    Orientation
                  </span>
                  <div className="border-neutral-850 flex rounded-lg border bg-neutral-950 p-0.5">
                    {(
                      [
                        ["all", "Any"],
                        ["landscape", "Horiz"],
                        ["portrait", "Vert"],
                        ["square", "Sq"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        className={`cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${st.pexelsOrientation === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-neutral-500 hover:text-neutral-300"}`}
                        onClick={() => {
                          apply({ pexelsOrientation: val });
                          searchPexels(st.pexelsQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {st.pexelsMediaType === "video" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">
                      Duration
                    </span>
                    <div className="border-neutral-850 flex rounded-lg border bg-neutral-950 p-0.5">
                      {(
                        [
                          ["all", "Any"],
                          ["short", "< 15s"],
                          ["medium", "15-30s"],
                          ["long", "> 30s"],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          className={`cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${st.pexelsDuration === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-neutral-500 hover:text-neutral-300"}`}
                          onClick={() => apply({ pexelsDuration: val })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {st.isSearchingPexels && st.pexelsPhotos.length === 0 && st.pexelsVideos.length === 0 && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-700/50 bg-neutral-800/30 p-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs font-medium text-neutral-400">{`Searching Pexels ${st.pexelsMediaType}s...`}</span>
              </div>
            )}

            {st.pexelsError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 p-4">
                <i className="mt-0.5 icon-[ri--error-warning-line] h-4.5 w-4.5 text-red-500" />
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-red-400 uppercase">
                    Search Error
                  </p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-red-300/80">
                    {st.pexelsError}
                  </p>
                </div>
              </div>
            )}

            {(pexelsItems.length > 0 || !st.isSearchingPexels) && !st.pexelsError && (
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
                        const assetId = isVideoPexels ? `pexels-${item.id}` : `pexels-photo-${item.id}`;
                        const isLoading = st.loadingAssetId === assetId;
                        const thumbnail = isVideoPexels
                          ? (item as PexelsVideo).image
                          : (item as PexelsPhoto).src.medium || (item as PexelsPhoto).src.small;
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
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    title="Add as Background"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-500"
                                    onClick={() => handlePexelsAdd(item, "background")}
                                  >
                                    <i className="icon-[ri--image-line] h-4 w-4" />
                                  </button>
                                  <button
                                    title="Add as Overlay"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-200 shadow-lg transition-all hover:scale-110 hover:bg-neutral-700"
                                    onClick={() => handlePexelsAdd(item, "overlay")}
                                  >
                                    <i className="icon-[ri--image-add-line] h-4 w-4" />
                                  </button>
                                </div>
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
                    {(st.hasMorePexels || pexelsItems.length > st.pexelsVisibleCount) && (
                      <div className="mt-4 flex items-center justify-center border-t border-neutral-800 pt-4">
                        <Button
                          variant="ghost"
                          disabled={st.isSearchingPexels}
                          onClick={loadMorePexels}
                        >
                          {st.isSearchingPexels ? (
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
                    )}
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
                  onChange={(e) => apply({ emojiQuery: e.target.value, emojiVisibleCount: 24 })}
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
                    onClick={() => apply({ emojiCategory: cat.id, emojiVisibleCount: 24 })}
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
                    const isLoading = st.loadingAssetId === `emoji-${emoji.codepoint}`;
                    const isHovered = st.hoveredEmojiCodepoint === emoji.codepoint;
                    return (
                      <div
                        key={emoji.codepoint}
                        className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40 p-2.5 transition-all hover:border-blue-500/50 hover:bg-neutral-900/50"
                        onMouseEnter={() => {
                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
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
                      onClick={() => apply({ emojiVisibleCount: st.emojiVisibleCount + 24 })}
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
    </div>
  );
};
