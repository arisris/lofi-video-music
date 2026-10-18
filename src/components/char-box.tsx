import { useEffect, useReducer, useState } from "react";

interface CharsData {
  categories: Array<{ id: string; name: string; icon: string; items: string[] }>;
}

interface CharBoxProps {
  /** Anchor element used to position the floating picker. */
  trigger: HTMLElement | null;
  onSelect: (char: string) => void;
  onClose: () => void;
}

const computeCoords = (trigger: HTMLElement | null) => {
  if (!trigger) return { top: 0, left: 0 };
  const rect = trigger.getBoundingClientRect();
  const boxWidth = 288;
  const boxHeight = 350;

  let left = rect.left;
  let top = rect.top - boxHeight - 8;

  // Boundary check - Right
  if (left + boxWidth > window.innerWidth - 16) {
    left = window.innerWidth - boxWidth - 16;
  }
  if (left < 16) left = 16;

  // Boundary check - Top (if no space above, show below)
  if (top < 16) {
    top = rect.bottom + 8;
  }

  return { top, left };
};

/** Floating emoji & special character picker anchored to a trigger element. */
export const CharBox = ({ trigger, onSelect, onClose }: CharBoxProps) => {
  const [charsData, setCharsData] = useState<CharsData | null>(null);
  const [activeCategory, setActiveCategory] = useState("smileys");
  const [searchQuery, setSearchQuery] = useState("");
  const [, forceUpdate] = useReducer((c: number) => c + 1, 0);

  // Lazily load the character dataset
  useEffect(() => {
    let cancelled = false;
    import("../data/chars.json").then((module) => {
      if (cancelled) return;
      setCharsData(module.default as unknown as CharsData);
      setActiveCategory((module.default as unknown as CharsData).categories[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Track positioning updates on resize / ancestor scrolls
  useEffect(() => {
    forceUpdate();
    window.addEventListener("resize", forceUpdate);
    const scrollParents: HTMLElement[] = [];
    let parent = trigger?.parentElement ?? null;
    while (parent) {
      if (window.getComputedStyle(parent).overflowY !== "visible") {
        parent.addEventListener("scroll", forceUpdate);
        scrollParents.push(parent);
      }
      parent = parent.parentElement;
    }
    return () => {
      window.removeEventListener("resize", forceUpdate);
      scrollParents.forEach((el) => el.removeEventListener("scroll", forceUpdate));
    };
  }, [trigger]);

  const coords = computeCoords(trigger);

  if (!charsData) {
    return (
      <div
        className="fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] flex items-center justify-center animate-in fade-in zoom-in-95 duration-200"
        style={{ width: "288px", height: "200px", top: `${coords.top}px`, left: `${coords.left}px` }}
      >
        <div className="flex flex-col items-center gap-2">
          <i className="icon-[ri--loader-4-line] animate-spin text-blue-500 text-2xl" />
          <span className="text-[10px] text-slate-500 font-medium">Loading emojis...</span>
        </div>
      </div>
    );
  }

  const categories = charsData.categories;
  const activeCat = categories.find((c) => c.id === activeCategory);

  // Filter items based on search
  let items = activeCat ? activeCat.items : [];
  if (searchQuery) {
    items = categories.flatMap((c) => c.items).filter((item) => item.includes(searchQuery));
    items = items.slice(0, 100);
  }

  return (
    <div
      className="fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] flex flex-col animate-in fade-in zoom-in-95 duration-200"
      style={{ width: "288px", maxHeight: "400px", top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      {/* Header / Search */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
        <div className="relative flex-1">
          <i className="icon-[ri--search-line] absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
          <input
            type="text"
            placeholder="Search characters..."
            className="w-full bg-slate-800 border-none rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="p-1.5 hover:bg-slate-800 rounded-md text-slate-500 transition-colors"
          onClick={onClose}
        >
          <i className="icon-[ri--close-line] text-sm" />
        </button>
      </div>

      {/* Categories Tab */}
      {!searchQuery && (
        <div className="flex bg-slate-950/50 px-1 gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-800 min-h-[46px] items-center">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`flex-shrink-0 px-2 py-1 rounded-lg text-lg transition-all ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
              title={cat.name}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-1 custom-scrollbar bg-slate-900">
        {items.map((item, i) => (
          <button
            key={`${item}-${i}`}
            className="aspect-square flex items-center justify-center text-xl hover:bg-slate-800 rounded-lg transition-all active:scale-90"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center">
        <span className="text-[10px] text-slate-500 font-medium">
          {searchQuery ? `Found ${items.length} items` : activeCat?.name}
        </span>
        <div className="flex gap-1" />
      </div>
    </div>
  );
};
