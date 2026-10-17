import m from "mithril";
import { State } from "../lib/state";
import { addClipToTimeline } from "../lib/clip-factory";
import { processMediaFile, processMediaUrl } from "../lib/media-helper";
import { cloneVids } from "../utils/helpers";

export const MediaLibraryPanel = {
  activeSubTab: "uploads", // "uploads" | "pixabay" | "pexels" | "emoji"
  activeUploadsCount: 0,
  totalUploadsCount: 0,
  loadingAssetId: null,

  // Pexels integration states
  pexelsQuery: "Rain forest",
  pexelsVideos: [],
  pexelsPhotos: [],
  pexelsMediaType: "video", // "video" | "photo"
  pexelsOrientation: "landscape", // "all" | "landscape" | "portrait" | "square"
  pexelsDuration: "all", // "all" | "short" | "medium" | "long"
  pexelsCurrentPage: 1,
  pexelsVisibleCount: 10,
  hasMorePexels: true,
  showPexelsFilters: false,
  isSearchingPexels: false,
  pexelsError: null,

  // Emoji integration states
  emojisData: null,
  emojiQuery: "",
  emojiCategory: "all",
  emojiVisibleCount: 24,
  hoveredEmojiCodepoint: null,
  hoverTimeout: null,
  hoverScheduledCodepoint: null,

  // Pixabay integration states
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

  selectSubTab(tabId) {
    this.activeSubTab = tabId;
    if (tabId === "pexels" && this.pexelsVideos.length === 0 && this.pexelsPhotos.length === 0 && !this.isSearchingPexels) {
      this.searchPexels(this.pexelsQuery);
    }
    if (tabId === "pixabay" && this.pixabayItems.length === 0 && !this.isSearchingPixabay) {
      this.searchPixabay(this.pixabayQuery);
    }
  },

  async oninit() {
    if (State.pexelsPanelState) {
      Object.assign(this, State.pexelsPanelState);
    }
    if (State.emojiPanelState) {
      Object.assign(this, State.emojiPanelState);
    }
    if (State.pixabayPanelState) {
      Object.assign(this, State.pixabayPanelState);
    }
    if (this.activeSubTab === "pexels" && this.pexelsVideos.length === 0 && this.pexelsPhotos.length === 0 && !this.isSearchingPexels) {
      this.searchPexels(this.pexelsQuery);
    }
    if (this.activeSubTab === "pixabay" && this.pixabayItems.length === 0 && !this.isSearchingPixabay) {
      this.searchPixabay(this.pixabayQuery);
    }

    if (!this.emojisData) {
      try {
        const module = await import("../data/animated-emojis.json");
        this.emojisData = module.default;
        m.redraw();
      } catch (err) {
        console.error("Failed to load animated emojis:", err);
      }
    }
  },

  onremove() {
    State.pexelsPanelState = {
      activeSubTab: this.activeSubTab,
      activeUploadsCount: this.activeUploadsCount,
      totalUploadsCount: this.totalUploadsCount,
      loadingAssetId: this.loadingAssetId,
      pexelsQuery: this.pexelsQuery,
      pexelsVideos: this.pexelsVideos,
      pexelsPhotos: this.pexelsPhotos,
      pexelsMediaType: this.pexelsMediaType,
      pexelsOrientation: this.pexelsOrientation,
      pexelsDuration: this.pexelsDuration,
      pexelsCurrentPage: this.pexelsCurrentPage,
      pexelsVisibleCount: this.pexelsVisibleCount,
      hasMorePexels: this.hasMorePexels,
      showPexelsFilters: this.showPexelsFilters,
      isSearchingPexels: this.isSearchingPexels,
      pexelsError: this.pexelsError
    };
    State.emojiPanelState = {
      emojiQuery: this.emojiQuery,
      emojiCategory: this.emojiCategory,
      emojiVisibleCount: this.emojiVisibleCount
    };
    State.pixabayPanelState = {
      pixabayQuery: this.pixabayQuery,
      pixabayMediaType: this.pixabayMediaType,
      pixabayOrientation: this.pixabayOrientation,
      pixabayTransparentOnly: this.pixabayTransparentOnly,
      pixabayItems: this.pixabayItems,
      pixabayVisibleCount: this.pixabayVisibleCount,
      pixabayCurrentPage: this.pixabayCurrentPage,
      hasMorePixabay: this.hasMorePixabay,
      isSearchingPixabay: this.isSearchingPixabay,
      pixabayError: this.pixabayError,
      showPixabayFilters: this.showPixabayFilters
    };
  },

  triggerUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      this.activeUploadsCount += files.length;
      this.totalUploadsCount += files.length;
      m.redraw();

      files.forEach((file) => {
        processMediaFile(file, (asset) => {
          State.mediaPool.push(asset);
          this.activeUploadsCount--;
          if (this.activeUploadsCount === 0) {
            this.totalUploadsCount = 0;
          }
          m.redraw();
        });
      });
    };
    input.click();
  },

  addAssetToTimeline(asset, asType) {
    if (asType === "background") {
      addClipToTimeline("background", {
        bgType: asset.type,
        bgElement: asset.element,
        bgElements: asset.type === "video" ? cloneVids(asset.elements) : null,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        currentEffect: "random"
      });
    } else {
      addClipToTimeline("overlay", {
        mediaType: asset.type,
        mediaElement: asset.element,
        mediaElements: asset.type === "video" ? cloneVids(asset.elements) : null,
        gifFrames: asset.gifFrames,
        gifDuration: asset.gifDuration,
        videoDuration: asset.duration,
        fileName: asset.name,
        thumbnail: asset.thumbnail,
        loop: true,
        opacity: 1.0
      });
    }
  },

  handleAssetAdd(asset, asType) {
    // If it's already in the media pool, add immediately
    const existing = State.mediaPool.find(m => m.id === asset.id || m.url === asset.url);
    if (existing) {
      this.addAssetToTimeline(existing, asType);
      return;
    }

    // Otherwise load and process the stock media URL
    this.loadingAssetId = asset.id;
    m.redraw();

    processMediaUrl(asset.url, asset.type, asset.name, asset.source || "stock", (processedAsset) => {
      processedAsset.id = asset.id;
      State.mediaPool.push(processedAsset);
      this.loadingAssetId = null;
      this.addAssetToTimeline(processedAsset, asType);
      m.redraw();
    });
  },

  searchPexels(query, resetPage = true) {
    if (!query || !query.trim()) return;
    if (resetPage) {
      this.pexelsCurrentPage = 1;
      this.pexelsVisibleCount = 10;
      this.hasMorePexels = true;
      if (this.pexelsMediaType === "photo") {
        this.pexelsPhotos = [];
      } else {
        this.pexelsVideos = [];
      }
    }
    this.isSearchingPexels = true;
    this.pexelsError = null;
    m.redraw();

    m.request({
      method: "GET",
      url: "/api/pexels/search",
      params: {
        query: query.trim(),
        type: this.pexelsMediaType,
        orientation: this.pexelsOrientation === "all" ? "" : this.pexelsOrientation,
        page: this.pexelsCurrentPage,
        per_page: 50
      }
    })
    .then((data) => {
      const newPhotos = data.photos || [];
      const newVideos = data.videos || [];
      const newItems = this.pexelsMediaType === "photo" ? newPhotos : newVideos;

      if (newItems.length < 50) {
        this.hasMorePexels = false;
      } else {
        this.hasMorePexels = true;
      }

      if (this.pexelsMediaType === "photo") {
        this.pexelsPhotos = this.pexelsPhotos.concat(newPhotos);
        this.pexelsVideos = [];
      } else {
        this.pexelsVideos = this.pexelsVideos.concat(newVideos);
        this.pexelsPhotos = [];
      }
      this.isSearchingPexels = false;
      m.redraw();
    })
    .catch((err) => {
      console.error("Pexels search failed:", err);
      this.pexelsError = err.error || (err.response && err.response.error) || `Failed to fetch ${this.pexelsMediaType}s from Pexels`;
      this.isSearchingPexels = false;
      m.redraw();
    });
  },

  loadMorePexels() {
    this.pexelsVisibleCount += 10;
    
    const isVideoMode = this.pexelsMediaType === "video";
    let items = isVideoMode ? this.pexelsVideos : this.pexelsPhotos;

    if (isVideoMode && this.pexelsDuration !== "all") {
      items = items.filter(video => {
        if (this.pexelsDuration === "short") return video.duration <= 15;
        if (this.pexelsDuration === "medium") return video.duration > 15 && video.duration <= 30;
        if (this.pexelsDuration === "long") return video.duration > 30;
        return true;
      });
    }

    if (this.pexelsVisibleCount >= items.length && !this.isSearchingPexels && this.hasMorePexels) {
      this.pexelsCurrentPage++;
      this.searchPexels(this.pexelsQuery, false);
    }
  },

  handlePexelsAdd(media, asType) {
    if (this.pexelsMediaType === "photo") {
      const asset = {
        id: `pexels-photo-${media.id}`,
        name: `Pexels - ${media.photographer || "Photo"}`,
        type: "image",
        source: "pexels",
        url: media.src.large || media.src.original,
        thumbnail: media.src.medium || media.src.small,
        duration: 0,
        width: media.width,
        height: media.height
      };
      this.handleAssetAdd(asset, asType);
    } else {
      const files = media.video_files || [];
      // Select standard HD resolution for optimal rendering speed
      let bestFile = files.find(f => f.width >= 960 && f.width <= 1280 && f.file_type === "video/mp4");
      if (!bestFile) bestFile = files.find(f => f.quality === "sd" && f.file_type === "video/mp4");
      if (!bestFile) bestFile = files.find(f => f.file_type === "video/mp4");
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
        height: media.height
      };

      this.handleAssetAdd(asset, asType);
    }
  },

  searchPixabay(query, resetPage = true) {
    if (!query || !query.trim()) return;
    if (resetPage) {
      this.pixabayCurrentPage = 1;
      this.pixabayVisibleCount = 10;
      this.hasMorePixabay = true;
      this.pixabayItems = [];
    }
    this.isSearchingPixabay = true;
    this.pixabayError = null;
    m.redraw();

    m.request({
      method: "GET",
      url: "/api/pixabay/search",
      params: {
        query: query.trim(),
        type: this.pixabayMediaType,
        orientation: this.pixabayOrientation === "all" ? "" : this.pixabayOrientation,
        colors: (this.pixabayMediaType !== "video" && this.pixabayTransparentOnly) ? "transparent" : "",
        page: this.pixabayCurrentPage,
        per_page: 55
      }
    })
    .then((data) => {
      const hits = data.hits || [];
      if (hits.length < 55) {
        this.hasMorePixabay = false;
      } else {
        this.hasMorePixabay = true;
      }

      this.pixabayItems = this.pixabayItems.concat(hits);
      this.isSearchingPixabay = false;
      m.redraw();
    })
    .catch((err) => {
      console.error("Pixabay search failed:", err);
      this.pixabayError = err.error || (err.response && err.response.error) || `Failed to fetch from Pixabay`;
      this.isSearchingPixabay = false;
      m.redraw();
    });
  },

  loadMorePixabay() {
    this.pixabayVisibleCount += 10;
    if (this.pixabayVisibleCount >= this.pixabayItems.length && !this.isSearchingPixabay && this.hasMorePixabay) {
      this.pixabayCurrentPage++;
      this.searchPixabay(this.pixabayQuery, false);
    }
  },

  handlePixabayAdd(item, asType) {
    if (this.pixabayMediaType === "video") {
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
        height: bestVid.height || 720
      };
      this.handleAssetAdd(asset, asType);
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
        height: item.imageHeight || 1080
      };
      this.handleAssetAdd(asset, asType);
    }
  },

  handleEmojiAdd(emoji) {
    const asset = {
      id: `emoji-${emoji.codepoint}`,
      name: `Emoji - ${emoji.tag}`,
      type: "image",
      source: "emoji",
      url: `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.gif`,
      thumbnail: `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.webp`,
      duration: 0,
      width: 512,
      height: 512
    };
    this.handleAssetAdd(asset, "overlay");
  },

  view() {
    const subTabs = [
      { id: "uploads", label: "Uploads", icon: "icon-[ri--upload-cloud-2-line]" },
      { id: "pixabay", label: "Pixabay", icon: "icon-[ri--global-line]" },
      { id: "pexels", label: "Pexels", icon: "icon-[ri--camera-lens-line]" },
      { id: "emoji", label: "Emoji", icon: "icon-[ri--emotion-happy-line]" },
    ];

    // Show both uploads, Pexels, and Pixabay imports in the user's asset manager for reuse
    const uploads = State.mediaPool.filter(m => m.source === "upload" || m.source === "pexels" || m.source === "pixabay");

    return m("div", { class: "bg-slate-900/50 p-4 flex flex-col h-full w-full overflow-hidden" }, [
      // Sub-Tabs Header - Distributed and compact
      m("div", { class: "flex border-b border-slate-800 mb-4 pb-1.5 gap-1" }, 
        subTabs.map(tab => {
          const isActive = this.activeSubTab === tab.id;
          return m("button", {
            title: tab.label,
            class: `flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-tight transition-all cursor-pointer ${isActive ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 border border-transparent hover:text-slate-300 hover:bg-slate-800/30"}`,
            onclick: () => this.selectSubTab(tab.id)
          }, [
            m("i", { class: `${tab.icon} w-3.5 h-3.5` }),
            m("span", tab.label)
          ]);
        })
      ),

      // Sub-Tab Content
      m("div", { class: "flex-1 overflow-y-auto custom-scrollbar pr-1" }, [
        
        // 1. UPLOADS TAB
        this.activeSubTab === "uploads" && m("div", { class: "space-y-4" }, [
          m("div", { class: "flex items-center justify-between" }, [
            m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Uploaded & Imported"),
            m("button", {
              class: "px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1",
              onclick: () => this.triggerUpload()
            }, [
              m("i", { class: "icon-[ri--upload-2-fill] w-3 h-3" }),
              "Upload"
            ])
          ]),

          this.activeUploadsCount > 0 && m("div", { class: "p-3 bg-blue-950/10 border border-blue-900/20 rounded-xl flex items-center justify-center gap-2.5" }, [
            m("div", { class: "animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" }),
            m("span", { class: "text-[10px] text-blue-400 font-semibold" }, `Processing media (${this.totalUploadsCount - this.activeUploadsCount}/${this.totalUploadsCount})...`)
          ]),

          uploads.length === 0 && this.activeUploadsCount === 0 && m("div", { class: "p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2" }, [
            m("i", { class: "icon-[ri--folder-upload-line] w-8 h-8 text-slate-700" }),
            m("p", { class: "text-xs text-slate-500 font-medium" }, "No uploaded or imported assets yet.")
          ]),

          uploads.length > 0 && m("div", { class: "grid grid-cols-2 gap-3 items-start" }, 
            uploads.map(asset => {
              const width = asset.width || (asset.type === "video" ? 16 : 1);
              const height = asset.height || (asset.type === "video" ? 9 : 1);
              return m("div", {
                class: "relative group rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between",
                style: { aspectRatio: `${width} / ${height}` }
              }, [
                // Media Thumbnail Preview
                asset.thumbnail 
                  ? m("img", { src: asset.thumbnail, class: "w-full h-full object-cover absolute inset-0 opacity-70 group-hover:scale-105 transition-transform duration-300" })
                  : m("div", { class: "w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900" }, [
                      m("i", { class: asset.type === "video" ? "icon-[ri--film-line] w-6 h-6 text-slate-700" : "icon-[ri--image-line] w-6 h-6 text-slate-700" })
                    ]),

                // Video Duration Badge
                asset.type === "video" && m("span", { class: "absolute right-2 top-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-slate-300 z-10 font-mono" }, 
                  `${Math.round(asset.duration)}s`
                ),

                // Video Play Icon Indicator
                asset.type === "video" && m("div", { class: "absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-10" }, [
                  m("div", { class: "w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10" }, [
                    m("i", { class: "icon-[ri--play-fill] w-4.5 h-4.5 text-slate-200" })
                  ])
                ]),

                // Asset details
                m("div", { class: "absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end min-h-[40px] pointer-events-none" }, [
                  m("span", { class: "text-[9px] font-bold text-slate-200 truncate pr-1" }, asset.name)
                ]),

                // Action Overlays - Compact Circular Buttons with Tooltips
                m("div", { class: "absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" }, [
                  m("button", {
                    title: "Add as Background",
                    class: "w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer",
                    onclick: () => this.addAssetToTimeline(asset, "background")
                  }, m("i", { class: "icon-[ri--image-line] w-4 h-4" })),
                  m("button", {
                    title: "Add as Overlay",
                    class: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer",
                    onclick: () => this.addAssetToTimeline(asset, "overlay")
                  }, m("i", { class: "icon-[ri--image-add-line] w-4 h-4" }))
                ])
              ]);
            })
          )
        ]),

        // 2. PIXABAY TAB - DYNAMIC STOCK SEARCH
        this.activeSubTab === "pixabay" && m("div", { class: "space-y-4" }, [
          m("div", { class: "flex items-center gap-2" }, [
            m("div", { class: "relative flex-1" }, [
              m("input", {
                type: "text",
                placeholder: `Search ${this.pixabayMediaType}s on Pixabay...`,
                class: "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50",
                value: this.pixabayQuery || "",
                oninput: (e) => this.pixabayQuery = e.target.value,
                onkeydown: (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    this.searchPixabay(this.pixabayQuery);
                  }
                }
              }),
              m("i", { class: "icon-[ri--search-line] absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" })
            ]),
            m("button", {
              title: "Toggle Filters",
              class: `p-1.5 border rounded-lg cursor-pointer transition-all flex items-center justify-center ${this.showPixabayFilters ? "bg-blue-600/20 border-blue-500/30 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`,
              onclick: () => this.showPixabayFilters = !this.showPixabayFilters
            }, m("i", { class: "icon-[ri--filter-3-line] w-3.5 h-3.5" })),
            m("button", {
              class: "px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-transparent rounded-lg text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1",
              onclick: () => this.searchPixabay(this.pixabayQuery)
            }, [
              m("i", { class: "icon-[ri--search-2-line] w-3 h-3" }),
              "Search"
            ])
          ]),

          // Filters Drawer
          this.showPixabayFilters && m("div", { class: "p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3 mt-1.5 mb-1.5 animate-tab-fade-in" }, [
            // Media Type Selection
            m("div", { class: "flex items-center justify-between gap-2" }, [
              m("span", { class: "text-[9px] font-bold text-slate-500 uppercase tracking-wider" }, "Type"),
              m("div", { class: "flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 overflow-x-auto scrollbar-none" }, [
                ["video", "Video"],
                ["photo", "Photo"],
                ["illustration", "Illust"],
                ["vector", "Vector"]
              ].map(([val, label]) => 
                m("button", {
                  class: `px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${this.pixabayMediaType === val ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-350"}`,
                  onclick: () => {
                    this.pixabayMediaType = val;
                    this.searchPixabay(this.pixabayQuery);
                  }
                }, label)
              ))
            ]),

            // Orientation
            m("div", { class: "flex items-center justify-between gap-2" }, [
              m("span", { class: "text-[9px] font-bold text-slate-500 uppercase tracking-wider" }, "Orientation"),
              m("div", { class: "flex bg-slate-950 p-0.5 rounded-lg border border-slate-850" }, [
                ["all", "Any"],
                ["landscape", "Horiz"],
                ["portrait", "Vert"]
              ].map(([val, label]) => 
                m("button", {
                  class: `px-1.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${this.pixabayOrientation === val ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-350 border border-transparent"}`,
                  onclick: () => {
                    this.pixabayOrientation = val;
                    this.searchPixabay(this.pixabayQuery);
                  }
                }, label)
              ))
            ]),

            // Transparent Background Toggle (Image types only)
            this.pixabayMediaType !== "video" && m("div", {
              class: "flex items-center justify-between p-1 bg-slate-950/40 border border-slate-855 rounded-lg"
            }, [
              m("div", { class: "flex flex-col pl-1" }, [
                m("span", { class: "text-[9px] font-bold text-slate-300" }, "Transparent BG (Stickers)"),
                m("span", { class: "text-[8px] text-slate-500" }, "Filters transparent PNG elements"),
              ]),
              m("button", {
                class: `w-8 h-4 rounded-full relative transition-colors ${this.pixabayTransparentOnly ? "bg-blue-600" : "bg-slate-850"}`,
                onclick: () => {
                  this.pixabayTransparentOnly = !this.pixabayTransparentOnly;
                  this.searchPixabay(this.pixabayQuery);
                }
              }, [
                m("div", { 
                  class: `absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${this.pixabayTransparentOnly ? "right-0.5" : "left-0.5"}` 
                })
              ])
            ])
          ]),

          this.isSearchingPixabay && this.pixabayItems.length === 0 && m("div", { class: "p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-center gap-2" }, [
            m("div", { class: "animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" }),
            m("span", { class: "text-xs text-slate-400 font-medium" }, `Searching Pixabay...`)
          ]),

          this.pixabayError && m("div", { class: "p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-2.5" }, [
            m("i", { class: "icon-[ri--error-warning-line] text-red-500 w-4.5 h-4.5 mt-0.5" }),
            m("div", [
              m("p", { class: "text-[10px] font-bold text-red-400 uppercase tracking-wide" }, "Search Error"),
              m("p", { class: "text-[9px] text-red-300/80 leading-relaxed mt-0.5" }, this.pixabayError)
            ])
          ]),

          (!this.isSearchingPixabay || this.pixabayItems.length > 0) && !this.pixabayError && (() => {
            const items = this.pixabayItems;
            if (!items || items.length === 0) {
              return m("div", { class: "p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2" }, [
                m("i", { class: "icon-[ri--image-line] w-8 h-8 text-slate-700" }),
                m("p", { class: "text-xs text-slate-500 font-medium" }, `No items found on Pixabay for "${this.pixabayQuery}".`)
              ]);
            }

            const visibleItems = items.slice(0, this.pixabayVisibleCount);
            const isVideoMode = this.pixabayMediaType === "video";

            return m("div", { class: "space-y-4" }, [
              m("div", { class: "grid grid-cols-2 gap-3 items-start" }, 
                visibleItems.map(item => {
                  const assetId = isVideoMode ? `pixabay-video-${item.id}` : `pixabay-image-${item.id}`;
                  const isLoading = this.loadingAssetId === assetId;
                  
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

                  return m("div", {
                    class: "relative group rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between",
                    style: { aspectRatio: `${width} / ${height}` }
                  }, [
                    // Thumbnail Preview
                    thumbnail
                      ? m("img", { src: thumbnail, class: "w-full h-full object-cover absolute inset-0 opacity-70 group-hover:scale-105 transition-transform duration-300" })
                      : m("div", { class: "w-full h-full absolute inset-0 flex items-center justify-center bg-slate-900" }, [
                          m("i", { class: isVideoMode ? "icon-[ri--film-line] w-6 h-6 text-slate-700" : "icon-[ri--image-line] w-6 h-6 text-slate-700" })
                        ]),

                    // Video Duration Badge
                    isVideoMode && m("span", { class: "absolute right-2 top-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-slate-300 z-10 font-mono" }, 
                      `${Math.round(item.duration)}s`
                    ),

                    // Video Play Icon
                    isVideoMode && !isLoading && m("div", { class: "absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-10" }, [
                      m("div", { class: "w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10" }, [
                        m("i", { class: "icon-[ri--play-fill] w-4.5 h-4.5 text-slate-200" })
                      ])
                    ]),

                    // Author info
                    m("div", { class: "absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end min-h-[40px] pointer-events-none" }, [
                      m("span", { class: "text-[9px] font-bold text-slate-200 truncate pr-1" }, `By ${item.user || "Pixabay"}`)
                    ]),

                    // Loading Spinner Overlay
                    isLoading 
                      ? m("div", { class: "absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1.5" }, [
                          m("div", { class: "animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" }),
                          m("span", { class: "text-[8px] text-slate-400 font-bold uppercase tracking-wider" }, "Importing...")
                        ])
                      : m("div", { class: "absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2" }, [
                          m("div", { class: "flex items-center justify-center gap-2" }, [
                            m("button", {
                              title: "Add as Background",
                              class: "w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer",
                              onclick: () => this.handlePixabayAdd(item, "background")
                            }, m("i", { class: "icon-[ri--image-line] w-4 h-4" })),
                            m("button", {
                              title: "Add as Overlay",
                              class: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer",
                              onclick: () => this.handlePixabayAdd(item, "overlay")
                            }, m("i", { class: "icon-[ri--image-add-line] w-4 h-4" }))
                          ]),
                          m("a", {
                            href: item.pageURL || "https://pixabay.com",
                            target: "_blank",
                            rel: "noopener noreferrer",
                            class: "text-[9px] text-slate-400 hover:text-blue-400 font-semibold transition-colors flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full pointer-events-auto cursor-pointer"
                          }, [
                            m("i", { class: "icon-[ri--external-link-line] w-2.5 h-2.5" }),
                            "View on Pixabay"
                          ])
                        ])
                  ]);
                })
              ),

              // Load More Button
              (this.hasMorePixabay || items.length > this.pixabayVisibleCount) && m("div", { class: "flex items-center justify-center border-t border-slate-800 pt-4 mt-4" }, [
                m("button", {
                  class: "w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait",
                  disabled: this.isSearchingPixabay,
                  onclick: () => this.loadMorePixabay()
                }, [
                  this.isSearchingPixabay 
                    ? [m("div", { class: "animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" }), "Loading More..."]
                    : [m("i", { class: "icon-[ri--arrow-down-s-line] w-3.5 h-3.5" }), "Load More"]
                ])
              ])
            ]);
          })()
        ]),

        // 3. PEXELS TAB - FULLY INTEGRATED WITH DYNAMIC FILTERS & CATEGORIZATION
        this.activeSubTab === "pexels" && m("div", { class: "space-y-4" }, [
          m("div", { class: "flex items-center gap-2" }, [
            m("div", { class: "relative flex-1" }, [
              m("input", {
                type: "text",
                placeholder: `Search ${this.pexelsMediaType}s on Pexels...`,
                class: "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50",
                value: this.pexelsQuery || "",
                oninput: (e) => this.pexelsQuery = e.target.value,
                onkeydown: (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    this.searchPexels(this.pexelsQuery);
                  }
                }
              }),
              m("i", { class: "icon-[ri--search-line] absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" })
            ]),
            m("button", {
              title: "Toggle Filters",
              class: `p-1.5 border rounded-lg cursor-pointer transition-all flex items-center justify-center ${this.showPexelsFilters ? "bg-blue-600/20 border-blue-500/30 text-blue-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`,
              onclick: () => this.showPexelsFilters = !this.showPexelsFilters
            }, m("i", { class: "icon-[ri--filter-3-line] w-3.5 h-3.5" })),
            m("button", {
              class: "px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-transparent rounded-lg text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1",
              onclick: () => this.searchPexels(this.pexelsQuery)
            }, [
              m("i", { class: "icon-[ri--search-2-line] w-3 h-3" }),
              "Search"
            ])
          ]),

          // Filters Drawer
          this.showPexelsFilters && m("div", { class: "p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-3 mt-1.5 mb-1.5 animate-tab-fade-in" }, [
            // Media Type
            m("div", { class: "flex items-center justify-between gap-2" }, [
              m("span", { class: "text-[9px] font-bold text-slate-500 uppercase tracking-wider" }, "Type"),
              m("div", { class: "flex bg-slate-950 p-0.5 rounded-lg border border-slate-850" }, [
                m("button", {
                  class: `px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${this.pexelsMediaType === "video" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-350"}`,
                  onclick: () => {
                    this.pexelsMediaType = "video";
                    this.searchPexels(this.pexelsQuery);
                  }
                }, "Video"),
                m("button", {
                  class: `px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${this.pexelsMediaType === "photo" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-355"}`,
                  onclick: () => {
                    this.pexelsMediaType = "photo";
                    this.searchPexels(this.pexelsQuery);
                  }
                }, "Photo")
              ])
            ]),

            // Orientation
            m("div", { class: "flex items-center justify-between gap-2" }, [
              m("span", { class: "text-[9px] font-bold text-slate-500 uppercase tracking-wider" }, "Orientation"),
              m("div", { class: "flex bg-slate-950 p-0.5 rounded-lg border border-slate-850" }, [
                ["all", "Any"],
                ["landscape", "Horiz"],
                ["portrait", "Vert"],
                ["square", "Sq"]
              ].map(([val, label]) => 
                m("button", {
                  class: `px-1.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${this.pexelsOrientation === val ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-350 border border-transparent"}`,
                  onclick: () => {
                    this.pexelsOrientation = val;
                    this.searchPexels(this.pexelsQuery);
                  }
                }, label)
              ))
            ]),

            // Duration (for Video only)
            this.pexelsMediaType === "video" && m("div", { class: "flex items-center justify-between gap-2" }, [
              m("span", { class: "text-[9px] font-bold text-slate-500 uppercase tracking-wider" }, "Duration"),
              m("div", { class: "flex bg-slate-950 p-0.5 rounded-lg border border-slate-850" }, [
                ["all", "Any"],
                ["short", "< 15s"],
                ["medium", "15-30s"],
                ["long", "> 30s"]
              ].map(([val, label]) => 
                m("button", {
                  class: `px-1.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer ${this.pexelsDuration === val ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-350 border border-transparent"}`,
                  onclick: () => {
                    this.pexelsDuration = val;
                    m.redraw();
                  }
                }, label)
              ))
            ])
          ]),

          this.isSearchingPexels && (this.pexelsPhotos.length === 0 && this.pexelsVideos.length === 0) && m("div", { class: "p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-center gap-2" }, [
            m("div", { class: "animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" }),
            m("span", { class: "text-xs text-slate-400 font-medium" }, `Searching Pexels ${this.pexelsMediaType}s...`)
          ]),

          this.pexelsError && m("div", { class: "p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-2.5" }, [
            m("i", { class: "icon-[ri--error-warning-line] text-red-500 w-4.5 h-4.5 mt-0.5" }),
            m("div", [
              m("p", { class: "text-[10px] font-bold text-red-400 uppercase tracking-wide" }, "Search Error"),
              m("p", { class: "text-[9px] text-red-300/80 leading-relaxed mt-0.5" }, this.pexelsError)
            ])
          ]),

          // Client-side filtering of videos based on duration
          ((this.pexelsPhotos.length > 0 || this.pexelsVideos.length > 0) || !this.isSearchingPexels) && !this.pexelsError && (() => {
            const isVideoMode = this.pexelsMediaType === "video";
            let items = isVideoMode ? this.pexelsVideos : this.pexelsPhotos;

            if (isVideoMode && this.pexelsDuration !== "all") {
              items = items.filter(video => {
                if (this.pexelsDuration === "short") return video.duration <= 15;
                if (this.pexelsDuration === "medium") return video.duration > 15 && video.duration <= 30;
                if (this.pexelsDuration === "long") return video.duration > 30;
                return true;
              });
            }

            if (!items || items.length === 0) {
              return m("div", { class: "p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2" }, [
m("i", { class: isVideoMode ? "icon-[ri--video-chat-line] w-8 h-8 text-slate-700" : "icon-[ri--image-line] w-8 h-8 text-slate-700" }),
                m("p", { class: "text-xs text-slate-500 font-medium" }, `No ${this.pexelsMediaType}s found for "${this.pexelsQuery}" with current filters.`)
              ]);
            }

            const visibleItems = items.slice(0, this.pexelsVisibleCount);
            return m("div", { class: "space-y-4" }, [
              m("div", { class: "grid grid-cols-2 gap-3 items-start" }, 
                visibleItems.map(item => {
                  const assetId = isVideoMode ? `pexels-${item.id}` : `pexels-photo-${item.id}`;
                  const isLoading = this.loadingAssetId === assetId;
                  const thumbnail = isVideoMode ? item.image : item.src.medium || item.src.small;
                  const artist = isVideoMode ? item.user?.name : item.photographer;
                  const profileUrl = isVideoMode ? item.user?.url : item.photographer_url;
                  const width = item.width || 1;
                  const height = item.height || 1;
                  
                  return m("div", {
                    class: "relative group rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between",
                    style: { aspectRatio: `${width} / ${height}` }
                  }, [
                    // Thumbnail Preview
                    m("img", { src: thumbnail, class: "w-full h-full object-cover absolute inset-0 opacity-70 group-hover:scale-105 transition-transform duration-300" }),

                    // Video Duration Badge
                    isVideoMode && m("span", { class: "absolute right-2 top-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] font-bold text-slate-300 z-10 font-mono" }, 
                      `${Math.round(item.duration)}s`
                    ),

                    // Video Play Icon
                    isVideoMode && !isLoading && m("div", { class: "absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity z-10" }, [
                      m("div", { class: "w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10" }, [
                        m("i", { class: "icon-[ri--play-fill] w-4.5 h-4.5 text-slate-200" })
                      ])
                    ]),

                    // Loading Spinner Overlay
                    isLoading 
                      ? m("div", { class: "absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1.5" }, [
                          m("div", { class: "animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" }),
                          m("span", { class: "text-[8px] text-slate-400 font-bold uppercase tracking-wider" }, "Importing...")
                        ])
                      : m("div", { class: "absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2" }, [
                          m("div", { class: "flex items-center justify-center gap-2" }, [
                            m("button", {
                              title: "Add as Background",
                              class: "w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer",
                              onclick: () => this.handlePexelsAdd(item, "background")
                            }, m("i", { class: "icon-[ri--image-line] w-4 h-4" })),
                            m("button", {
                              title: "Add as Overlay",
                              class: "w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shadow-lg transition-all hover:scale-110 cursor-pointer",
                              onclick: () => this.handlePexelsAdd(item, "overlay")
                            }, m("i", { class: "icon-[ri--image-add-line] w-4 h-4" }))
                          ]),
                          profileUrl && m("a", {
                            href: profileUrl,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            class: "text-[9px] text-slate-400 hover:text-blue-400 font-semibold transition-colors flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full pointer-events-auto cursor-pointer"
                          }, [
                            m("i", { class: "icon-[ri--external-link-line] w-2.5 h-2.5" }),
                            `By ${artist || "Pexels"}`
                          ])
                        ])
                  ]);
                })
              ),

              // Load More Button
              (this.hasMorePexels || items.length > this.pexelsVisibleCount) && m("div", { class: "flex items-center justify-center border-t border-slate-800 pt-4 mt-4" }, [
                m("button", {
                  class: "w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-wait",
                  disabled: this.isSearchingPexels,
                  onclick: () => this.loadMorePexels()
                }, [
                  this.isSearchingPexels 
                    ? [m("div", { class: "animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" }), "Loading More..."]
                    : [m("i", { class: "icon-[ri--arrow-down-s-line] w-3.5 h-3.5" }), "Load More"]
                ])
              ])
            ]);
          })()
        ]),

        // 4. EMOJI TAB WITH NOTO EMOJI ANIMATION
        this.activeSubTab === "emoji" && (
          !this.emojisData
            ? m("div", { class: "py-12 flex flex-col items-center justify-center gap-3" }, [
                m("div", { class: "animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" }),
                m("p", { class: "text-xs text-slate-500 font-semibold" }, "Loading animated emojis...")
              ])
            : m("div", { class: "space-y-3" }, [
                // Emoji Search
                m("div", { class: "flex items-center gap-2" }, [
                  m("div", { class: "relative flex-1" }, [
                    m("input", {
                      type: "text",
                      placeholder: "Search animated emojis...",
                      class: "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50",
                      value: this.emojiQuery || "",
                      oninput: (e) => {
                        this.emojiQuery = e.target.value;
                        this.emojiVisibleCount = 24;
                      },
                      onkeydown: (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }
                    }),
                    m("i", { class: "icon-[ri--search-line] absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" })
                  ])
                ]),

                // Emoji Category Pills
                (() => {
                  const emojiCategories = [
                    { id: "all", label: "All" },
                    { id: "Smileys and emotions", label: "Smileys" },
                    { id: "People", label: "People" },
                    { id: "Animals and nature", label: "Animals" },
                    { id: "Food and drink", label: "Food" },
                    { id: "Travel and places", label: "Places" },
                    { id: "Activities and events", label: "Activities" },
                    { id: "Objects", label: "Objects" },
                    { id: "Symbols", label: "Symbols" },
                    { id: "Flags", label: "Flags" }
                  ];

                  return m("div", { class: "flex gap-1 overflow-x-auto pb-1 mb-1 scrollbar-none snap-x" },
                    emojiCategories.map(cat => {
                      const isSel = this.emojiCategory === cat.id;
                      return m("button", {
                        class: `px-2.5 py-1 text-[9px] font-bold rounded-full transition-all cursor-pointer shrink-0 snap-start uppercase tracking-wider ${isSel ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20" : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750 border border-transparent"}`,
                        onclick: () => {
                          this.emojiCategory = cat.id;
                          this.emojiVisibleCount = 24;
                        }
                      }, cat.label);
                    })
                  );
                })(),

                // Emoji Grid
                (() => {
                  let filteredEmojis = [];
                  const categories = this.emojisData?.categories || [];

                  if (this.emojiCategory === "all") {
                    filteredEmojis = categories.flatMap(cat => 
                      (cat.items || []).map(item => ({ ...item, category: cat.id }))
                    );
                  } else {
                    const activeCat = categories.find(cat => cat.id === this.emojiCategory);
                    if (activeCat) {
                      filteredEmojis = (activeCat.items || []).map(item => ({ ...item, category: activeCat.id }));
                    }
                  }

                  if (this.emojiQuery && this.emojiQuery.trim()) {
                    const q = this.emojiQuery.toLowerCase().trim();
                    filteredEmojis = filteredEmojis.filter(e => e.tag.toLowerCase().includes(q));
                  }

                  if (filteredEmojis.length === 0) {
                    return m("div", { class: "p-8 border border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center gap-2" }, [
                      m("i", { class: "icon-[ri--emotion-unhappy-line] w-8 h-8 text-slate-700" }),
                      m("p", { class: "text-xs text-slate-500 font-medium" }, "No emojis found matching filters.")
                    ]);
                  }

                  const visibleEmojis = filteredEmojis.slice(0, this.emojiVisibleCount);

                  return m("div", { class: "space-y-4" }, [
                    m("div", { class: "grid grid-cols-3 gap-2" },
                      visibleEmojis.map(emoji => {
                        const isLoading = this.loadingAssetId === `emoji-${emoji.codepoint}`;
                        const isHovered = this.hoveredEmojiCodepoint === emoji.codepoint;
                        return m("div", {
                          class: "relative group aspect-square rounded-xl bg-slate-950/40 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/50 flex items-center justify-center p-2.5 transition-all cursor-pointer overflow-hidden",
                          onmouseenter: () => {
                            if (this.hoverTimeout) {
                              clearTimeout(this.hoverTimeout);
                            }
                            this.hoverScheduledCodepoint = emoji.codepoint;
                            this.hoverTimeout = setTimeout(() => {
                              if (this.hoverScheduledCodepoint === emoji.codepoint) {
                                this.hoveredEmojiCodepoint = emoji.codepoint;
                                m.redraw();
                              }
                            }, 250);
                          },
                          onmouseleave: () => {
                            if (this.hoverScheduledCodepoint === emoji.codepoint) {
                              if (this.hoverTimeout) {
                                clearTimeout(this.hoverTimeout);
                                this.hoverTimeout = null;
                              }
                              this.hoverScheduledCodepoint = null;
                            }
                            if (this.hoveredEmojiCodepoint === emoji.codepoint) {
                              this.hoveredEmojiCodepoint = null;
                              m.redraw();
                            }
                          },
                          onclick: () => {
                            if (!isLoading) this.handleEmojiAdd(emoji);
                          }
                        }, [
                          m("img", {
                            src: isHovered
                              ? `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.gif`
                              : `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.png`,
                            alt: emoji.tag,
                            loading: "lazy",
                            class: "w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-200"
                          }),

                          isLoading 
                            ? m("div", { class: "absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1" }, [
                                m("div", { class: "animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent" }),
                                m("span", { class: "text-[7px] text-blue-400 font-bold uppercase tracking-wider" }, "Importing")
                              ])
                            : m("div", {
                                class: "absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none"
                              }, [
                                m("i", { class: "icon-[ri--add-line] w-3.5 h-3.5" })
                              ])
                        ]);
                      })
                    ),

                    // Load More Button
                    filteredEmojis.length > this.emojiVisibleCount && m("div", { class: "flex items-center justify-center border-t border-slate-800 pt-3 mt-1" }, [
                      m("button", {
                        class: "w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5",
                        onclick: () => this.emojiVisibleCount += 24
                      }, [
                        m("i", { class: "icon-[ri--arrow-down-s-line] w-3.5 h-3.5" }),
                        "Load More"
                      ])
                    ])
                  ]);
                })()
              ])
        )

      ])
    ]);
  }
};
