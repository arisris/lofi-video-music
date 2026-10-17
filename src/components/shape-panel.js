import m from "mithril";
import { addClipToTimeline } from "../lib/clip-factory";
import { hasIcons, populateIcons, getAllIconIds, getIconFromDb } from "../utils/indexed-db";

const BASIC_SHAPES = [
  {
    name: "Rectangle",
    settings: {
      shapeType: "rectangle",
      cornerRadius: 12,
      fillType: "solid",
      fillColor: "#10b981",
      width: 150,
      height: 150,
    },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-emerald-400" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>`
  },
  {
    name: "Circle",
    settings: {
      shapeType: "circle",
      fillType: "solid",
      fillColor: "#3b82f6",
      width: 150,
      height: 150,
    },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-blue-400" fill="currentColor"><circle cx="12" cy="12" r="9" /></svg>`
  },
  {
    name: "Triangle",
    settings: {
      shapeType: "triangle",
      fillType: "solid",
      fillColor: "#f59e0b",
      width: 150,
      height: 150,
    },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-amber-400" fill="currentColor"><polygon points="12,3 21,20 3,20" /></svg>`
  },
  {
    name: "Hexagon",
    settings: {
      shapeType: "polygon",
      polygonSides: 6,
      fillType: "solid",
      fillColor: "#8b5cf6",
      width: 150,
      height: 150,
    },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-violet-400" fill="currentColor"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" /></svg>`
  },
  {
    name: "Star",
    settings: {
      shapeType: "star",
      starSpikes: 5,
      starInnerRatio: 0.4,
      fillType: "solid",
      fillColor: "#ec4899",
      width: 150,
      height: 150,
    },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-pink-400" fill="currentColor"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" /></svg>`
  },
  {
    name: "Heart",
    settings: {
      shapeType: "heart",
      fillType: "solid",
      fillColor: "#ef4444",
      width: 150,
      height: 150,
    },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-red-400" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>`
  }
];

const PREMIUM_SHAPES = [
  {
    name: "Neon Ring",
    desc: "Glowing cyan circle overlay",
    settings: {
      shapeType: "circle",
      fillType: "solid",
      fillColor: "transparent",
      strokeColor: "#06b6d4",
      strokeWidth: 6,
      shadowColor: "#06b6d4",
      shadowBlur: 15,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      width: 180,
      height: 180,
    },
    svgStyle: "background: radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0) 70%); border-color: rgba(6,182,212,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 text-cyan-400 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="8" /></svg>`
  },
  {
    name: "Glass Card",
    desc: "Frosted glassmorphic card",
    settings: {
      shapeType: "rectangle",
      cornerRadius: 16,
      fillType: "solid",
      fillColor: "rgba(255, 255, 255, 0.12)",
      strokeColor: "rgba(255, 255, 255, 0.25)",
      strokeWidth: 1.5,
      shadowColor: "rgba(0, 0, 0, 0.35)",
      shadowBlur: 16,
      shadowOffsetX: 0,
      shadowOffsetY: 6,
      width: 240,
      height: 140,
    },
    svgStyle: "background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(4px); border-color: rgba(255,255,255,0.15);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 text-white/70" fill="currentColor" stroke="rgba(255,255,255,0.4)" stroke-width="1"><rect x="3" y="5" width="18" height="14" rx="3" /></svg>`
  },
  {
    name: "Cosmic Heart",
    desc: "Pulsing gradient heart shape",
    settings: {
      shapeType: "heart",
      fillType: "gradient",
      fillColor: "#a855f7",
      fillColor2: "#ec4899",
      shadowColor: "#ec4899",
      shadowBlur: 12,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      width: 150,
      height: 150,
      animations: {
        inType: "zoom-in",
        outType: "zoom-out",
        type: "pulse",
        audioReactive: true
      }
    },
    svgStyle: "background: linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.15) 100%); border-color: rgba(236,72,153,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 filter drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]"><defs><linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7" /><stop offset="100%" stop-color="#ec4899" /></linearGradient></defs><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#heartGrad)" /></svg>`
  },
  {
    name: "Sunburst Star",
    desc: "8-point glowing star preset",
    settings: {
      shapeType: "star",
      starSpikes: 8,
      starInnerRatio: 0.45,
      fillType: "gradient",
      fillColor: "#f97316",
      fillColor2: "#eab308",
      shadowColor: "#f97316",
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      width: 160,
      height: 160,
      animations: {
        inType: "fade",
        outType: "fade",
        type: "float",
        audioReactive: false
      }
    },
    svgStyle: "background: linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(234,179,8,0.15) 100%); border-color: rgba(234,179,8,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 filter drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]"><defs><linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f97316" /><stop offset="100%" stop-color="#eab308" /></linearGradient></defs><polygon points="12,2 14,8 20,8 15,12 17,18 12,14 7,18 9,12 4,8 10,8" fill="url(#starGrad)" /></svg>`
  },
  {
    name: "Cyber Prism",
    desc: "Swinging cyan triangle wireframe",
    settings: {
      shapeType: "triangle",
      fillType: "solid",
      fillColor: "transparent",
      strokeColor: "#06b6d4",
      strokeWidth: 4,
      shadowColor: "#06b6d4",
      shadowBlur: 12,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      width: 160,
      height: 160,
      animations: {
        inType: "slide-down",
        outType: "fade",
        type: "swing",
        audioReactive: true
      }
    },
    svgStyle: "background: radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0) 70%); border-color: rgba(6,182,212,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 text-cyan-400 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,4 20,19 4,19" /></svg>`
  }
];

const CURATED_ICONS = [
  // Music
  "ri:music-2-fill", "ri:music-line", "ri:headphone-fill", "ri:disc-fill", "ri:equalizer-fill", "mdi:music-note", "mdi:playlist-music",
  // Nature
  "ri:moon-clear-fill", "ri:sun-fill", "ri:cloud-windy-fill", "ri:rainy-fill", "ri:leaf-fill", "ri:fire-fill", "mdi:weather-night",
  // Lofi
  "ri:cup-fill", "ri:book-open-fill", "ri:zzz-fill", "ri:home-2-fill", "mdi:coffee", "mdi:laptop", "mdi:controller",
  // Vibes
  "ri:heart-fill", "ri:star-fill", "ri:sparkles-fill", "ri:emotion-happy-fill", "mdi:heart", "mdi:star", "mdi:emoticon-cool"
];

// Async Icon preview component for grids
const IconPreview = {
  oninit(vnode) {
    vnode.state.svgText = "";
    this.loadedId = "";
  },
  view(vnode) {
    const iconId = vnode.attrs.iconId;
    if (this.loadedId !== iconId) {
      this.loadedId = iconId;
      getIconFromDb(iconId).then(data => {
        if (data) {
          vnode.state.svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.width} ${data.height}" class="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors" fill="currentColor">${data.body}</svg>`;
        } else {
          vnode.state.svgText = "";
        }
        m.redraw();
      });
    }

    if (!vnode.state.svgText) {
      return m("div", { class: "w-6 h-6 bg-slate-800/80 animate-pulse rounded" });
    }
    return m("div", { class: "w-6 h-6 flex items-center justify-center shrink-0" }, m.trust(vnode.state.svgText));
  }
};

export const ShapePanel = {
  oninit(vnode) {
    vnode.state.activeTab = "shapes";
    vnode.state.dbInitialized = false;
    vnode.state.isInitializing = false;
    vnode.state.progressText = "";
    vnode.state.allIconIds = [];
    vnode.state.searchQuery = "";
    vnode.state.searchResults = [];

    vnode.state.checkDb = () => {
      hasIcons().then(exists => {
        vnode.state.dbInitialized = exists;
        if (exists) {
          getAllIconIds().then(ids => {
            vnode.state.allIconIds = ids;
            m.redraw();
          });
        }
        m.redraw();
      });
    };

    vnode.state.initializeDb = () => {
      vnode.state.isInitializing = true;
      populateIcons((txt) => {
        vnode.state.progressText = txt;
        m.redraw();
      }).then(() => {
        vnode.state.dbInitialized = true;
        vnode.state.isInitializing = false;
        vnode.state.checkDb();
      }).catch(err => {
        console.error("Database population failed:", err);
        alert("Failed to initialize offline database. Please check console logs.");
        vnode.state.isInitializing = false;
        m.redraw();
      });
    };

    vnode.state.handleSearch = (val) => {
      vnode.state.searchQuery = val;
      if (!val) {
        vnode.state.searchResults = [];
        return;
      }
      const q = val.toLowerCase();
      vnode.state.searchResults = vnode.state.allIconIds
        .filter(id => id.toLowerCase().includes(q))
        .slice(0, 80);
    };

    vnode.state.checkDb();
  },

  view(vnode) {
    const state = vnode.state;

    const addShape = (shapeConfig) => {
      addClipToTimeline("shape", shapeConfig);
    };

    const addIcon = (iconId) => {
      addClipToTimeline("shape", {
        shapeType: "icon",
        iconName: iconId,
        fillType: "solid",
        fillColor: "#ffffff",
        width: 120,
        height: 120
      });
    };

    return m("div", { class: "bg-slate-900/50 p-4 flex flex-col h-full w-full overflow-hidden text-slate-200" }, [
      // 1. Tab Switcher
      m("div", { class: "flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 mb-4 shrink-0" }, [
        m("button", {
          class: `flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            state.activeTab === "shapes" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
          }`,
          onclick: () => state.activeTab = "shapes"
        }, [
          m("i", { class: "icon-[ri--shapes-line] w-4 h-4" }),
          "Shapes"
        ]),
        m("button", {
          class: `flex-1 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
            state.activeTab === "icons" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-slate-200"
          }`,
          onclick: () => state.activeTab = "icons"
        }, [
          m("i", { class: "icon-[ri--emotion-line] w-4 h-4" }),
          "Icons"
        ])
      ]),

      // 2. Tab Content Area
      m("div", { class: "flex-1 overflow-hidden flex flex-col" }, [
        state.activeTab === "shapes"
          ? m("div", { class: "flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6" }, [
              // Basic Shapes
              m("div", { class: "space-y-3" }, [
                m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Add Basic Shape"),
                m("div", { class: "grid grid-cols-3 gap-2" }, 
                  BASIC_SHAPES.map(shape =>
                    m("button", {
                      class: "p-2.5 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1.5 group cursor-pointer hover:scale-[1.03]",
                      onclick: () => addShape(shape.settings)
                    }, [
                      m.trust(shape.svg),
                      m("span", { class: "text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors" }, shape.name),
                    ])
                  )
                )
              ]),

              // Premium Presets
              m("div", { class: "space-y-3" }, [
                m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Premium Presets"),
                m("div", { class: "flex flex-col gap-3" }, 
                  PREMIUM_SHAPES.map(tmpl =>
                    m("button", {
                      class: "p-3 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-650 rounded-xl transition-all flex items-center justify-between text-left gap-4 cursor-pointer group hover:scale-[1.01] overflow-hidden",
                      onclick: () => addShape(tmpl.settings)
                    }, [
                      m("div", { class: "flex items-center gap-3" }, [
                        m("div", { 
                          class: "w-16 h-16 rounded-lg border flex items-center justify-center bg-slate-950 shrink-0",
                          style: tmpl.svgStyle 
                        }, m.trust(tmpl.svg)),
                        m("div", { class: "flex flex-col" }, [
                          m("span", { class: "text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors" }, tmpl.name),
                          m("span", { class: "text-[10px] text-slate-500 leading-snug" }, tmpl.desc),
                        ])
                      ]),
                      m("i", { class: "icon-[ri--add-circle-line] w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:scale-110 transition-all shrink-0" })
                    ])
                  )
                )
              ])
            ])
          : // Icons Tab Content
            !state.dbInitialized
              ? // Database Setup Screen
                m("div", { class: "flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4" }, [
                  m("div", { class: "w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center" }, 
                    m("i", { class: "icon-[ri--database-2-line] text-blue-400 w-8 h-8" })
                  ),
                  m("div", { class: "space-y-1" }, [
                    m("h4", { class: "text-sm font-bold text-slate-200" }, "Local Icon Database"),
                    m("p", { class: "text-xs text-slate-500 max-w-xs leading-relaxed" }, 
                      "Load 9,000+ Remix & Material Design Icons directly from local dependencies into browser database for offline search and customization."
                    ),
                  ]),
                  state.isInitializing
                    ? m("div", { class: "w-full space-y-2 mt-2" }, [
                        m("div", { class: "flex justify-between items-center text-[10px] font-bold text-blue-400 uppercase tracking-widest px-1 animate-pulse" }, [
                          m("span", "Initializing..."),
                        ]),
                        m("div", { class: "w-full h-1 bg-slate-950 rounded-full overflow-hidden" }, 
                          m("div", { class: "h-full bg-blue-500 animate-in slide-in-from-left duration-1000 w-full" })
                        ),
                        m("p", { class: "text-[9px] text-slate-500 italic mt-1.5" }, state.progressText)
                      ])
                    : m("button", {
                        class: "w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/15 cursor-pointer",
                        onclick: state.initializeDb
                      }, "Initialize Icon Library")
                ])
              : // Search and Icon Browser Screen
                m("div", { class: "flex-1 flex flex-col overflow-hidden" }, [
                  // Search Input
                  m("div", { class: "relative mb-4 shrink-0" }, [
                    m("input", {
                      type: "text",
                      placeholder: "Search 9,000+ local icons...",
                      class: "w-full bg-slate-950 text-white text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-800 focus:border-blue-500 outline-none transition-all",
                      value: state.searchQuery,
                      oninput: (e) => state.handleSearch(e.target.value)
                    }),
                    m("i", { class: "icon-[ri--search-line] absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" })
                  ]),

                  // Icon Grid
                  m("div", { class: "flex-1 overflow-y-auto pr-1 custom-scrollbar" }, [
                    state.searchQuery
                      ? // Search Results View
                        state.searchResults.length > 0
                          ? m("div", { class: "grid grid-cols-4 gap-2" }, 
                              state.searchResults.map(id =>
                                m("button", {
                                  key: id,
                                  title: id,
                                  class: "p-2 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl flex items-center justify-center min-h-[44px] transition-all group cursor-pointer hover:scale-[1.05]",
                                  onclick: () => addIcon(id)
                                }, m(IconPreview, { iconId: id }))
                              )
                            )
                          : m("div", { class: "text-center text-slate-500 text-xs italic py-8" }, "No icons found matching your query.")
                      : // Curated Default Icons View
                        m("div", { class: "space-y-4" }, [
                          m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Popular Lofi Icons"),
                          m("div", { class: "grid grid-cols-4 gap-2" }, 
                            CURATED_ICONS.map(id =>
                              m("button", {
                                key: id,
                                title: id,
                                class: "p-2 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-700/50 hover:border-blue-500/30 rounded-xl flex items-center justify-center min-h-[44px] transition-all group cursor-pointer hover:scale-[1.05]",
                                onclick: () => addIcon(id)
                              }, m(IconPreview, { iconId: id }))
                            )
                          )
                        ])
                  ])
                ])
      ])
    ]);
  }
};
