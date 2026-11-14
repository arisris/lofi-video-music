import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../../shared/ui/EmptyState";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import { addClipOfType } from "../dock/clip-actions";
import {
  getAllIconIds,
  getIconData,
  hasIcons,
  populateIcons,
} from "../../shared/lib/icon-cache";

interface ShapeEntry {
  name: string;
  settings: Record<string, unknown>;
  svg: string;
  svgStyle?: string;
  desc?: string;
}

const BASIC_SHAPES: ShapeEntry[] = [
  {
    name: "Rectangle",
    settings: { shapeType: "rectangle", cornerRadius: 12, fillType: "solid", fillColor: "#10b981", width: 150, height: 150 },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-emerald-400" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>`,
  },
  {
    name: "Circle",
    settings: { shapeType: "circle", fillType: "solid", fillColor: "#3b82f6", width: 150, height: 150 },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-blue-400" fill="currentColor"><circle cx="12" cy="12" r="9" /></svg>`,
  },
  {
    name: "Triangle",
    settings: { shapeType: "triangle", fillType: "solid", fillColor: "#f59e0b", width: 150, height: 150 },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-amber-400" fill="currentColor"><polygon points="12,3 21,20 3,20" /></svg>`,
  },
  {
    name: "Hexagon",
    settings: { shapeType: "polygon", polygonSides: 6, fillType: "solid", fillColor: "#8b5cf6", width: 150, height: 150 },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-violet-400" fill="currentColor"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" /></svg>`,
  },
  {
    name: "Star",
    settings: { shapeType: "star", starSpikes: 5, starInnerRatio: 0.4, fillType: "solid", fillColor: "#ec4899", width: 150, height: 150 },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-pink-400" fill="currentColor"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" /></svg>`,
  },
  {
    name: "Heart",
    settings: { shapeType: "heart", fillType: "solid", fillColor: "#ef4444", width: 150, height: 150 },
    svg: `<svg viewBox="0 0 24 24" class="w-8 h-8 text-red-400" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>`,
  },
];

const PREMIUM_SHAPES: ShapeEntry[] = [
  {
    name: "Neon Ring",
    desc: "Glowing cyan circle overlay",
    settings: { shapeType: "circle", fillType: "solid", fillColor: "transparent", strokeColor: "#06b6d4", strokeWidth: 6, shadowColor: "#06b6d4", shadowBlur: 15, shadowOffsetX: 0, shadowOffsetY: 0, width: 180, height: 180 },
    svgStyle: "background: radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0) 70%); border-color: rgba(6,182,212,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 text-cyan-400 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="8" /></svg>`,
  },
  {
    name: "Glass Card",
    desc: "Frosted glassmorphic card",
    settings: { shapeType: "rectangle", cornerRadius: 16, fillType: "solid", fillColor: "rgba(255, 255, 255, 0.12)", strokeColor: "rgba(255, 255, 255, 0.25)", strokeWidth: 1.5, shadowColor: "rgba(0, 0, 0, 0.35)", shadowBlur: 16, shadowOffsetX: 0, shadowOffsetY: 6, width: 240, height: 140 },
    svgStyle: "background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(4px); border-color: rgba(255,255,255,0.15);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 text-white/70" fill="currentColor" stroke="rgba(255,255,255,0.4)" stroke-width="1"><rect x="3" y="5" width="18" height="14" rx="3" /></svg>`,
  },
  {
    name: "Cosmic Heart",
    desc: "Pulsing gradient heart shape",
    settings: { shapeType: "heart", fillType: "gradient", fillColor: "#a855f7", fillColor2: "#ec4899", shadowColor: "#ec4899", shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 0, width: 150, height: 150, animations: { inType: "zoom-in", outType: "zoom-out", type: "pulse", audioReactive: true } },
    svgStyle: "background: linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.15) 100%); border-color: rgba(236,72,153,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 filter drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]"><defs><linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7" /><stop offset="100%" stop-color="#ec4899" /></linearGradient></defs><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#heartGrad)" /></svg>`,
  },
  {
    name: "Sunburst Star",
    desc: "8-point glowing star preset",
    settings: { shapeType: "star", starSpikes: 8, starInnerRatio: 0.45, fillType: "gradient", fillColor: "#f97316", fillColor2: "#eab308", shadowColor: "#f97316", shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 0, width: 160, height: 160, animations: { inType: "fade", outType: "fade", type: "float", audioReactive: false } },
    svgStyle: "background: linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(234,179,8,0.15) 100%); border-color: rgba(234,179,8,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 filter drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]"><defs><linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f97316" /><stop offset="100%" stop-color="#eab308" /></linearGradient></defs><polygon points="12,2 14,8 20,8 15,12 17,18 12,14 7,18 9,12 4,8 10,8" fill="url(#starGrad)" /></svg>`,
  },
  {
    name: "Cyber Prism",
    desc: "Swinging cyan triangle wireframe",
    settings: { shapeType: "triangle", fillType: "solid", fillColor: "transparent", strokeColor: "#06b6d4", strokeWidth: 4, shadowColor: "#06b6d4", shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 0, width: 160, height: 160, animations: { inType: "slide-down", outType: "fade", type: "swing", audioReactive: true } },
    svgStyle: "background: radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0) 70%); border-color: rgba(6,182,212,0.3);",
    svg: `<svg viewBox="0 0 24 24" class="w-12 h-12 text-cyan-400 filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,4 20,19 4,19" /></svg>`,
  },
];

const CURATED_ICONS = [
  // Music
  "ri:music-2-fill",
  "ri:music-line",
  "ri:headphone-fill",
  "ri:disc-fill",
  "ri:equalizer-fill",
  "mdi:music-note",
  "mdi:playlist-music",
  // Nature
  "ri:moon-clear-fill",
  "ri:sun-fill",
  "ri:cloud-windy-fill",
  "ri:rainy-fill",
  "ri:leaf-fill",
  "ri:fire-fill",
  "mdi:weather-night",
  // Lofi
  "ri:cup-fill",
  "ri:book-open-fill",
  "ri:zzz-fill",
  "ri:home-2-fill",
  "mdi:coffee",
  "mdi:laptop",
  "mdi:controller",
  // Vibes
  "ri:heart-fill",
  "ri:star-fill",
  "ri:sparkling-fill",
  "ri:emotion-happy-fill",
  "mdi:heart",
  "mdi:star",
  "mdi:emoticon-cool",
];

/** Async icon preview cell: loads the SVG body from the local icon database. */
const IconPreview = ({ iconId }: { iconId: string }) => {
  const [svgText, setSvgText] = useState("");
  const loadedIdRef = useRef("");

  if (loadedIdRef.current !== iconId) {
    loadedIdRef.current = iconId;
    getIconData(iconId).then((data: unknown) => {
      const d = data as { width: number; height: number; body: string } | null;
      setSvgText(
        d
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.width} ${d.height}" class="w-6 h-6 text-neutral-400 group-hover:text-blue-400 transition-colors" fill="currentColor">${d.body}</svg>`
          : "",
      );
    });
  }

  if (!svgText) {
    return <div className="h-6 w-6 animate-pulse rounded bg-neutral-800/80" />;
  }
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center"
      dangerouslySetInnerHTML={{ __html: svgText }}
    />
  );
};

type ActiveTab = "shapes" | "icons";

export const ShapePanel = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("shapes");
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [allIconIds, setAllIconIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);

  const checkDb = () => {
    hasIcons().then((exists: unknown) => {
      setDbInitialized(Boolean(exists));
      if (exists) {
        getAllIconIds().then((ids: string[]) => setAllIconIds(ids));
      }
    });
  };

  const initializeDb = () => {
    setIsInitializing(true);
    populateIcons((txt: string) => setProgressText(txt))
      .then(() => {
        setDbInitialized(true);
        setIsInitializing(false);
        checkDb();
      })
      .catch((err: unknown) => {
        console.error("Database population failed:", err);
        alert("Failed to initialize offline database. Please check console logs.");
        setIsInitializing(false);
      });
  };

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    if (!val) {
      setSearchResults([]);
      return;
    }
    const q = val.toLowerCase();
    setSearchResults(
      allIconIds.filter((id) => id.toLowerCase().includes(q)).slice(0, 80),
    );
  };

  useEffect(checkDb, []);

  const addShape = (shapeConfig: Record<string, unknown>) => {
    addClipOfType("shape", shapeConfig);
  };

  const addIcon = (iconId: string) => {
    addClipOfType("shape", {
      shapeType: "icon",
      iconName: iconId,
      fillType: "solid",
      fillColor: "#ffffff",
      width: 120,
      height: 120,
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900/50 p-4 text-neutral-200">
      <div className="mb-4 flex shrink-0 rounded-xl border border-neutral-800/80 bg-neutral-950 p-1">
        {(
          [
            ["shapes", "Shapes", "icon-[ri--shapes-line]"],
            ["icons", "Icons", "icon-[ri--emotion-line]"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
              activeTab === id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            onClick={() => setActiveTab(id)}
          >
            <i className={`${icon} h-4 w-4`} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "shapes" ? (
          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-1">
            <div className="space-y-3">
              <SectionTitle className="">
                Add Basic Shape
            </SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {BASIC_SHAPES.map((shape) => (
                  <button
                    key={shape.name}
                    className="group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-2.5 text-center transition-all hover:scale-[1.03] hover:border-blue-500/30 hover:bg-blue-600/10"
                    onClick={() => addShape(shape.settings)}
                  >
                    <div dangerouslySetInnerHTML={{ __html: shape.svg }} />
                    <span className="text-[10px] font-bold text-neutral-300 transition-colors group-hover:text-white">
                      {shape.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionTitle className="">
                Premium Presets
            </SectionTitle>
              <div className="flex flex-col gap-3">
                {PREMIUM_SHAPES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    className="hover:border-neutral-650 group flex cursor-pointer items-center justify-between gap-4 overflow-hidden rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-3 text-left transition-all hover:scale-[1.01] hover:bg-neutral-800"
                    onClick={() => addShape(tmpl.settings)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        ref={(el) => {
                          if (el) el.style.cssText = tmpl.svgStyle ?? "";
                        }}
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-neutral-950"
                      >
                        <div dangerouslySetInnerHTML={{ __html: tmpl.svg }} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-200 transition-colors group-hover:text-blue-400">
                          {tmpl.name}
                        </span>
                        <span className="text-[10px] leading-snug text-neutral-500">
                          {tmpl.desc}
                        </span>
                      </div>
                    </div>
                    <i className="icon-[ri--add-circle-line] h-5 w-5 shrink-0 text-neutral-600 transition-all group-hover:scale-110 group-hover:text-blue-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : !dbInitialized ? (
          /* Database Setup Screen */
          <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
              <i className="icon-[ri--database-2-line] h-8 w-8 text-blue-400" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-neutral-200">
                Local Icon Database
              </h4>
              <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
                Load 9,000+ Remix & Material Design Icons directly from local
                dependencies into browser database for offline search and
                customization.
              </p>
            </div>
            {isInitializing ? (
              <div className="mt-2 w-full space-y-2">
                <div className="flex animate-pulse items-center justify-between px-1 text-[10px] font-bold tracking-widest text-blue-400 uppercase">
                  <span>Initializing...</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-950">
                  <div className="animate-in slide-in-from-left h-full w-full bg-blue-500 duration-1000" />
                </div>
                <p className="mt-1.5 text-[9px] text-neutral-500 italic">
                  {progressText}
                </p>
              </div>
            ) : (
              <button
                className="w-full cursor-pointer rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition-all hover:bg-blue-500"
                onClick={initializeDb}
              >
                Initialize Icon Library
              </button>
            )}
          </div>
        ) : (
          /* Search and Icon Browser Screen */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="relative mb-4 shrink-0">
              <input
                type="text"
                placeholder="Search 9,000+ local icons..."
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pr-4 pl-9 text-xs text-white transition-all outline-none focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <i className="absolute top-1/2 left-3 icon-[ri--search-line] h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
              {searchQuery ? (
                searchResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {searchResults.map((id) => (
                      <button
                        key={id}
                        title={id}
                        className="group flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-2 transition-all hover:scale-[1.05] hover:border-blue-500/30 hover:bg-blue-600/10"
                        onClick={() => addIcon(id)}
                      >
                        <IconPreview iconId={id} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState>
                    No icons found matching your query.
                  </EmptyState>
                )
              ) : (
                <div className="space-y-4">
                  <SectionTitle className="">
                    Popular Lofi Icons
            </SectionTitle>
                  <div className="grid grid-cols-4 gap-2">
                    {CURATED_ICONS.map((id) => (
                      <button
                        key={id}
                        title={id}
                        className="group flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-2 transition-all hover:scale-[1.05] hover:border-blue-500/30 hover:bg-blue-600/10"
                        onClick={() => addIcon(id)}
                      >
                        <IconPreview iconId={id} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
