import { useEffect, useReducer, useState } from "react";

interface CharsData {
  categories: Array<{
    id: string;
    name: string;
    icon: string;
    items: string[];
  }>;
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
      setActiveCategory(
        (module.default as unknown as CharsData).categories[0].id,
      );
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
      scrollParents.forEach((el) =>
        el.removeEventListener("scroll", forceUpdate),
      );
    };
  }, [trigger]);

  const coords = computeCoords(trigger);

  if (!charsData) {
    return (
      <div
        className="animate-in fade-in zoom-in-95 fixed z-9999 flex items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl duration-200"
        style={{
          width: "288px",
          height: "200px",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <i className="icon-[ri--loader-4-line] animate-spin text-2xl text-blue-500" />
          <span className="text-[10px] font-medium text-slate-500">
            Loading emojis...
          </span>
        </div>
      </div>
    );
  }

  const categories = charsData.categories;
  const activeCat = categories.find((c) => c.id === activeCategory);

  // Filter items based on search
  let items = activeCat ? activeCat.items : [];
  if (searchQuery) {
    items = categories
      .flatMap((c) => c.items)
      .filter((item) => item.includes(searchQuery));
    items = items.slice(0, 100);
  }

  return (
    <div
      className="animate-in fade-in zoom-in-95 fixed z-9999 flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl duration-200"
      style={{
        width: "288px",
        maxHeight: "400px",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
    >
      {/* Header / Search */}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/50 p-3">
        <div className="relative flex-1">
          <i className="absolute top-1/2 left-2 icon-[ri--search-line] -translate-y-1/2 text-xs text-slate-500" />
          <input
            type="text"
            placeholder="Search characters..."
            className="w-full rounded-md border-none bg-slate-800 py-1.5 pr-3 pl-8 text-xs text-white outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800"
          onClick={onClose}
        >
          <i className="icon-[ri--close-line] text-sm" />
        </button>
      </div>

      {/* Categories Tab */}
      {!searchQuery && (
        <div className="flex min-h-11.5 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-800 bg-slate-950/50 px-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`shrink-0 rounded-lg px-2 py-1 text-lg transition-all ${
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
      <div className="custom-scrollbar grid flex-1 grid-cols-8 gap-1 overflow-y-auto bg-slate-900 p-2">
        {items.map((item, i) => (
          <button
            key={`${item}-${i}`}
            className="flex aspect-square items-center justify-center rounded-lg text-xl transition-all hover:bg-slate-800 active:scale-90"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 p-2">
        <span className="text-[10px] font-medium text-slate-500">
          {searchQuery ? `Found ${items.length} items` : activeCat?.name}
        </span>
        <div className="flex gap-1" />
      </div>
    </div>
  );
};
