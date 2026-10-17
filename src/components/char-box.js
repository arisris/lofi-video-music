import m from "mithril";

export const CharBox = {
  charsData: null,
  activeCategory: "smileys",
  searchQuery: "",
  coords: { top: 0, left: 0 },

  async oninit() {
    if (!this.charsData) {
      const module = await import("../data/chars.json");
      this.charsData = module.default;
      this.activeCategory = this.charsData.categories[0].id;
      m.redraw();
    }
  },

  updateCoords(trigger) {
    if (!trigger) return;
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

    this.coords = { top, left };
  },

  oncreate({ attrs, dom }) {
    const trigger = attrs.trigger;
    this.updateCoords(trigger);

    // Track positioning updates on scroll/resize
    this._onUpdate = () => {
      this.updateCoords(trigger);
      m.redraw();
    };
    window.addEventListener("resize", this._onUpdate);
    
    // Find scrollable parent to listen to
    let parent = trigger.parentElement;
    while (parent) {
      if (window.getComputedStyle(parent).overflowY !== 'visible') {
          parent.addEventListener("scroll", this._onUpdate);
      }
      parent = parent.parentElement;
    }
  },

  onremove({ attrs }) {
    window.removeEventListener("resize", this._onUpdate);
    let parent = attrs.trigger?.parentElement;
    while (parent) {
      parent.removeEventListener("scroll", this._onUpdate);
      parent = parent.parentElement;
    }
  },

  view({ attrs }) {
    const { onSelect, onClose, trigger } = attrs;
    
    // Safety: recalculate if trigger moved significantly
    if (trigger) this.updateCoords(trigger);

    if (!this.charsData) {
      return m("div", {
        class: "fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] flex items-center justify-center animate-in fade-in zoom-in-95 duration-200",
        style: { 
          width: "288px",
          height: "200px",
          top: `${this.coords.top}px`,
          left: `${this.coords.left}px`
        }
      }, m("div", { class: "flex flex-col items-center gap-2" }, [
        m("i", { class: "icon-[ri--loader-4-line] animate-spin text-blue-500 text-2xl" }),
        m("span", { class: "text-[10px] text-slate-500 font-medium" }, "Loading emojis...")
      ]));
    }

    const categories = this.charsData.categories;
    const activeCat = categories.find(c => c.id === this.activeCategory);

    // Filter items based on search
    let items = activeCat ? activeCat.items : [];
    if (this.searchQuery) {
      items = categories.flatMap(c => c.items).filter(item => {
        return item.includes(this.searchQuery);
      });
      items = items.slice(0, 100);
    }

    return m("div", {
      class: "fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] flex flex-col animate-in fade-in zoom-in-95 duration-200",
      style: { 
        width: "288px",
        maxHeight: "400px",
        top: `${this.coords.top}px`,
        left: `${this.coords.left}px`
      }
    }, [
      // Header / Search
      m("div", { class: "p-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2" }, [
        m("div", { class: "relative flex-1" }, [
          m("i", { class: "icon-[ri--search-line] absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs" }),
          m("input", {
            type: "text",
            placeholder: "Search characters...",
            class: "w-full bg-slate-800 border-none rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500 outline-none",
            value: this.searchQuery,
            oninput: (e) => this.searchQuery = e.target.value
          })
        ]),
        m("button", {
          class: "p-1.5 hover:bg-slate-800 rounded-md text-slate-500 transition-colors",
          onclick: onClose
        }, m("i", { class: "icon-[ri--close-line] text-sm" }))
      ]),

      // Categories Tab
      !this.searchQuery && m("div", { class: "flex bg-slate-950/50 px-1 gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-800 min-h-[46px] items-center" }, 
        categories.map(cat => m("button", {
          class: `flex-shrink-0 px-2 py-1 rounded-lg text-lg transition-all ${this.activeCategory === cat.id ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-slate-800"}`,
          title: cat.name,
          onclick: () => this.activeCategory = cat.id
        }, cat.icon))
      ),

      // Grid
      m("div", { 
        class: "flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-1 custom-scrollbar bg-slate-900",
      }, items.map(item => m("button", {
        class: "aspect-square flex items-center justify-center text-xl hover:bg-slate-800 rounded-lg transition-all active:scale-90",
        onclick: () => onSelect(item)
      }, item))),

      // Footer
      m("div", { class: "p-2 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center" }, [
        m("span", { class: "text-[10px] text-slate-500 font-medium" }, 
          this.searchQuery ? `Found ${items.length} items` : activeCat.name
        ),
        m("div", { class: "flex gap-1" }, [
           // Quick tips or credits if needed
        ])
      ])
    ]);
  }
};
