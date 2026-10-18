import { runtime } from "../lib/runtime";
import { ClipRegistry } from "../lib/clips/registry";

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

export const generateThumbnail = (source: any, isVideo = false): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const draw = (media: any) => {
      const mediaW = media.naturalWidth || media.videoWidth || media.width || 300;
      const mediaH = media.naturalHeight || media.videoHeight || media.height || 200;

      const maxDimension = 256;
      let targetW = mediaW;
      let targetH = mediaH;

      if (mediaW > maxDimension || mediaH > maxDimension) {
        if (mediaW > mediaH) {
          targetW = maxDimension;
          targetH = Math.round((mediaH * maxDimension) / mediaW);
        } else {
          targetH = maxDimension;
          targetW = Math.round((mediaW * maxDimension) / mediaH);
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(media, 0, 0, mediaW, mediaH, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };

    if (isVideo) {
      if (source.readyState >= 2) draw(source);
      else source.onloadeddata = () => draw(source);
    } else {
      if (source.complete) draw(source);
      else source.onload = () => draw(source);
    }
  });
};

export const getTotalDuration = (clips: any[]) => {
  if (!clips || clips.length === 0) return 60;
  const maxEnd = clips.reduce((max: number, clip: any) => Math.max(max, clip.start + clip.duration), 0);
  return Math.max(60, Math.ceil(maxEnd));
};

/**
 * Single source of truth for calculating the global timeline time.
 * Decoupled from global State to be a pure utility.
 */
export const getGlobalTime = (state: any) => {
  return state ? (state.currentTime || 0) : 0;
};

export const getAudioReactivity = (state: any, type = "volume") => {
  if (!state || !runtime.analyser || !runtime.dataArray || !state.isPlaying) {
    return 0;
  }

  const data = runtime.dataArray;
  const len = data.length;

  if (type === "bass") {
    // Bass frequencies: lower 10%
    const end = Math.floor(len * 0.1) || 1;
    let sum = 0;
    for (let i = 0; i < end; i++) {
      sum += data[i];
    }
    return sum / end / 255;
  } else if (type === "mid") {
    // Mid frequencies: 10% to 50%
    const start = Math.floor(len * 0.1);
    const end = Math.floor(len * 0.5);
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += data[i];
    }
    return sum / (end - start) / 255;
  } else if (type === "treble") {
    // Treble frequencies: upper 50%
    const start = Math.floor(len * 0.5);
    let sum = 0;
    for (let i = start; i < len; i++) {
      sum += data[i];
    }
    return sum / (len - start) / 255;
  } else {
    // Overall volume
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += data[i];
    }
    return sum / len / 255;
  }
};

export const cloneMediaElement = (el: any): any => {
  if (!el) return el;
  if (typeof el.cloneNode === "function") {
    const newEl = el.cloneNode(true);
    if (el.tagName === "VIDEO") {
      newEl.src = el.src;
      newEl.muted = el.muted;
      newEl.loop = el.loop;
      newEl.playsInline = el.playsInline;
      newEl.crossOrigin = el.crossOrigin;
      newEl.playbackRate = el.playbackRate;
    }
    return newEl;
  }
  return el;
};

export const cloneVids = (vids: any): any => {
  if (!vids || !Array.isArray(vids)) return vids;
  return vids.map(cloneMediaElement);
};

export const getClipsToSearch = (state: any): any[] => {
  if (!state) return [];
  const isThumbnailMode = state.currentRoute === "/image";
  return isThumbnailMode
    ? [...(state.videoClips || []), ...state.timelineClips]
    : state.timelineClips;
};

/**
 * Normalises a hex colour to its 6-digit form and returns 0-1 RGB channels.
 * Falls back to opaque blue for anything unparseable so a bad settings value
 * degrades to a visible colour rather than a black shader.
 */
export function hexToRGB(hex: string): [number, number, number] {
  let h = (hex || "").replace(/^#/, "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0.231, 0.51, 0.965];
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

// Helper to convert hex to HSL
export function hexToHSL(hex: string): HSL {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const getMediaUrls = (clip: any): string[] => {
  const urls: string[] = [];
  if (!clip || !clip.settings) return urls;
  const s = clip.settings;
  if (s.bgElement && s.bgElement.src) {
    urls.push(s.bgElement.src);
  }
  if (s.bgElements) {
    s.bgElements.forEach((v: HTMLVideoElement) => {
      if (v && v.src) urls.push(v.src);
    });
  }
  if (s.mediaElement && s.mediaElement.src) {
    urls.push(s.mediaElement.src);
  }
  if (s.mediaElements) {
    s.mediaElements.forEach((v: HTMLVideoElement) => {
      if (v && v.src) urls.push(v.src);
    });
  }
  if (s.audioUrl) {
    urls.push(s.audioUrl);
  }
  return urls;
};

export const revokeUrlIfUnused = (url: string, state: any) => {
  if (!url || typeof url !== "string" || !url.startsWith("blob:")) return;

  const clips = [
    ...(state.timelineClips || []),
    ...(state.videoClips || []),
    ...(state.thumbnailClips || []),
  ];

  const inUse = clips.some((c: any) => getMediaUrls(c).includes(url));

  if (!inUse) {
    try {
      URL.revokeObjectURL(url);
      if (state.mediaPool) {
        state.mediaPool = state.mediaPool.filter((asset: any) => asset.url !== url);
      }
    } catch (err) {
      console.warn("Failed to revoke object URL:", url, err);
    }
  }
};

export const revokeClipUrls = (clip: any, state: any) => {
  const urls = getMediaUrls(clip);
  urls.forEach(url => revokeUrlIfUnused(url, state));
};

export const transformPoint = (px: number, py: number, bbox: BBox, settings: Record<string, any>) => {
  const x = settings.x ?? 0;
  const y = settings.y ?? 0;
  const scaleX = settings.scaleX ?? 1;
  const scaleY = settings.scaleY ?? 1;
  const rotation = settings.rotation ?? 0;
  const originX = settings.originX ?? 0.5;
  const originY = settings.originY ?? 0.5;

  const cx = bbox.x + bbox.width * originX;
  const cy = bbox.y + bbox.height * originY;

  const dx = px - cx;
  const dy = py - cy;

  const sx = dx * scaleX;
  const sy = dy * scaleY;

  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rx = sx * cos - sy * sin;
  const ry = sx * sin + sy * cos;

  return {
    x: cx + rx + x,
    y: cy + ry + y,
  };
};

export const inverseTransformPoint = (sx: number, sy: number, bbox: BBox, settings: Record<string, any>) => {
  const x = settings.x ?? 0;
  const y = settings.y ?? 0;
  const scaleX = settings.scaleX ?? 1;
  const scaleY = settings.scaleY ?? 1;
  const rotation = settings.rotation ?? 0;
  const originX = settings.originX ?? 0.5;
  const originY = settings.originY ?? 0.5;

  const cx = bbox.x + bbox.width * originX;
  const cy = bbox.y + bbox.height * originY;

  const rx = sx - cx - x;
  const ry = sy - cy - y;

  const rad = -rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const tx = rx * cos - ry * sin;
  const ty = rx * sin + ry * cos;

  const dx = tx / (scaleX || 0.0001);
  const dy = ty / (scaleY || 0.0001);

  return {
    x: dx + cx,
    y: dy + cy,
  };
};

export const getSelectedClipInfo = (state: any): any => {
  if (!state || !state.selectedClipId) return null;
  const globalTime = getGlobalTime(state);

  // Try to find a timeline clip
  const timelineClip = state.timelineClips.find((c: any) => c.id === state.selectedClipId);
  if (timelineClip && timelineClip.type !== 'background') {
    if (globalTime >= timelineClip.start && globalTime <= timelineClip.start + timelineClip.duration) {
      const renderer = ClipRegistry.get(timelineClip.type);
      if (renderer) {
        return {
          clip: timelineClip,
          settings: timelineClip.settings,
          renderer,
          isTimeline: true,
        };
      }
    }
  }

  // Try to find a global clip
  const globalClip = ClipRegistry.get(state.selectedClipId);
  const settings = state.clipSettings[state.selectedClipId];
  if (globalClip && settings && settings.enabled !== false) {
    return {
      clip: globalClip,
      settings: settings,
      renderer: globalClip,
      isTimeline: false,
    };
  }

  return null;
};