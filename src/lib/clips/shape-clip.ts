import { getIconFromDb } from "../../utils/indexed-db";
import { ShapeSettingsView } from "../../components/clip-settings/shape";

const iconDataCache: Record<string, any> = {};
const iconImageCache: Record<string, { img: HTMLImageElement; loaded: boolean }> = {};

// Asynchronously fetch icon data and cache it
const getIconDataAsync = (iconName: string): any => {
  if (iconDataCache[iconName] !== undefined) {
    return iconDataCache[iconName];
  }
  
  iconDataCache[iconName] = null;
  getIconFromDb(iconName).then(data => {
    iconDataCache[iconName] = data;
  });
  
  return null;
};

// Parse raw icon body, inject colors/gradients, and load as canvas image
const getIconImage = (
  iconName: string,
  iconData: any,
  color: string,
  color2: string,
  fillType: string,
  strokeColor: string,
  strokeWidth: number,
) => {
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
  };
  state.img.onerror = () => {
    URL.revokeObjectURL(blobUrl);
  };
  state.img.src = blobUrl;

  return state;
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

  getItemBoundingBox(_ctx: CanvasRenderingContext2D, w: number, h: number, settings: Record<string, any>) {
    const width = settings.width || 150;
    const height = settings.height || 150;
    return {
      x: w / 2 - width / 2,
      y: h / 2 - 100 - height / 2,
      width,
      height,
    };
  },

  drawItem(ctx: CanvasRenderingContext2D, w: number, h: number, settings: Record<string, any>, _localTime = 0, _clip: Record<string, any> | null = null) {
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

  draw(_ctx: CanvasRenderingContext2D, _w: number, _h: number) {},

  onSettings: ShapeSettingsView,
};
