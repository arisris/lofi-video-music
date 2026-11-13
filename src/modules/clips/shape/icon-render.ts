// Iconify icon cache → canvas images.
import { getIconData } from "../../../shared/lib/icon-cache";

const iconDataCache: Record<string, unknown> = {};
const iconDataPromises: Record<string, Promise<unknown>> = {};
const iconImageCache: Record<string, { img: HTMLImageElement; loaded: boolean }> = {};

export const getIconDataAsync = (iconName: string): unknown => {
  if (iconDataCache[iconName] !== undefined) return iconDataCache[iconName];
  if (!iconDataPromises[iconName]) {
    iconDataPromises[iconName] = getIconData(iconName).then((data) => {
      iconDataCache[iconName] = data ?? null;
      return iconDataCache[iconName];
    });
  }
  iconDataPromises[iconName].catch(() => {
    iconDataCache[iconName] = null;
  });
  return null;
};

interface IconData {
  body: string;
  width: number;
  height: number;
}

export const getIconImage = (
  iconName: string,
  iconData: IconData,
  color: string,
  color2: string,
  fillType: string,
  strokeColor: string,
  strokeWidth: number,
  renderWidth = iconData.width || 24,
) => {
  const scale = (iconData.width || 24) / (renderWidth || iconData.width || 24);
  const svgStrokeWidth = strokeWidth * scale;
  const cacheKey = `${iconName}_${color}_${color2}_${fillType}_${strokeColor}_${strokeWidth}_${renderWidth}`;
  if (iconImageCache[cacheKey]) return iconImageCache[cacheKey];

  const state = { img: new Image(), loaded: false };
  iconImageCache[cacheKey] = state;

  let fillVal = color;
  let gradDef = "";
  if (fillType === "gradient") {
    gradDef = `<linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${color}" /><stop offset="100%" stop-color="${color2}" /></linearGradient>`;
    fillVal = "url(#iconGrad)";
  }

  const body = iconData.body.replace(/currentColor/g, fillVal);
  let styleTag = "";
  if (svgStrokeWidth > 0 && strokeColor && strokeColor !== "transparent") {
    styleTag = `<style>
      path, circle, rect, polygon, ellipse, line, polyline {
        stroke: ${strokeColor} !important;
        stroke-width: ${svgStrokeWidth} !important;
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
  state.img.onerror = () => URL.revokeObjectURL(blobUrl);
  state.img.src = blobUrl;
  return state;
};
