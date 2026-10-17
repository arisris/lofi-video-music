import m from "mithril";
import { State } from "../lib/state";
import { loadGoogleFont, GoogleFontsList } from "../lib/fonts";
import { ScrubInput } from "./ui/scrub-input";
import { ColorInput } from "./ui/color-input";

export const SharedTextSettings = (clipId, itemIndex = -1, directSettings = null) => {
  const settings = directSettings || (itemIndex === -1 
    ? State.clipSettings[clipId] 
    : State.clipSettings[clipId].items[itemIndex]);
    
  if (!settings) return null;

  // Load current font on init
  loadGoogleFont(settings.fontFamily);

  const isThumbnailMode = State.currentRoute === "/image";

  const update = (key, val) => {
    settings[key] = val;
    if (key === "fontFamily") loadGoogleFont(val);
    m.redraw();
  };

  return m("div", { class: "mt-6 pt-4 border-t border-slate-800/50" }, [
    m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, "Typography"),
    
    // Font Family
    m("div", { class: "mb-3" }, [
      m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Font Family"),
      m("div", { class: "relative" }, [
        m("select", {
          class: "w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700/50 transition-colors",
          onchange: (e) => update("fontFamily", e.target.value),
          onfocus: () => {
            // Lazy load ALL fonts in the list when user clicks the dropdown so they can see previews
            GoogleFontsList.forEach(f => loadGoogleFont(f));
          },
          value: settings.fontFamily || "sans-serif"
        }, GoogleFontsList.map(f => m("option", { 
          value: f, 
          style: { fontFamily: f, padding: '10px', background: '#1e293b' } 
        }, f.replace(/'/g, "")))),
        m("i", { class: "icon-[ri--arrow-down-s-line] absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" })
      ]),
    ]),

    m("div", { class: "grid grid-cols-2 gap-3 mb-3" }, [
      // Font Size
      m("div", [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Size"),
        m(ScrubInput, {
          label: "S",
          value: settings.fontSize || 24,
          min: 8,
          max: 300,
          onUpdate: (val) => update("fontSize", val)
        }),
      ]),
      // Line Height
      m("div", [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Line H"),
        m(ScrubInput, {
          label: "LH",
          value: settings.lineHeight || 1.2,
          step: 0.1,
          min: 0.5,
          max: 3,
          onUpdate: (val) => update("lineHeight", val)
        }),
      ]),
    ]),

    m("div", { class: "grid grid-cols-2 gap-3 mb-3" }, [
      // Font Weight
      m("div", [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Weight"),
        m("select", {
          class: "w-full bg-slate-800 border border-slate-700 rounded px-2 h-7 text-[10px] text-slate-300 outline-none",
          onchange: (e) => update("fontWeight", e.target.value),
          value: settings.fontWeight || "normal"
        }, ["100", "200", "300", "400", "500", "600", "700", "800", "900", "normal", "bold"].map(w => m("option", { value: w }, w))),
      ]),
      // Alignment
      m("div", [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Align"),
        m("select", {
          class: "w-full bg-slate-800 border border-slate-700 rounded px-2 h-7 text-[10px] text-slate-300 outline-none",
          onchange: (e) => update("textAlign", e.target.value),
          value: settings.textAlign || "center"
        }, ["left", "center", "right"].map(a => m("option", { value: a }, a))),
      ]),
    ]),

    // Color
    m(ColorInput, {
      label: "Text Color",
      value: settings.textColor || "#ffffff",
      onUpdate: (val) => update("textColor", val)
    }),

    // Stroke & Shadow
    m("div", { class: "mt-6 pt-4 border-t border-slate-800/50" }, [
      m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, "Stroke & Shadow"),
      
      m(ColorInput, {
        label: "Stroke Color",
        value: settings.strokeColor || "#000000",
        onUpdate: (val) => update("strokeColor", val)
      }),

      m("div", { class: "mb-4" }, [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Stroke Width"),
        m(ScrubInput, {
          label: "W",
          value: settings.strokeWidth || 0,
          min: 0,
          max: 20,
          onUpdate: (val) => update("strokeWidth", val)
        }),
      ]),
      
      m(ColorInput, {
        label: "Shadow Color",
        value: settings.shadowColor || "rgba(0,0,0,0.8)",
        onUpdate: (val) => update("shadowColor", val)
      }),

      m("div", { class: "grid grid-cols-3 gap-3 mb-3" }, [
        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Blur"),
          m(ScrubInput, {
            label: "B",
            value: settings.shadowBlur || 0,
            min: 0,
            max: 50,
            onUpdate: (val) => update("shadowBlur", val)
          }),
        ]),
        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Offset X"),
          m(ScrubInput, {
            label: "OX",
            value: settings.shadowOffsetX || 0,
            onUpdate: (val) => update("shadowOffsetX", val)
          }),
        ]),
        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Offset Y"),
          m(ScrubInput, {
            label: "OY",
            value: settings.shadowOffsetY || 0,
            onUpdate: (val) => update("shadowOffsetY", val)
          }),
        ]),
      ]),
    ]),

    // Background
    m("div", { class: "mt-6 pt-4 border-t border-slate-800/50" }, [
      m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, "Background Box"),
      m(ColorInput, {
        label: "BG Color (use transparent for none)",
        value: settings.bgColor || "transparent",
        onUpdate: (val) => update("bgColor", val)
      }),
      m("div", { class: "grid grid-cols-2 gap-3 mt-3" }, [
        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Padding"),
          m(ScrubInput, {
            label: "P",
            value: settings.bgPadding || 10,
            min: 0,
            max: 100,
            onUpdate: (val) => update("bgPadding", val)
          }),
        ]),
        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Radius"),
          m(ScrubInput, {
            label: "R",
            value: settings.bgRadius || 8,
            min: 0,
            max: 50,
            onUpdate: (val) => update("bgRadius", val)
          }),
        ]),
      ]),
    ]),

    // Text Effects
    !isThumbnailMode && m("div", { class: "mt-6 pt-4 border-t border-slate-800/50" }, [
      m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, "Text Effects"),
      
      // Effect Selector
      m("div", { class: "mb-3" }, [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Effect Type"),
        m("div", { class: "relative" }, [
          m("select", {
            class: "w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700/50 transition-colors",
            onchange: (e) => update("textEffect", e.target.value),
            value: settings.textEffect || "none"
          }, [
            m("option", { value: "none" }, "None"),
            m("option", { value: "typewriter" }, "Typewriter"),
            m("option", { value: "wavy" }, "Wavy")
          ]),
          m("i", { class: "icon-[ri--arrow-down-s-line] absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" })
        ])
      ]),

      // Typewriter Settings (Only show if typewriter is active)
      (settings.textEffect === "typewriter") && [
        m("div", { class: "mb-3" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5 flex justify-between" }, [
            m("span", "Typing Speed"),
            m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${settings.typewriterSpeed || 15} char/s`)
          ]),
          m(ScrubInput, {
            label: "Speed",
            value: settings.typewriterSpeed || 15,
            min: 1,
            max: 100,
            onUpdate: (val) => update("typewriterSpeed", val)
          })
        ]),
        m("div", { class: "flex items-center justify-between p-2 mb-3 bg-slate-800/40 border border-slate-700/50 rounded-lg" }, [
          m("div", { class: "flex flex-col" }, [
            m("span", { class: "text-[10px] font-bold text-slate-300" }, "Type Out (Backspace)"),
            m("span", { class: "text-[9px] text-slate-500" }, "Backspace at the end of the clip"),
          ]),
          m("button", {
            class: `w-8 h-4 rounded-full relative transition-colors ${settings.typewriterOut !== false ? "bg-blue-600" : "bg-slate-700"}`,
            onclick: () => update("typewriterOut", settings.typewriterOut === false ? true : false)
          }, [
            m("div", { 
              class: `absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${settings.typewriterOut !== false ? "right-0.5" : "left-0.5"}` 
            })
          ]),
        ])
      ],

      // Wavy Text Settings (Only show if wavy is active)
      (settings.textEffect === "wavy") && [
        m("div", { class: "mb-3" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5 flex justify-between" }, [
            m("span", "Wave Amplitude"),
            m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${settings.wavyAmplitude !== undefined ? settings.wavyAmplitude : 6} px`)
          ]),
          m(ScrubInput, {
            label: "Amp",
            value: settings.wavyAmplitude !== undefined ? settings.wavyAmplitude : 6,
            min: 0,
            max: 50,
            onUpdate: (val) => update("wavyAmplitude", val)
          })
        ]),
        m("div", { class: "mb-3" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5 flex justify-between" }, [
            m("span", "Wave Speed"),
            m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${settings.wavyFrequency !== undefined ? settings.wavyFrequency : 4} Hz`)
          ]),
          m(ScrubInput, {
            label: "Speed",
            value: settings.wavyFrequency !== undefined ? settings.wavyFrequency : 4,
            step: 0.1,
            min: 0.1,
            max: 20,
            onUpdate: (val) => update("wavyFrequency", val)
          })
        ]),
        m("div", { class: "mb-3" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5 flex justify-between" }, [
            m("span", "Wave Letter Spacing"),
            m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${settings.wavySpacing !== undefined ? settings.wavySpacing : 0.15}`)
          ]),
          m(ScrubInput, {
            label: "Spacing",
            value: settings.wavySpacing !== undefined ? settings.wavySpacing : 0.15,
            step: 0.01,
            min: 0,
            max: 2,
            onUpdate: (val) => update("wavySpacing", val)
          })
        ])
      ]
    ]),

  ]);
};

export const SharedTransformSettings = (clipId, itemIndex = -1, directSettings = null) => {
  const settings = directSettings || (itemIndex === -1 
    ? State.clipSettings[clipId] 
    : State.clipSettings[clipId].items[itemIndex]);
    
  if (!settings) return null;

  const update = (key, val) => {
    settings[key] = val;
    m.redraw();
  };

  return m("div", { class: "mt-6 pt-4 border-t border-slate-800/50" }, [
    m("div", { class: "flex items-center justify-between mb-4" }, [
      m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Transform"),
      m("button", {
        class: "text-[9px] text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1",
        onclick: () => {
          settings.x = 0;
          settings.y = 0;
          settings.scaleX = 1;
          settings.scaleY = 1;
          settings.rotation = 0;
          m.redraw();
        }
      }, [
        m("i", { class: "icon-[ri--restart-line] w-2.5 h-2.5" }),
        "Reset"
      ])
    ]),
    
    // Row 1: Position
    m("div", { class: "grid grid-cols-2 gap-2 mb-2" }, [
      m(ScrubInput, {
        label: "X",
        value: settings.x,
        step: 1,
        onUpdate: (val) => update("x", val)
      }),
      m(ScrubInput, {
        label: "Y",
        value: settings.y,
        step: 1,
        onUpdate: (val) => update("y", val)
      }),
    ]),

    // Uniform Size/Scale Slider
    m("div", { class: "mb-3 mt-1 bg-slate-950/20 border border-slate-800/40 p-2.5 rounded" }, [
      m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between" }, [
        m("span", "Uniform Size / Scale"),
        m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${Math.round((settings.scaleX ?? 1) * 100)}%`)
      ]),
      m("div", { class: "flex items-center gap-2" }, [
        m("input", {
          type: "range",
          min: 0.05,
          max: 5,
          step: 0.05,
          value: settings.scaleX ?? 1,
          class: "flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500",
          oninput: (e) => {
            const val = parseFloat(e.target.value);
            settings.scaleX = val;
            settings.scaleY = val;
            m.redraw();
          }
        }),
        m("button", {
          class: "p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded hover:text-white transition-colors flex items-center justify-center shrink-0 w-5 h-5",
          title: "Reset Scale",
          onclick: () => {
            settings.scaleX = 1;
            settings.scaleY = 1;
            m.redraw();
          }
        }, m("i", { class: "icon-[ri--aspect-ratio-line] w-3 h-3" }))
      ])
    ]),

    // Row 2: Scale
    m("div", { class: "grid grid-cols-2 gap-2 mb-2" }, [
      m(ScrubInput, {
        label: "SX",
        value: settings.scaleX,
        step: 0.01,
        min: 0.01,
        max: 10,
        onUpdate: (val) => update("scaleX", val)
      }),
      m(ScrubInput, {
        label: "SY",
        value: settings.scaleY,
        step: 0.01,
        min: 0.01,
        max: 10,
        onUpdate: (val) => update("scaleY", val)
      }),
    ]),

    // Row 3: Rotation
    m("div", { class: "w-full" }, [
      m(ScrubInput, {
        label: "R",
        value: settings.rotation,
        step: 1,
        onUpdate: (val) => update("rotation", val)
      }),
    ])
  ]);
};

export const SharedAnimationSettings = (clipId, itemIndex = -1, directSettings = null) => {
  const settings = directSettings || (itemIndex === -1 
    ? State.clipSettings[clipId] 
    : State.clipSettings[clipId].items[itemIndex]);
    
  if (!settings) return null;

  // Ensure animations object exists with new defaults
  if (!settings.animations) {
    settings.animations = {
      inType: "fade",
      outType: "fade",
      type: "none"
    };
  }

  const update = (key, val) => {
    settings.animations[key] = val;
    m.redraw();
  };

  return m("div", { class: "mt-6 pt-4 border-t border-slate-800/50" }, [
    m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4" }, "Animations"),
    
    // In/Out Presets
    m("div", { class: "grid grid-cols-2 gap-3 mb-4" }, [
      m("div", [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "In Effect"),
        m("select", {
          class: "w-full bg-slate-800 border border-slate-700 rounded px-2 h-7 text-[10px] text-slate-300 outline-none",
          onchange: (e) => update("inType", e.target.value),
          value: settings.animations.inType
        }, ["none", "fade", "slide-up", "slide-down", "zoom-in", "bounce"].map(t => m("option", { value: t }, t))),
      ]),
      m("div", [
        m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Out Effect"),
        m("select", {
          class: "w-full bg-slate-800 border border-slate-700 rounded px-2 h-7 text-[10px] text-slate-300 outline-none",
          onchange: (e) => update("outType", e.target.value),
          value: settings.animations.outType
        }, ["none", "fade", "slide-up", "slide-down", "zoom-out"].map(t => m("option", { value: t }, t))),
      ]),
    ]),

    // Continuous Animation
    m("div", { class: "mb-4" }, [
      m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Continuous Loop"),
      m("select", {
        class: "w-full bg-slate-800 border border-slate-700 rounded px-2 h-7 text-[10px] text-slate-300 outline-none",
        onchange: (e) => update("type", e.target.value),
        value: settings.animations.type
      }, ["none", "pulse", "float", "shake", "swing"].map(t => m("option", { value: t }, t))),
    ]),

    // Audio Reactive Toggle
    m("div", { class: "flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg" }, [
      m("div", { class: "flex flex-col" }, [
        m("span", { class: "text-[10px] font-bold text-slate-300" }, "Audio Reactive"),
        m("span", { class: "text-[9px] text-slate-500" }, "Sync effect to music beat"),
      ]),
      m("button", {
        class: `w-8 h-4 rounded-full relative transition-colors ${settings.animations.audioReactive ? "bg-blue-600" : "bg-slate-700"}`,
        onclick: () => update("audioReactive", !settings.animations.audioReactive)
      }, [
        m("div", { 
          class: `absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${settings.animations.audioReactive ? "right-0.5" : "left-0.5"}` 
        })
      ]),
    ]),
  ]);
};
