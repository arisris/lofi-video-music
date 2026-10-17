import m from "mithril";
import { addClipToTimeline } from "../lib/clip-factory";
import { loadGoogleFont } from "../lib/fonts";

const TEXT_TEMPLATES = [
  {
    name: "Neon Glow",
    settings: {
      content: "Neon Glow",
      fontFamily: "'Bungee', cursive",
      textColor: "#ff007f",
      strokeColor: "#ffffff",
      strokeWidth: 1.5,
      shadowColor: "#ff007f",
      shadowBlur: 15,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontSize: 36,
    },
    cssStyle: "font-family: 'Bungee', cursive; color: #ff007f; text-shadow: 0 0 10px #ff007f; -webkit-text-stroke: 0.5px #fff;"
  },
  {
    name: "Cyberpunk",
    settings: {
      content: "Cyberpunk",
      fontFamily: "'Press Start 2P', cursive",
      textColor: "#facc15",
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowColor: "#00ffff",
      shadowBlur: 0,
      shadowOffsetX: -3,
      shadowOffsetY: 3,
      fontSize: 20,
    },
    cssStyle: "font-family: 'Press Start 2P', cursive; color: #facc15; text-shadow: -2px 2px 0px #00ffff; -webkit-text-stroke: 1.5px #000; font-size: 10px; font-weight: bold;"
  },
  {
    name: "VHS Retro",
    settings: {
      content: "VHS Retro",
      fontFamily: "'Roboto Mono', monospace",
      textColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowColor: "#ff0000",
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 1,
      fontSize: 32,
    },
    cssStyle: "font-family: 'Roboto Mono', monospace; color: #fff; text-shadow: 2px 1px 0px #ff0000; -webkit-text-stroke: 1px #000; font-weight: bold;"
  },
  {
    name: "Soft Badge",
    settings: {
      content: "Soft Badge",
      fontFamily: "'Lexend', sans-serif",
      textColor: "#1e293b",
      bgColor: "#fed7aa",
      bgPadding: 10,
      bgRadius: 16,
      fontWeight: "bold",
      fontSize: 24,
    },
    cssStyle: "font-family: 'Lexend', sans-serif; color: #1e293b; background-color: #fed7aa; border-radius: 12px; padding: 4px 12px; font-weight: bold;"
  },
  {
    name: "Retro Arcade",
    settings: {
      content: "Retro Arcade",
      fontFamily: "'VT323', monospace",
      textColor: "#22c55e",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "#22c55e",
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontSize: 48,
    },
    cssStyle: "font-family: 'VT323', monospace; color: #22c55e; text-shadow: 0 0 8px #22c55e; font-size: 16px;"
  },
  {
    name: "Cozy Pillow",
    settings: {
      content: "Cozy Pillow",
      fontFamily: "'Comfortaa', cursive",
      textColor: "#475569",
      bgColor: "#ffedd5",
      bgPadding: 12,
      bgRadius: 24,
      fontWeight: "bold",
      fontSize: 24,
    },
    cssStyle: "font-family: 'Comfortaa', cursive; color: #475569; background-color: #ffedd5; border-radius: 24px; padding: 4px 12px; font-weight: bold; font-size: 10px;"
  },
  {
    name: "Vapor Wave",
    settings: {
      content: "Vapor Wave",
      fontFamily: "'Syne', sans-serif",
      textColor: "#c084fc",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "#3b82f6",
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontWeight: "800",
      fontSize: 32,
    },
    cssStyle: "font-family: 'Syne', sans-serif; color: #c084fc; text-shadow: 0 0 6px #3b82f6; font-weight: 800; text-transform: uppercase; font-size: 11px;"
  },
  {
    name: "Ink Script",
    settings: {
      content: "Ink Script",
      fontFamily: "'Satisfy', cursive",
      textColor: "#f43f5e",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.4)",
      shadowBlur: 4,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      fontSize: 36,
    },
    cssStyle: "font-family: 'Satisfy', cursive; color: #f43f5e; font-size: 14px;"
  },
  {
    name: "Typewriter",
    settings: {
      content: "Typewriter",
      fontFamily: "'Courier Prime', monospace",
      textColor: "#ffffff",
      bgColor: "#1e293b",
      bgPadding: 8,
      bgRadius: 2,
      fontSize: 24,
    },
    cssStyle: "font-family: 'Courier Prime', monospace; color: #fff; background-color: #1e293b; border-radius: 2px; padding: 3px 8px; font-size: 10px;"
  },
  {
    name: "Editorial",
    settings: {
      content: "Editorial",
      fontFamily: "'Abril Fatface', serif",
      textColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowBlur: 6,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      fontSize: 38,
    },
    cssStyle: "font-family: 'Abril Fatface', serif; color: #ffffff; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); font-size: 12px;"
  },
  {
    name: "Pop Banger",
    settings: {
      content: "Pop Banger",
      fontFamily: "'Bangers', cursive",
      textColor: "#ffffff",
      strokeColor: "#0284c7",
      strokeWidth: 3,
      shadowColor: "rgba(0,0,0,0.8)",
      shadowBlur: 5,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      fontSize: 36,
    },
    cssStyle: "font-family: 'Bangers', cursive; color: #fff; -webkit-text-stroke: 1px #0284c7; text-shadow: 2px 2px 2px rgba(0,0,0,0.8);"
  },
  {
    name: "Sweet Hand",
    settings: {
      content: "Sweet Hand",
      fontFamily: "'Pacifico', cursive",
      textColor: "#fda4af",
      strokeColor: "#881337",
      strokeWidth: 1.5,
      shadowColor: "rgba(0,0,0,0.3)",
      shadowBlur: 4,
      fontSize: 32,
    },
    cssStyle: "font-family: 'Pacifico', cursive; color: #fda4af; -webkit-text-stroke: 0.5px #881337;"
  },
  {
    name: "Glass Subtitle",
    settings: {
      content: "Glass Subtitle",
      fontFamily: "'Inter', sans-serif",
      textColor: "#ffffff",
      bgColor: "rgba(15, 23, 42, 0.75)",
      bgPadding: 8,
      bgRadius: 6,
      fontSize: 24,
    },
    cssStyle: "font-family: 'Inter', sans-serif; color: #fff; background-color: rgba(15, 23, 42, 0.75); border-radius: 6px; padding: 4px 10px; border: 1px solid rgba(255,255,255,0.1);"
  },
  {
    name: "Luxury Gold",
    settings: {
      content: "Luxury Gold",
      fontFamily: "'Playfair Display', serif",
      textColor: "#fbbf24",
      strokeColor: "#78350f",
      strokeWidth: 1.5,
      shadowColor: "rgba(251, 191, 36, 0.3)",
      shadowBlur: 8,
      fontWeight: "bold",
      fontSize: 32,
    },
    cssStyle: "font-family: 'Playfair Display', serif; color: #fbbf24; -webkit-text-stroke: 0.5px #78350f; font-weight: bold; text-shadow: 0 0 5px rgba(251, 191, 36, 0.3);"
  }
];

export const TextPanel = {
  oninit() {
    // Load google fonts for the templates
    TEXT_TEMPLATES.forEach(t => {
      loadGoogleFont(t.settings.fontFamily);
    });
  },
  
  view() {
    const addTemplateText = (template) => {
      addClipToTimeline("text", {
        ...template.settings,
        content: "Tap to Edit"
      });
    };

    const addDefaultText = () => {
      addClipToTimeline("text", {
        content: "New Text"
      });
    };

    return m("div", { class: "bg-slate-900/50 p-4 flex flex-col h-full w-full overflow-hidden" }, [
      m("div", { class: "flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1" }, [
        
        // 1. ADD BASE TEXT
        m("div", { class: "space-y-4" }, [
          m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1" }, "Add Text"),
          m("button", {
            class: "w-full p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all flex items-center justify-center gap-2 group cursor-pointer",
            onclick: addDefaultText
          }, [
            m("i", { class: "icon-[ri--text-spacing] w-4.5 h-4.5 text-blue-400" }),
            m("span", { class: "text-xs font-bold text-slate-200" }, "Add Default Text"),
          ])
        ]),

        // 2. TEXT TEMPLATES
        m("div", { class: "space-y-4" }, [
          m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1" }, "Text Templates"),
          m("div", { class: "grid grid-cols-2 gap-3" }, 
            TEXT_TEMPLATES.map(t =>
              m("button", {
                class: "p-4 bg-slate-800/40 hover:bg-slate-850 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-3 min-h-[90px] cursor-pointer group hover:scale-[1.02]",
                onclick: () => addTemplateText(t)
              }, [
                m("div", { 
                  class: "text-center flex items-center justify-center text-xs h-10 w-full overflow-hidden leading-none",
                  style: t.cssStyle
                }, t.name),
                m("span", { class: "text-[9px] font-medium text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-wider" }, t.name)
              ])
            )
          )
        ])

      ])
    ]);
  }
};
