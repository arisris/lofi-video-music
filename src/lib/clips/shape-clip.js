import m from "mithril";
import { State } from "../state";
import { SharedTransformSettings, SharedAnimationSettings } from "../../components/shared-clip-settings";
import { ColorInput } from "../../components/ui/color-input";
import { ScrubInput } from "../../components/ui/scrub-input";
import { getIconFromDb } from "../../utils/indexed-db";

const iconDataCache = {};
const iconImageCache = {};

// Asynchronously fetch icon data and cache it
const getIconDataAsync = (iconName) => {
  if (iconDataCache[iconName] !== undefined) {
    return iconDataCache[iconName];
  }
  
  iconDataCache[iconName] = null;
  getIconFromDb(iconName).then(data => {
    iconDataCache[iconName] = data;
    m.redraw();
  });
  
  return null;
};

// Parse raw icon body, inject colors/gradients, and load as canvas image
const getIconImage = (iconName, iconData, color, color2, fillType, strokeColor, strokeWidth) => {
  const cacheKey = `${iconName}_${color}_${color2}_${fillType}_${strokeColor}_${strokeWidth}`;
  if (iconImageCache[cacheKey]) {
    return iconImageCache[cacheKey];
  }

  const state = { img: new Image(), loaded: false };
  iconImageCache[cacheKey] = state;

  let fillVal = color;
  let gradDef = "";
  if (fillType === "gradient") {
    gradDef = `<linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color}" /><stop offset="100%" stop-color="${color2}" /></linearGradient>`;
    fillVal = "url(#iconGrad)";
  }

  let body = iconData.body;
  body = body.replace(/currentColor/g, fillVal);

  let styleTag = "";
  if (strokeWidth > 0 && strokeColor && strokeColor !== "transparent") {
    styleTag = `<style>
      path, circle, rect, polygon, ellipse, line, polyline {
        stroke: ${strokeColor} !important;
        stroke-width: ${strokeWidth}px !important;
        stroke-linejoin: round !important;
        stroke-linecap: round !important;
        paint-order: stroke fill !important;
      }
    </style>`;
  }

  const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${iconData.width} ${iconData.height}" width="${iconData.width}" height="${iconData.height}">${styleTag}${gradDef}${body}</svg>`;

  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(blob);

  state.img.onload = () => {
    state.loaded = true;
    URL.revokeObjectURL(blobUrl);
    m.redraw();
  };
  state.img.onerror = () => {
    URL.revokeObjectURL(blobUrl);
  };
  state.img.src = blobUrl;

  return state;
};

// Inline icon preview for Inspector Panel
const IconPreviewInline = {
  oninit(vnode) {
    vnode.state.svgText = "";
    this.loadedName = "";
  },
  view(vnode) {
    const iconName = vnode.attrs.iconName;
    if (this.loadedName !== iconName) {
      this.loadedName = iconName;
      getIconFromDb(iconName).then(data => {
        if (data) {
          vnode.state.svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.width} ${data.height}" class="w-4.5 h-4.5 text-slate-350" fill="currentColor">${data.body}</svg>`;
        } else {
          vnode.state.svgText = "";
        }
        m.redraw();
      });
    }
    if (!vnode.state.svgText) {
      return m("i", { class: "icon-[ri--image-line] text-slate-600 w-4 h-4" });
    }
    return m.trust(vnode.state.svgText);
  }
};

export const ShapeClip = {
  id: "shape",
  name: "Shape",
  icon: "icon-[ri--shapes-line]",

  settings: {
    shapeType: "rectangle",
    iconName: "ri:star-fill",
    width: 150,
    height: 150,
    fillType: "solid",
    fillColor: "#3b82f6",
    fillColor2: "#8b5cf6",
    strokeColor: "#ffffff",
    strokeWidth: 0,
    cornerRadius: 8,
    starSpikes: 5,
    starInnerRatio: 0.4,
    polygonSides: 6,
    shadowColor: "rgba(0,0,0,0.5)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    opacity: 1.0,
  },

  getItemBoundingBox(ctx, w, h, settings) {
    const width = settings.width || 150;
    const height = settings.height || 150;
    return {
      x: w / 2 - width / 2,
      y: h / 2 - 100 - height / 2,
      width,
      height,
    };
  },

  drawItem(ctx, w, h, settings, localTime = 0, clip = null) {
    ctx.save();

    const width = settings.width || 150;
    const height = settings.height || 150;
    const centerX = w / 2;
    const centerY = h / 2 - 100;

    const x = centerX - width / 2;
    const y = centerY - height / 2;

    const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;
    ctx.globalAlpha = ctx.globalAlpha * opacity;

    // Apply Shadow
    if (settings.shadowBlur > 0 || settings.shadowOffsetX !== 0 || settings.shadowOffsetY !== 0) {
      ctx.shadowColor = settings.shadowColor || "rgba(0,0,0,0.5)";
      ctx.shadowBlur = settings.shadowBlur || 0;
      ctx.shadowOffsetX = settings.shadowOffsetX || 0;
      ctx.shadowOffsetY = settings.shadowOffsetY || 0;
    }

    const type = settings.shapeType || "rectangle";
    
    if (type === "icon" && settings.iconName) {
      const iconData = getIconDataAsync(settings.iconName);
      if (iconData) {
        const state = getIconImage(
          settings.iconName,
          iconData,
          settings.fillColor || "#ffffff",
          settings.fillColor2 || "#8b5cf6",
          settings.fillType,
          settings.strokeColor || "#ffffff",
          settings.strokeWidth || 0
        );
        if (state.loaded) {
          ctx.drawImage(state.img, x, y, width, height);
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      if (type === "rectangle") {
        ctx.roundRect(x, y, width, height, settings.cornerRadius || 0);
      } else if (type === "circle") {
        const radius = Math.min(width, height) / 2;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      } else if (type === "triangle") {
        ctx.moveTo(centerX, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
      } else if (type === "star") {
        const spikes = settings.starSpikes || 5;
        const outerRadius = Math.min(width, height) / 2;
        const innerRadius = outerRadius * (settings.starInnerRatio || 0.4);
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.moveTo(centerX, centerY - outerRadius);
        for (let i = 0; i < spikes; i++) {
          let sx = centerX + Math.cos(rot) * outerRadius;
          let sy = centerY + Math.sin(rot) * outerRadius;
          ctx.lineTo(sx, sy);
          rot += step;

          sx = centerX + Math.cos(rot) * innerRadius;
          sy = centerY + Math.sin(rot) * innerRadius;
          ctx.lineTo(sx, sy);
          rot += step;
        }
        ctx.closePath();
      } else if (type === "polygon") {
        const sides = settings.polygonSides || 6;
        const radius = Math.min(width, height) / 2;
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
          const sx = centerX + Math.cos(angle) * radius;
          const sy = centerY + Math.sin(angle) * radius;
          if (i === 0) {
            ctx.moveTo(sx, sy);
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.closePath();
      } else if (type === "heart") {
        const topY = centerY - height * 0.25;
        ctx.moveTo(centerX, centerY + height * 0.35);
        ctx.bezierCurveTo(
          centerX - width * 0.6,
          centerY - height * 0.2,
          centerX - width * 0.35,
          centerY - height * 0.5,
          centerX,
          topY
        );
        ctx.bezierCurveTo(
          centerX + width * 0.35,
          centerY - height * 0.5,
          centerX + width * 0.6,
          centerY - height * 0.2,
          centerX,
          centerY + height * 0.35
        );
        ctx.closePath();
      }

      // Fill
      if (settings.fillColor && settings.fillColor !== "transparent") {
        let fillStyle = settings.fillColor;
        if (settings.fillType === "gradient") {
          const grad = ctx.createLinearGradient(x, y, x + width, y + height);
          grad.addColorStop(0, settings.fillColor);
          grad.addColorStop(1, settings.fillColor2 || "#8b5cf6");
          fillStyle = grad;
        }
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }

      // Reset shadow for stroke
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Stroke/Border
      if (settings.strokeWidth > 0 && settings.strokeColor && settings.strokeColor !== "transparent") {
        ctx.strokeStyle = settings.strokeColor;
        ctx.lineWidth = settings.strokeWidth;
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  draw(ctx, w, h) {},

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === "shape");
    if (!selectedClip) {
      return m("div", { class: "text-slate-500 text-xs italic text-center py-8" }, "Select a shape to change settings");
    }

    const settings = selectedClip.settings;

    const update = (key, val) => {
      settings[key] = val;
      m.redraw();
    };

    const isThumbnailMode = State.currentRoute === "/image";

    return m("div", { class: "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300" }, [
      // 1. Shape Type Selection
      m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-3" }, [
        m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Shape Type"),
        m("div", { class: "grid grid-cols-4 gap-1.5" }, [
          { id: "rectangle", label: "Rect", icon: "icon-[ri--rectangle-line]" },
          { id: "circle", label: "Circle", icon: "icon-[ri--checkbox-blank-circle-line]" },
          { id: "triangle", label: "Triangle", icon: "icon-[ri--triangle-line]" },
          { id: "star", label: "Star", icon: "icon-[ri--star-line]" },
          { id: "polygon", label: "Polygon", icon: "icon-[ri--hexagon-line]" },
          { id: "heart", label: "Heart", icon: "icon-[ri--heart-line]" },
          { id: "icon", label: "Icon", icon: "icon-[ri--emotion-line]" },
        ].map(shape => {
          const isActive = settings.shapeType === shape.id;
          return m("button", {
            class: `py-1.5 px-1 rounded flex flex-col items-center gap-1 border text-[9px] font-semibold transition-all cursor-pointer ${
              isActive
                ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                : "bg-slate-900/45 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`,
            onclick: () => update("shapeType", shape.id),
          }, [
            m("i", { class: `${shape.icon} w-3.5 h-3.5` }),
            shape.label,
          ]);
        })),

        // Shape Specific Parameters
        settings.shapeType === "rectangle" && m("div", { class: "mt-3" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Corner Radius"),
          m(ScrubInput, {
            label: "R",
            value: settings.cornerRadius || 0,
            min: 0,
            max: 100,
            onUpdate: (val) => update("cornerRadius", val),
          }),
        ]),

        settings.shapeType === "star" && m("div", { class: "mt-3 grid grid-cols-2 gap-3" }, [
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Spikes"),
            m(ScrubInput, {
              label: "S",
              value: settings.starSpikes || 5,
              min: 3,
              max: 30,
              onUpdate: (val) => update("starSpikes", Math.round(val)),
            }),
          ]),
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Inner Ratio"),
            m(ScrubInput, {
              label: "IR",
              value: settings.starInnerRatio || 0.4,
              step: 0.05,
              min: 0.1,
              max: 0.9,
              onUpdate: (val) => update("starInnerRatio", val),
            }),
          ]),
        ]),

        settings.shapeType === "polygon" && m("div", { class: "mt-3" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Sides"),
          m(ScrubInput, {
            label: "S",
            value: settings.polygonSides || 6,
            min: 3,
            max: 20,
            onUpdate: (val) => update("polygonSides", Math.round(val)),
          }),
        ]),

        settings.shapeType === "icon" && m("div", { class: "mt-3 space-y-2" }, [
          m("label", { class: "block text-[10px] text-slate-500 mb-1" }, "Icon ID"),
          m("div", { class: "flex items-center gap-2" }, [
            m("input", {
              type: "text",
              class: "flex-1 bg-slate-900 border border-slate-700/60 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500",
              value: settings.iconName || "",
              oninput: (e) => update("iconName", e.target.value)
            }),
            m("div", { class: "w-8 h-8 rounded border border-slate-800 bg-slate-950 flex items-center justify-center shrink-0" }, 
              settings.iconName && m(IconPreviewInline, { iconName: settings.iconName })
            )
          ]),
          m("p", { class: "text-[9px] text-slate-500" }, "Format: prefix:name (e.g. ri:music-2-fill or mdi:laptop)"),
        ]),
      ]),

      // 2. Color & Fill Settings
      m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-4" }, [
        m("div", { class: "flex items-center justify-between" }, [
          m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Fill Settings"),
          m("div", { class: "flex bg-slate-900 p-0.5 rounded border border-slate-800" }, [
            m("button", {
              class: `px-2 py-0.5 text-[9px] font-semibold rounded cursor-pointer transition-all ${
                settings.fillType !== "gradient" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"
              }`,
              onclick: () => update("fillType", "solid"),
            }, "Solid"),
            m("button", {
              class: `px-2 py-0.5 text-[9px] font-semibold rounded cursor-pointer transition-all ${
                settings.fillType === "gradient" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"
              }`,
              onclick: () => update("fillType", "gradient"),
            }, "Gradient"),
          ]),
        ]),

        m(ColorInput, {
          label: settings.fillType === "gradient" ? "Start Color" : "Fill Color",
          value: settings.fillColor || "#3b82f6",
          onUpdate: (val) => update("fillColor", val),
        }),

        settings.fillType === "gradient" && m(ColorInput, {
          label: "End Color",
          value: settings.fillColor2 || "#8b5cf6",
          onUpdate: (val) => update("fillColor2", val),
        }),
      ]),

      // 3. Size Settings
      m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-3" }, [
        m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Dimensions"),
        m("div", { class: "grid grid-cols-2 gap-3" }, [
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Width"),
            m(ScrubInput, {
              label: "W",
              value: settings.width || 150,
              min: 10,
              max: 2000,
              onUpdate: (val) => update("width", val),
            }),
          ]),
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Height"),
            m(ScrubInput, {
              label: "H",
              value: settings.height || 150,
              min: 10,
              max: 2000,
              onUpdate: (val) => update("height", val),
            }),
          ]),
        ]),
      ]),

      // 4. Stroke & Shadow
      m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-4" }, [
        m("h4", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Stroke & Shadow"),

        m(ColorInput, {
          label: "Stroke Color",
          value: settings.strokeColor || "#ffffff",
          onUpdate: (val) => update("strokeColor", val),
        }),

        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Stroke Width"),
          m(ScrubInput, {
            label: "SW",
            value: settings.strokeWidth || 0,
            min: 0,
            max: 50,
            onUpdate: (val) => update("strokeWidth", val),
          }),
        ]),

        m(ColorInput, {
          label: "Shadow Color",
          value: settings.shadowColor || "rgba(0,0,0,0.5)",
          onUpdate: (val) => update("shadowColor", val),
        }),

        m("div", { class: "grid grid-cols-3 gap-3" }, [
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Blur"),
            m(ScrubInput, {
              label: "B",
              value: settings.shadowBlur || 0,
              min: 0,
              max: 50,
              onUpdate: (val) => update("shadowBlur", val),
            }),
          ]),
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Offset X"),
            m(ScrubInput, {
              label: "OX",
              value: settings.shadowOffsetX || 0,
              onUpdate: (val) => update("shadowOffsetX", val),
            }),
          ]),
          m("div", [
            m("label", { class: "block text-[10px] text-slate-500 mb-1.5" }, "Offset Y"),
            m(ScrubInput, {
              label: "OY",
              value: settings.shadowOffsetY || 0,
              onUpdate: (val) => update("shadowOffsetY", val),
            }),
          ]),
        ]),

        m("div", [
          m("label", { class: "block text-[10px] text-slate-500 mb-1.5 flex justify-between" }, [
            m("span", "Opacity"),
            m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${Math.round((settings.opacity !== undefined ? settings.opacity : 1.0) * 100)}%`),
          ]),
          m("input", {
            type: "range",
            min: 0,
            max: 1,
            step: 0.01,
            value: settings.opacity !== undefined ? settings.opacity : 1.0,
            class: "w-full accent-blue-500 cursor-pointer h-1 bg-slate-800 rounded-full appearance-none",
            oninput: (e) => update("opacity", parseFloat(e.target.value)),
          }),
        ]),
      ]),

      SharedTransformSettings(null, -1, settings),
      !isThumbnailMode && SharedAnimationSettings(null, -1, settings),
    ]);
  },
};
