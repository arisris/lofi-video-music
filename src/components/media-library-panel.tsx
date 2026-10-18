import { useEffect, useReducer, useRef } from "react";
import { addClipToTimeline } from "../lib/clip-factory";
import { processMediaFile, processMediaUrl } from "../lib/media-helper";
import { cloneVids } from "../utils/helpers";
import { editorStore, useEditorStore } from "../store/editor-store";

type SubTab = "uploads" | "pixabay" | "pexels" | "emoji";

/**
 * Panel-local state lives in a single ref-managed object (legacy Mithril
 * component properties). Mutations go through `apply`, which bumps a
 * force-update counter — the React equivalent of the old `m.redraw()`.
 */
interface PanelState {
  activeSubTab: SubTab;
  activeUploadsCount: number;
  totalUploadsCount: number;
  loadingAssetId: string | null;

  // Pexels integration states
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

  // Emoji integration states
  emojisData: any;
  emojiQuery: string;
  emojiCategory: string;
  emojiVisibleCount: number;
  hoveredEmojiCodepoint: string | null;

  // Pixabay integration states
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

/** Closest parity with the legacy defaults. */
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

const stockRequest = (url: string, params: Record<string, unknown>): Promise<any> =>
  fetch(`${url}?${new URLSearchParams(params as Record<string, string>).toString()}`).then((res) => {
    if (!res.ok) {
      throw new Error(`Stock API ${url} failed (${res.status})`);
    }
    return res.json();
  });

/** Sub-tab strip shown above the library content. */
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

/** Media library: uploads manager plus Pexels/Pixabay/Emoji import flows. */
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
    if (tabId === "pexels" && stRef.current.pexelsVideos.length === 0 && stRef.current.pexelsPhotos.length === 0 && !stRef.current.isSearchingPexels) {
      searchPexels(stRef.current.pexelsQuery);
    }
    if (tabId === "pixabay" && stRef.current.pixabayItems.length === 0 && !stRef.current.isSearchingPixabay) {
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
        ...(stRef.current.pexelsMediaType === "photo" ? { pexelsPhotos: [] } : { pexelsVideos: [] }),
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

        if (newItems.length < 50) {
          apply({ hasMorePexels: false });
        } else {
          apply({ hasMorePexels: true });
        }

        if (stRef.current.pexelsMediaType === "photo") {
          apply({ pexelsPhotos: stRef.current.pexelsPhotos.concat(newPhotos), pexelsVideos: [] });
        } else {
          apply({ pexelsVideos: stRef.current.pexelsVideos.concat(newVideos), pexelsPhotos: [] });
        }
        apply({ isSearchingPexels: false });
      })
      .catch((err) => {
        console.error("Pexels search failed:", err);
        apply({
          pexelsError:
            (err as { message?: string }).message ||
            `Failed to fetch ${stRef.current.pexelsMediaType}s from Pexels`,
          isSearchingPexels: false,
        });
      });
  };

  const loadMorePexels = () => {
    apply({ pexelsVisibleCount: stRef.current.pexelsVisibleCount + 10 });

    const isVideoMode = stRef.current.pexelsMediaType === "video";
    const source = isVideoMode ? stRef.current.pexelsVideos : stRef.current.pexelsPhotos;
    let items = source;

    if (isVideoMode && stRef.current.pexelsDuration !== "all") {
      items = items.filter((video) => {
        if (stRef.current.pexelsDuration === "short") return video.duration <= 15;
        if (stRef.current.pexelsDuration === "medium") return video.duration > 15 && video.duration <= 30;
        if (stRef.current.pexelsDuration === "long") return video.duration > 30;
        return true;
      });
    }

    if (stRef.current.pexelsVisibleCount >= items.length && !stRef.current.isSearchingPexels && stRef.current.hasMorePexels) {
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
        if (hits.length < 55) {
          apply({ hasMorePixabay: false });
        } else {
          apply({ hasMorePixabay: true });
        }

        apply({ pixabayItems: stRef.current.pixabayItems.concat(hits), isSearchingPixabay: false });
      })
      .catch((err) => {
        console.error("Pixabay search failed:", err);
        apply({
          pixabayError: (err as { message?: string }).message || `Failed to fetch from Pixabay`,
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

  const addAssetToTimeline = (asset: any, asType: string) => {
    if (asType === "background") {
      addClipToTimeline("background", {
        bgType: asset.type,
        bgElement: asset.element,
        bgElements: asset.type === "video" ? cloneVids(asset.elements as never) : null,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        currentEffect: "random",
      });
    } else {
      addClipToTimeline("overlay", {
        mediaType: asset.type,
        mediaElement: asset.element,
        mediaElements: asset.type === "video" ? cloneVids(asset.elements as never) : null,
        gifFrames: asset.gifFrames,
        gifDuration: asset.gifDuration,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        loop: true,
        opacity: 1.0,
      });
    }
  };

  const handleAssetAdd = (asset: any, asType: string) => {
    // If it's already in the media pool, add immediately
    const existing = (editorStore.getState().mediaPool as any[]).find((m) => m.id === asset.id || m.url === asset.url);
    if (existing) {
      addAssetToTimeline(existing, asType);
      return;
    }

    // Otherwise load and process the stock media URL
    apply({ loadingAssetId: asset.id });

    processMediaUrl(asset.url, asset.type, asset.name, asset.source || "stock", (processedAsset: any) => {
      processedAsset.id = asset.id;
      editorStore.setState({ mediaPool: [...editorStore.getState().mediaPool, processedAsset] });
      apply({ loadingAssetId: null });
      addAssetToTimeline(processedAsset, asType);
      forceUpdate();
    });
  };

  const handlePexelsAdd = (media: any, asType: string) => {
    if (stRef.current.pexelsMediaType === "photo") {
      const asset = {
        id: `pexels-photo-${media.id}`,
        name: `Pexels - ${media.photographer || "Photo"}`,
        type: "image",
        source: "pexels",
        url: media.src.large || media.src.original,
        thumbnail: media.src.medium || media.src.small,
        duration: 0,
        width: media.width,
        height: media.height,
      };
      handleAssetAdd(asset, asType);
    } else {
      const files = media.video_files || [];
      // Select standard HD resolution for optimal rendering speed
      let bestFile = files.find((f: any) => f.width >= 960 && f.width <= 1280 && f.file_type === "video/mp4");
      if (!bestFile) bestFile = files.find((f: any) => f.quality === "sd" && f.file_type === "video/mp4");
      if (!bestFile) bestFile = files.find((f: any) => f.file_type === "video/mp4");
      if (!bestFile) bestFile = files[0];

      if (!bestFile || !bestFile.link) {
        console.error("No playable video file found for Pexels ID:", media.id);
        return;
      }

      const asset = {
        id: `pexels-${media.id}`,
        name: `Pexels - ${media.user?.name || "Video"}`,
        type: "video",
        source: "pexels",
        url: bestFile.link,
        thumbnail: media.image,
        duration: media.duration,
        width: media.width,
        height: media.height,
      };

      handleAssetAdd(asset, asType);
    }
  };

  const handlePixabayAdd = (item: any, asType: string) => {
    if (stRef.current.pixabayMediaType === "video") {
      const videos = item.videos || {};
      const bestVid = videos.medium || videos.small || videos.large || videos.tiny || {};
      const asset = {
        id: `pixabay-video-${item.id}`,
        name: `Pixabay - ${item.user || "Video"}`,
        type: "video",
        source: "pixabay",
        url: bestVid.url,
        thumbnail: bestVid.thumbnail || (videos.tiny && videos.tiny.thumbnail) || "",
        duration: item.duration,
        width: bestVid.width || 1280,
        height: bestVid.height || 720,
      };
      handleAssetAdd(asset, asType);
    } else {
      const asset = {
        id: `pixabay-image-${item.id}`,
        name: `Pixabay - ${item.user || "Image"}`,
        type: "image",
        source: "pixabay",
        url: item.largeImageURL || item.webformatURL,
        thumbnail: item.previewURL || item.webformatURL,
        duration: 0,
        width: item.imageWidth || 1920,
        height: item.imageHeight || 1080,
      };
      handleAssetAdd(asset, asType);
    }
  };

  const handleEmojiAdd = (emoji: any) => {
    const asset = {
      id: `emoji-${emoji.codepoint}`,
      name: `Emoji - ${emoji.tag}`,
      type: "image",
      source: "emoji",
      url: `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.gif`,
      thumbnail: `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.webp`,
      duration: 0,
      width: 512,
      height: 512,
    };
    handleAssetAdd(asset, "overlay");
  };

  const triggerUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length === 0) return;

      apply({ activeUploadsCount: stRef.current.activeUploadsCount + files.length, totalUploadsCount: stRef.current.totalUploadsCount + files.length });

      files.forEach((file) => {
        processMediaFile(file, (asset: any) => {
          editorStore.setState({ mediaPool: [...editorStore.getState().mediaPool, asset] });
          apply({ activeUploadsCount: stRef.current.activeUploadsCount - 1 });
          if (stRef.current.activeUploadsCount === 0) {
            apply({ totalUploadsCount: 0 });
          }
          forceUpdate();
        });
      });
    };
    input.click();
  };

  // Restore persisted panel state and lazy-load module data (legacy oninit).
  useEffect(() => {
    const state = editorStore.getState() as unknown as Record<string, Partial<PanelState>>;
    const restored: Partial<PanelState> = {
      ...(state.pexelsPanelState ?? {}),
      ...(state.emojiPanelState ?? {}),
      ...(state.pixabayPanelState ?? {}),
    };
    // Keep non-persisted hooks out of the merge (no cross-contamination).
    delete (restored as { emojisData?: unknown }).emojisData;
    delete (restored as { hoveredEmojiCodepoint?: unknown }).hoveredEmojiCodepoint;
    Object.assign(stRef.current, restored);

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

    if (!stRef.current.emojisData) {
      import("../data/animated-emojis.json")
        .then((module) => {
          apply({ emojisData: (module as { default: any }).default });
        })
        .catch((err) => {
          console.error("Failed to load animated emojis:", err);
        });
    }

    return () => {
      // Persist sub-tab + search state across HMR/route switches (legacy onremove).
      const s = stRef.current;
      editorStore.setState({
        pexelsPanelState: {
          activeSubTab: s.activeSubTab,
          activeUploadsCount: s.activeUploadsCount,
          totalUploadsCount: s.totalUploadsCount,
          loadingAssetId: s.loadingAssetId,
          pexelsQuery: s.pexelsQuery,
          pexelsVideos: s.pexelsVideos,
          pexelsPhotos: s.pexelsPhotos,
          pexelsMediaType: s.pexelsMediaType,
          pexelsOrientation: s.pexelsOrientation,
          pexelsDuration: s.pexelsDuration,
          pexelsCurrentPage: s.pexelsCurrentPage,
          pexelsVisibleCount: s.pexelsVisibleCount,
          hasMorePexels: s.hasMorePexels,
          showPexelsFilters: s.showPexelsFilters,
          isSearchingPexels: s.isSearchingPexels,
          pexelsError: s.pexelsError,
        } as never,
        emojiPanelState: {
          emojiQuery: s.emojiQuery,
          emojiCategory: s.emojiCategory,
          emojiVisibleCount: s.emojiVisibleCount,
        } as never,
        pixabayPanelState: {
          pixabayQuery: s.pixabayQuery,
          pixabayMediaType: s.pixabayMediaType,
          pixabayOrientation: s.pixabayOrientation,
          pixabayTransparentOnly: s.pixabayTransparentOnly,
          pixabayItems: s.pixabayItems,
          pixabayVisibleCount: s.pixabayVisibleCount,
         pixabayCurrentPage: s.pixabayCurrentPage,
          hasMorePixabay: s.hasMorePixabay,
          isSearchingPixabay: s.isSearchingPixabay,
          pixabayError: s.pixabayError,
          showPixabayFilters: s.showPixabayFilters,
        } as never,
      });
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Legacy redraw is replaced by forceUpdate; the media-pool assets list only
  // refreshes when a new clip/asset is selected, which triggers a re-render.
  const st = stRef.current;
  // Re-render when clips/selections change through addClipToTimeline's
  // top-level store writes (pushes to mediaPool are in-place, unobserved).
  useEditorStore((s) => s.selectedClipId);
  const uploads = (editorStore.getState().mediaPool as any[]).filter(
    (m) => m.source === "upload" || m.source === "pexels" || m.source === "pixabay"
  );

  return (
    <div className="bg-slate-900/50 p-4 flex flex-col h-full w-full overflow-hidden">
      {/* Sub-Tabs Header - Distributed and compact */}
      <div className="flex border-b border-slate-800 mb-4 pb-1.5 gap-1">
        {SUB_TABS.map((tab) => {
          const isActive = st.activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              title={tab.label}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-tight transition-all cursor-pointer ${isActive ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 border border-transparent hover:text-slate-300 hover:bg-slate-800/30"}`}
              onClick={() => selectSubTab(tab.id)}
            >
              <i className={`${tab.icon} w-3.5 h-3.5`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {/* 1. UPLOADS TAB */}
        {st.activeSubTab === "uploads" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uploaded &amp; Imported</h3>
              <button
                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1"
                onClick={triggerUpload}
              >
                <i className="icon-[ri--upload-2-fill] w-3 h-3" />
                Upload
              </button>
            </div>

            {st.activeUploadsCount > 0 && (
              <div className="p-3 bg-blue-950/10 border border-blue-900/20 rounded-xl flex items-center justify-center gap-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                <span className="text-[10px] text-blue-400 font-semibold">
                  Processing media ({st.totalUploadsCount - st.activeUploadsCount}/{st.totalUploadsCount})...
                </span>
              </div>
            )}

            {uploads.length === 0 && st.activeUploadsCount === 0 && (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                <i className="icon-[ri--folder-upload-line] w-8 h-8 text-slate-700" />
                <p className="text-xs text-slate-500 font-medium">No uploaded or imported assets yet.</p>
              </div>
            )}

            {uploads.length > 0 && (
              <div className="grid grid-cols-2 gap-3 items-start">
                {uploads.map((asset) => {
                  const width = asset.width || (asset.type === "video" ? 16 : 1);
                  const height = asset.height || (asset.type === "video" ? 9 : 1);
                  return (
                    <div
                      key={asset.id}
                      className="relative group rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between"
                      style={{ aspectRatio: `${width} / ${height}` }}
                    >
                      {/* Media Thumbnail Preview */}
                      {asset.thumbnail ? (
                        <img
                          src={asset.thumbnail}
                          className="w-full h-full object-cover absolute inset-0 opacity-70 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900">
                          <i
                            className={
                              asset.type === "video"
                                ? "icon-[ri--film-line] w-6 h-6 text-slate-700"
                                : "icon-[ri--image-line] w-6 h-6 text-slate-700"
                            }
                          />
                        </div>
                      )}

                      {/* Video Duration Badge */}
                      {asset.type === "video" && (
                        <span className="absolute right-2 top-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-slate-300 z-10 font-mono">
                          {`${Math.round(asset.duration)}s`}
                        </span>
                      )}

                      {/* Video Play Icon Indicator */}
                      {asset.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-10">
                          <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                            <i className="icon-[ri--play-fill] w-4.5 h-4.5 text-slate-200" />
                          </div>
                        </div>
                      )}

                      {/* Asset details */}
                      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end min-h-[40px] pointer-events-none">
                        <span className="text-[9px] font-bold text-slate-200 truncate pr-1">{asset.name}</span>
                      </div>

                      {/* Action Overlays */}
                      <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          title="Add as Background"
                          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer"
                          onClick={() => addAssetToTimeline(asset, "background")}
                        >
                          <i className="icon-[ri--image-line] w-4 h-4" />
                        </button>
                        <button
                          title="Add as Overlay"
                          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer"
                          onClick={() => addAssetToTimeline(asset, "overlay")}
                        >
                          <i className="icon-[ri--image-add-line] w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. PIXABAY TAB - DYNAMIC STOCK SEARCH */}
        {st.activeSubTab === "pixabay" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${st.pixabayMediaType}s on Pixabay...`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50"
                  value={st.pixabayQuery || ""}
                  onChange={(e) => apply({ pixabayQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPixabay(st.pixabayQuery);
                    }
                  }}
                />
                <i className="icon-[ri--search-line] absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <button
                title="Toggle Filters"
                className={`p-1.5 border rounded-lg cursor-pointer transition-all flex items-center justify-center ${st.showPixabayFilters ? "bg-blue-600/20 border-blue-500/30 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}
                onClick={() => apply({ showPixabayFilters: !st.showPixabayFilters })}
              >
                <i className="icon-[ri--filter-3-line] w-3.5 h-3.5" />
              </button>
              <button
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-transparent rounded-lg text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1"
                onClick={() => searchPixabay(st.pixabayQuery)}
              >
                <i className="icon-[ri--search-2-line] w-3 h-3" />
                Search
              </button>
            </div>

            {/* Filters Drawer */}
            {st.showPixabayFilters && (
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3 mt-1.5 mb-1.5 animate-tab-fade-in">
                {/* Media Type Selection */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Type</span>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 overflow-x-auto scrollbar-none">
                    {([
                      ["video", "Video"],
                      ["photo", "Photo"],
                      ["illustration", "Illust"],
                      ["vector", "Vector"],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${st.pixabayMediaType === val ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                        onClick={() => {
                          apply({ pixabayMediaType: val });
                          searchPixabay(stRef.current.pixabayQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Orientation</span>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                    {([
                      ["all", "Any"],
                      ["landscape", "Horiz"],
                      ["portrait", "Vert"],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        className={`px-1.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${st.pixabayOrientation === val ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
                        onClick={() => {
                          apply({ pixabayOrientation: val });
                          searchPixabay(stRef.current.pixabayQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transparent Background Toggle (Image types only) */}
                {st.pixabayMediaType !== "video" && (
                  <div className="flex items-center justify-between p-1 bg-slate-950/40 border border-slate-855 rounded-lg">
                    <div className="flex flex-col pl-1">
                      <span className="text-[9px] font-bold text-slate-300">Transparent BG (Stickers)</span>
                      <span className="text-[8px] text-slate-500">Filters transparent PNG elements</span>
                    </div>
                    <button
                      className={`w-8 h-4 rounded-full relative transition-colors ${st.pixabayTransparentOnly ? "bg-blue-600" : "bg-slate-850"}`}
                      onClick={() => {
                        apply({ pixabayTransparentOnly: !st.pixabayTransparentOnly });
                        searchPixabay(stRef.current.pixabayQuery);
                      }}
                    >
                      <div
                        className={`absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${st.pixabayTransparentOnly ? "right-0.5" : "left-0.5"}`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}

            {st.isSearchingPixabay && st.pixabayItems.length === 0 && (
              <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs text-slate-400 font-medium">Searching Pixabay...</span>
              </div>
            )}

            {st.pixabayError && (
              <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-2.5">
                <i className="icon-[ri--error-warning-line] text-red-500 w-4.5 h-4.5 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Search Error</p>
                  <p className="text-[9px] text-red-300/80 leading-relaxed mt-0.5">{st.pixabayError}</p>
                </div>
              </div>
            )}

            {(!st.isSearchingPixabay || st.pixabayItems.length > 0) && !st.pixabayError && (() => {
              const items = st.pixabayItems;
              if (!items || items.length === 0) {
                return (
                  <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                    <i className="icon-[ri--image-line] w-8 h-8 text-slate-700" />
                    <p className="text-xs text-slate-500 font-medium">{`No items found on Pixabay for "${st.pixabayQuery}".`}</p>
                  </div>
                );
              }

              const visibleItems = items.slice(0, st.pixabayVisibleCount);
              const isVideoMode = st.pixabayMediaType === "video";

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 items-start">
                    {visibleItems.map((item) => {
                      const assetId = isVideoMode ? `pixabay-video-${item.id}` : `pixabay-image-${item.id}`;
                      const isLoading = st.loadingAssetId === assetId;

                      // Extract preview thumbnail
                      let thumbnail = "";
                      let width = 1;
                      let height = 1;

                      if (isVideoMode) {
                        const videos = item.videos || {};
                        const bestVid = videos.small || videos.tiny || videos.medium || {};
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
                          className="relative group rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between"
                          style={{ aspectRatio: `${width} / ${height}` }}
                        >
                          {/* Thumbnail Preview */}
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              className="w-full h-full object-cover absolute inset-0 opacity-70 group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900">
                              <i
                                className={isVideoMode ? "icon-[ri--film-line] w-6 h-6 text-slate-700" : "icon-[ri--image-line] w-6 h-6 text-slate-700"}
                              />
                            </div>
                          )}

                          {/* Video Duration Badge */}
                          {isVideoMode && (
                            <span className="absolute right-2 top-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-slate-300 z-10 font-mono">
                              {`${Math.round(item.duration)}s`}
                            </span>
                          )}

                          {/* Video Play Icon */}
                          {isVideoMode && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-10">
                              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <i className="icon-[ri--play-fill] w-4.5 h-4.5 text-slate-200" />
                              </div>
                            </div>
                          )}

                          {/* Author info */}
                          <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end min-h-[40px] pointer-events-none">
                            <span className="text-[9px] font-bold text-slate-200 truncate pr-1">{`By ${item.user || "Pixabay"}`}</span>
                          </div>

                          {/* Loading Spinner Overlay */}
                          {isLoading ? (
                            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1.5">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Importing...</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  title="Add as Background"
                                  className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer"
                                  onClick={() => handlePixabayAdd(item, "background")}
                                >
                                  <i className="icon-[ri--image-line] w-4 h-4" />
                                </button>
                                <button
                                  title="Add as Overlay"
                                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer"
                                  onClick={() => handlePixabayAdd(item, "overlay")}
                                >
                                  <i className="icon-[ri--image-add-line] w-4 h-4" />
                                </button>
                              </div>
                              <a
                                href={item.pageURL || "https://pixabay.com"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-slate-400 hover:text-blue-400 font-semibold transition-colors flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full pointer-events-auto cursor-pointer"
                              >
                                <i className="icon-[ri--external-link-line] w-2.5 h-2.5" />
                                View on Pixabay
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Load More Button */}
                  {(st.hasMorePixabay || items.length > st.pixabayVisibleCount) && (
                    <div className="flex items-center justify-center border-t border-slate-800 pt-4 mt-4">
                      <button
                        className="w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                        disabled={st.isSearchingPixabay}
                        onClick={loadMorePixabay}
                      >
                        {st.isSearchingPixabay ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" />
                            Loading More...
                          </>
                        ) : (
                          <>
                            <i className="icon-[ri--arrow-down-s-line] w-3.5 h-3.5" />
                            Load More
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* 3. PEXELS TAB */}
        {st.activeSubTab === "pexels" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${st.pexelsMediaType}s on Pexels...`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50"
                  value={st.pexelsQuery || ""}
                  onChange={(e) => apply({ pexelsQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPexels(st.pexelsQuery);
                    }
                  }}
                />
                <i className="icon-[ri--search-line] absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <button
                title="Toggle Filters"
                className={`p-1.5 border rounded-lg cursor-pointer transition-all flex items-center justify-center ${st.showPexelsFilters ? "bg-blue-600/20 border-blue-500/30 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}
                onClick={() => apply({ showPexelsFilters: !st.showPexelsFilters })}
              >
                <i className="icon-[ri--filter-3-line] w-3.5 h-3.5" />
              </button>
              <button
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-transparent rounded-lg text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1"
                onClick={() => searchPexels(st.pexelsQuery)}
              >
                <i className="icon-[ri--search-2-line] w-3 h-3" />
                Search
              </button>
            </div>

            {/* Filters Drawer */}
            {st.showPexelsFilters && (
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3 mt-1.5 mb-1.5 animate-tab-fade-in">
                {/* Media Type */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Type</span>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                    <button
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${st.pexelsMediaType === "video" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                      onClick={() => {
                        apply({ pexelsMediaType: "video" });
                        searchPexels(stRef.current.pexelsQuery);
                      }}
                    >
                      Video
                    </button>
                    <button
                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${st.pexelsMediaType === "photo" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                      onClick={() => {
                        apply({ pexelsMediaType: "photo" });
                        searchPexels(stRef.current.pexelsQuery);
                      }}
                    >
                      Photo
                    </button>
                  </div>
                </div>

                {/* Orientation */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Orientation</span>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                    {([
                      ["all", "Any"],
                      ["landscape", "Horiz"],
                      ["portrait", "Vert"],
                      ["square", "Sq"],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        className={`px-1.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${st.pexelsOrientation === val ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
                        onClick={() => {
                          apply({ pexelsOrientation: val });
                          searchPexels(stRef.current.pexelsQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration (for Video only) */}
                {st.pexelsMediaType === "video" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Duration</span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                      {([
                        ["all", "Any"],
                        ["short", "< 15s"],
                        ["medium", "15-30s"],
                        ["long", "> 30s"],
                      ] as const).map(([val, label]) => (
                        <button
                          key={val}
                          className={`px-1.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${st.pexelsDuration === val ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-300 border border-transparent"}`}
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
              <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs text-slate-400 font-medium">{`Searching Pexels ${st.pexelsMediaType}s...`}</span>
              </div>
            )}

            {st.pexelsError && (
              <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-2.5">
                <i className="icon-[ri--error-warning-line] text-red-500 w-4.5 h-4.5 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Search Error</p>
                  <p className="text-[9px] text-red-300/80 leading-relaxed mt-0.5">{st.pexelsError}</p>
                </div>
              </div>
            )}

            {/* Client-side filtering of videos based on duration */}
            {(st.pexelsPhotos.length > 0 || st.pexelsVideos.length > 0 || !st.isSearchingPexels) && !st.pexelsError && (() => {
              const isVideoMode = st.pexelsMediaType === "video";
              let items = isVideoMode ? st.pexelsVideos : st.pexelsPhotos;

              if (isVideoMode && st.pexelsDuration !== "all") {
                items = items.filter((video) => {
                  if (st.pexelsDuration === "short") return video.duration <= 15;
                  if (st.pexelsDuration === "medium") return video.duration > 15 && video.duration <= 30;
                  if (st.pexelsDuration === "long") return video.duration > 30;
                  return true;
                });
              }

              if (!items || items.length === 0) {
                return (
                  <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                    <i
                      className={isVideoMode ? "icon-[ri--video-chat-line] w-8 h-8 text-slate-700" : "icon-[ri--image-line] w-8 h-8 text-slate-700"}
                    />
                    <p className="text-xs text-slate-500 font-medium">{`No ${st.pexelsMediaType}s found for "${st.pexelsQuery}" with current filters.`}</p>
                  </div>
                );
              }

              const visibleItems = items.slice(0, st.pexelsVisibleCount);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 items-start">
                    {visibleItems.map((item) => {
                      const assetId = isVideoMode ? `pexels-${item.id}` : `pexels-photo-${item.id}`;
                      const isLoading = st.loadingAssetId === assetId;
                      const thumbnail = isVideoMode ? item.image : item.src.medium || item.src.small;
                      const artist = isVideoMode ? item.user?.name : item.photographer;
                      const profileUrl = isVideoMode ? item.user?.url : item.photographer_url;
                      const width = item.width || 1;
                      const height = item.height || 1;

                      return (
                        <div
                          key={`${assetId}`}
                          className="relative group rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between"
                          style={{ aspectRatio: `${width} / ${height}` }}
                        >
                          {/* Thumbnail Preview */}
                          <img
                            src={thumbnail}
                            className="w-full h-full object-cover absolute inset-0 opacity-70 group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Video Duration Badge */}
                          {isVideoMode && (
                            <span className="absolute right-2 top-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-slate-300 z-10 font-mono">
                              {`${Math.round(item.duration)}s`}
                            </span>
                          )}

                          {/* Video Play Icon */}
                          {isVideoMode && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-10">
                              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <i className="icon-[ri--play-fill] w-4.5 h-4.5 text-slate-200" />
                              </div>
                            </div>
                          )}

                          {/* Loading Spinner Overlay */}
                          {isLoading ? (
                            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1.5">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Importing...</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  title="Add as Background"
                                  className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer"
                                  onClick={() => handlePexelsAdd(item, "background")}
                                >
                                  <i className="icon-[ri--image-line] w-4 h-4" />
                                </button>
                                <button
                                  title="Add as Overlay"
                                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer"
                                  onClick={() => handlePexelsAdd(item, "overlay")}
                                >
                                  <i className="icon-[ri--image-add-line] w-4 h-4" />
                                </button>
                              </div>
                              {profileUrl && (
                                <a
                                  href={profileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-slate-400 hover:text-blue-400 font-semibold transition-colors flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full pointer-events-auto cursor-pointer"
                                >
                                  <i className="icon-[ri--external-link-line] w-2.5 h-2.5" />
                                  {`By ${artist || "Pexels"}`}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Load More Button */}
                  {(st.hasMorePexels || items.length > st.pexelsVisibleCount) && (
                    <div className="flex items-center justify-center border-t border-slate-800 pt-4 mt-4">
                      <button
                        className="w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
                        disabled={st.isSearchingPexels}
                        onClick={loadMorePexels}
                      >
                        {st.isSearchingPexels ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" />
                            Loading More...
                          </>
                        ) : (
                          <>
                            <i className="icon-[ri--arrow-down-s-line] w-3.5 h-3.5" />
                            Load More
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* 4. EMOJI TAB */}
        {st.activeSubTab === "emoji" && (
          !st.emojisData ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
              <p className="text-xs text-slate-500 font-semibold">Loading animated emojis...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Emoji Search */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search animated emojis..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50"
                    value={st.emojiQuery || ""}
                    onChange={(e) => apply({ emojiQuery: e.target.value, emojiVisibleCount: 24 })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                      }
                    }}
                  />
                  <i className="icon-[ri--search-line] absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* Emoji Category Pills */}
              <div className="flex gap-1 overflow-x-auto pb-1 mb-1 scrollbar-none snap-x">
                {EMOJI_CATEGORIES.map((cat) => {
                  const isSel = st.emojiCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      className={`px-2.5 py-1 text-[9px] font-bold rounded-full transition-all cursor-pointer shrink-0 snap-start uppercase tracking-wider ${isSel ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20" : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750 border border-transparent"}`}
                      onClick={() => apply({ emojiCategory: cat.id, emojiVisibleCount: 24 })}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Emoji Grid */}
              {(() => {
                let filteredEmojis: any[] = [];
                const categories = st.emojisData?.categories || [];

                if (st.emojiCategory === "all") {
                  filteredEmojis = categories.flatMap((cat: any) =>
                    (cat.items || []).map((item: any) => ({ ...item, category: cat.id }))
                  );
                } else {
                  const activeCat = categories.find((cat: any) => cat.id === st.emojiCategory);
                  if (activeCat) {
                    filteredEmojis = (activeCat.items || []).map((item: any) => ({ ...item, category: activeCat.id }));
                  }
                }

                if (st.emojiQuery && st.emojiQuery.trim()) {
                  const q = st.emojiQuery.toLowerCase().trim();
                  filteredEmojis = filteredEmojis.filter((e) => e.tag.toLowerCase().includes(q));
                }

                if (filteredEmojis.length === 0) {
                  return (
                    <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                      <i className="icon-[ri--emotion-unhappy-line] w-8 h-8 text-slate-700" />
                      <p className="text-xs text-slate-500 font-medium">No emojis found matching filters.</p>
                    </div>
                  );
                }

                const visibleEmojis = filteredEmojis.slice(0, st.emojiVisibleCount);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {visibleEmojis.map((emoji) => {
                        const isLoading = st.loadingAssetId === `emoji-${emoji.codepoint}`;
                        const isHovered = st.hoveredEmojiCodepoint === emoji.codepoint;
                        return (
                          <div
                            key={emoji.codepoint}
                            className="relative group aspect-square rounded-xl bg-slate-950/40 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/50 flex items-center justify-center p-2.5 transition-all cursor-pointer overflow-hidden"
                            onMouseEnter={() => {
                              if (hoverTimeoutRef.current) {
                                clearTimeout(hoverTimeoutRef.current);
                              }
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
                              className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-200"
                            />

                            {isLoading ? (
                              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1">
                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent" />
                                <span className="text-[7px] text-blue-400 font-bold uppercase tracking-wider">Importing</span>
                              </div>
                            ) : (
                              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none">
                                <i className="icon-[ri--add-line] w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Load More Button */}
                    {filteredEmojis.length > st.emojiVisibleCount && (
                      <div className="flex items-center justify-center border-t border-slate-800 pt-3 mt-1">
                        <button
                          className="w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          onClick={() => apply({ emojiVisibleCount: st.emojiVisibleCount + 24 })}
                        >
                          <i className="icon-[ri--arrow-down-s-line] w-3.5 h-3.5" />
                          Load More
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )
        )}
      </div>
    </div>
  );
};
