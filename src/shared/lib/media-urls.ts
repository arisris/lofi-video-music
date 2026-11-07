// Media element + blob URL clone/revoke — adapted from src_old/utils/helpers.ts
// (getMediaUrls/cloneMediaElement/cloneVids/revokeClipUrls) to the new store
// (clips + snapshot videoClips/thumbClips + mediaPool).
import type { TimelineClip } from "../types/clip";

export const getMediaUrls = (clip: TimelineClip): string[] => {
  const urls: string[] = [];
  if (!clip?.settings) return urls;
  const s = clip.settings as Record<string, unknown>;
  const pushEl = (el: unknown) => {
    const src = (el as { src?: unknown } | null)?.src;
    if (typeof src === "string" && src) urls.push(src);
  };
  pushEl(s.bgElement);
  pushEl(s.mediaElement);
  if (Array.isArray(s.bgElements)) for (const v of s.bgElements) pushEl(v);
  if (Array.isArray(s.mediaElements)) for (const v of s.mediaElements) pushEl(v);
  if (typeof s.audioUrl === "string" && s.audioUrl) urls.push(s.audioUrl);
  return urls;
};

export const cloneMediaElement = <T>(el: T): T => {
  if (!el || typeof (el as { cloneNode?: unknown }).cloneNode !== "function") return el;
  const node = el as unknown as Element & {
    tagName: string;
    src?: string;
    muted?: boolean;
    loop?: boolean;
    playsInline?: boolean;
    crossOrigin?: string | null;
    playbackRate?: number;
  };
  const copy = node.cloneNode(true) as unknown as Record<string, unknown> & {
    tagName: string;
  };
  if (node.tagName === "VIDEO") {
    (copy as Record<string, unknown>).src = node.src;
    (copy as Record<string, unknown>).muted = node.muted;
    (copy as Record<string, unknown>).loop = node.loop;
    (copy as Record<string, unknown>).playsInline = node.playsInline;
    (copy as Record<string, unknown>).crossOrigin = node.crossOrigin;
    (copy as Record<string, unknown>).playbackRate = node.playbackRate;
  }
  return copy as unknown as T;
};

export const cloneVids = <T>(vids: T): T => {
  if (!Array.isArray(vids)) return vids;
  return (vids as unknown[]).map(cloneMediaElement) as unknown as T;
};

/** Deep-copy settings; <video>/<img> elements are cloned so duplicates stay independent. */
export function cloneClipSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...(settings as object) };
  if (copy.mediaElement) copy.mediaElement = cloneMediaElement(copy.mediaElement);
  if (copy.mediaElements) copy.mediaElements = cloneVids(copy.mediaElements);
  if (copy.bgElement) copy.bgElement = cloneMediaElement(copy.bgElement);
  if (copy.bgElements) copy.bgElements = cloneVids(copy.bgElements);
  return copy;
}

interface RevokeState {
  clips: TimelineClip[];
  videoClips: TimelineClip[] | null;
  thumbClips: TimelineClip[] | null;
  mediaPool: Array<{ url: string }>;
}

export const revokeClipUrls = (clip: TimelineClip, state: RevokeState) => {
  for (const url of getMediaUrls(clip)) {
    if (!url.startsWith("blob:")) continue;
    const inUse =
      state.clips.some((c) => c.id !== clip.id && getMediaUrls(c).includes(url)) ||
      (state.videoClips ?? []).some((c) => getMediaUrls(c).includes(url)) ||
      (state.thumbClips ?? []).some((c) => getMediaUrls(c).includes(url));
    if (inUse) continue;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }
};
