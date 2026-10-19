import { useEffect, useReducer, useRef } from "react";
import { addClipToTimeline } from "../../lib/clip-factory";
import { processMediaFile, processMediaUrl } from "../../lib/media-helper";
import { cloneVids } from "../../utils/helpers";
import { editorStore, useEditorStore } from "../../store/editor-store";
import type { PanelState, SubTab } from "./types";
import { createPanelState } from "./types";
import { UploadsTab } from "./uploads-tab";
import { PixabayTab } from "./pixabay-tab";
import { PexelsTab } from "./pexels-tab";
import { EmojiTab } from "./emoji-tab";
import {
  SUB_TABS,
  stockRequest,
} from "./constants";

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
      orientation:
        state.pexelsOrientation === "all" ? "" : state.pexelsOrientation,
      page: state.pexelsCurrentPage,
      per_page: 50,
    })
      .then((data) => {
        const newPhotos = data.photos || [];
        const newVideos = data.videos || [];
        const newItems =
          stRef.current.pexelsMediaType === "photo" ? newPhotos : newVideos;

        if (newItems.length < 50) {
          apply({ hasMorePexels: false });
        } else {
          apply({ hasMorePexels: true });
        }

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
    const source = isVideoMode
      ? stRef.current.pexelsVideos
      : stRef.current.pexelsPhotos;
    let items = source;

    if (isVideoMode && stRef.current.pexelsDuration !== "all") {
      items = items.filter((video) => {
        if (stRef.current.pexelsDuration === "short")
          return video.duration <= 15;
        if (stRef.current.pexelsDuration === "medium")
          return video.duration > 15 && video.duration <= 30;
        if (stRef.current.pexelsDuration === "long") return video.duration > 30;
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
      orientation:
        state.pixabayOrientation === "all" ? "" : state.pixabayOrientation,
      colors:
        state.pixabayMediaType !== "video" && state.pixabayTransparentOnly
          ? "transparent"
          : "",
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

        apply({
          pixabayItems: stRef.current.pixabayItems.concat(hits),
          isSearchingPixabay: false,
        });
      })
      .catch((err) => {
        console.error("Pixabay search failed:", err);
        apply({
          pixabayError:
            (err as { message?: string }).message ||
            `Failed to fetch from Pixabay`,
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
        bgElements:
          asset.type === "video" ? cloneVids(asset.elements as never) : null,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        currentEffect: "random",
      });
    } else {
      addClipToTimeline("overlay", {
        mediaType: asset.type,
        mediaElement: asset.element,
        mediaElements:
          asset.type === "video" ? cloneVids(asset.elements as never) : null,
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
    const existing = (editorStore.getState().mediaPool as any[]).find(
      (m) => m.id === asset.id || m.url === asset.url,
    );
    if (existing) {
      addAssetToTimeline(existing, asType);
      return;
    }

    // Otherwise load and process the stock media URL
    apply({ loadingAssetId: asset.id });

    processMediaUrl(
      asset.url,
      asset.type,
      asset.name,
      asset.source || "stock",
      (processedAsset: any) => {
        processedAsset.id = asset.id;
        editorStore.setState({
          mediaPool: [...editorStore.getState().mediaPool, processedAsset],
        });
        apply({ loadingAssetId: null });
        addAssetToTimeline(processedAsset, asType);
        forceUpdate();
      },
    );
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
      let bestFile = files.find(
        (f: any) =>
          f.width >= 960 && f.width <= 1280 && f.file_type === "video/mp4",
      );
      if (!bestFile)
        bestFile = files.find(
          (f: any) => f.quality === "sd" && f.file_type === "video/mp4",
        );
      if (!bestFile)
        bestFile = files.find((f: any) => f.file_type === "video/mp4");
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
      const bestVid =
        videos.medium || videos.small || videos.large || videos.tiny || {};
      const asset = {
        id: `pixabay-video-${item.id}`,
        name: `Pixabay - ${item.user || "Video"}`,
        type: "video",
        source: "pixabay",
        url: bestVid.url,
        thumbnail:
          bestVid.thumbnail || (videos.tiny && videos.tiny.thumbnail) || "",
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

      apply({
        activeUploadsCount: stRef.current.activeUploadsCount + files.length,
        totalUploadsCount: stRef.current.totalUploadsCount + files.length,
      });

      files.forEach((file) => {
        processMediaFile(file, (asset: any) => {
          editorStore.setState({
            mediaPool: [...editorStore.getState().mediaPool, asset],
          });
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

  // Restore persisted panel state and lazy-load module data on mount.
  useEffect(() => {
    const state = editorStore.getState() as unknown as Record<
      string,
      Partial<PanelState>
    >;
    const restored: Partial<PanelState> = {
      ...(state.pexelsPanelState ?? {}),
      ...(state.emojiPanelState ?? {}),
      ...(state.pixabayPanelState ?? {}),
    };
    // Keep non-persisted hooks out of the merge (no cross-contamination).
    delete (restored as { emojisData?: unknown }).emojisData;
    delete (restored as { hoveredEmojiCodepoint?: unknown })
      .hoveredEmojiCodepoint;
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
      import("../../data/animated-emojis.json")
        .then((module) => {
          apply({ emojisData: (module as { default: any }).default });
        })
        .catch((err) => {
          console.error("Failed to load animated emojis:", err);
        });
    }

    return () => {
      // Persist sub-tab + search state across HMR and route switches.
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

  // forceUpdate replaces a store poke here; the media-pool assets list only
  // refreshes when a new clip/asset is selected, which triggers a re-render.
  const st = stRef.current;
  // Re-render when clips/selections change through addClipToTimeline's
  // top-level store writes (pushes to mediaPool are in-place, unobserved).
  useEditorStore((s) => s.selectedClipId);
  const uploads = (editorStore.getState().mediaPool as any[]).filter(
    (m) =>
      m.source === "upload" || m.source === "pexels" || m.source === "pixabay",
  );

  const api = {
    st,
    apply,
    uploads,
    hoverTimeoutRef,
    hoverScheduledRef,
    selectSubTab,
    searchPexels,
    loadMorePexels,
    searchPixabay,
    loadMorePixabay,
    addAssetToTimeline,
    handleAssetAdd,
    handlePexelsAdd,
    handlePixabayAdd,
    handleEmojiAdd,
    triggerUpload,
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900/50 p-4">
      {/* Sub-Tabs Header - Distributed and compact */}
      <div className="mb-4 flex gap-1 border-b border-slate-800 pb-1.5">
        {SUB_TABS.map((tab) => {
          const isActive = st.activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              title={tab.label}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[9px] font-bold tracking-tight uppercase transition-all ${isActive ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-slate-500 hover:bg-slate-800/30 hover:text-slate-300"}`}
              onClick={() => selectSubTab(tab.id)}
            >
              <i className={`${tab.icon} h-3.5 w-3.5`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab Content */}
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        {/* 1. UPLOADS TAB */}
        {st.activeSubTab === "uploads" && <UploadsTab api={api} />}

        {/* 2. PIXABAY TAB - DYNAMIC STOCK SEARCH */}
        {st.activeSubTab === "pixabay" && <PixabayTab api={api} />}

        {/* 3. PEXELS TAB */}
        {st.activeSubTab === "pexels" && <PexelsTab api={api} />}

        {/* 4. EMOJI TAB */}
        {st.activeSubTab === "emoji" && <EmojiTab api={api} />}

      </div>
    </div>
  );
};
