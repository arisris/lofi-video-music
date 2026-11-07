// Serialize: store → ProjectV1 (JSON-safe) + per-media upload blob list.
// Non-serializable keys (DOM elements, GIF canvases) are dropped from settings and
// replaced with a { mediaId } reference so they can be re-attached on import.
import type { TimelineClip } from "../../shared/types/clip";
import type { MediaItem } from "../media/media-helper";
import { getMediaUrls } from "../../shared/lib/media-urls";
import type {
  ProjectClip,
  ProjectClipMedia,
  ProjectMedia,
  ProjectOutput,
  ProjectRouteState,
  ProjectV1,
} from "./schema";
import { PROJECT_VERSION } from "./schema";

/** Settings keys holding runtime objects (DOM/canvas), not data. */
const RUNTIME_KEYS = new Set([
  "mediaElement",
  "mediaElements",
  "bgElement",
  "bgElements",
  "gifFrames",
  "element",
  "elements",
]);

function isRuntimeValue(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  // DOM / Image / Video / Canvas / Audio elements.
  if (typeof (o as { cloneNode?: unknown }).cloneNode === "function") return true;
  if (typeof (o as unknown as HTMLCanvasElement).getContext === "function") return true;
  if (typeof window !== "undefined" && v instanceof Element) return true;
  return false;
}

/** Copy settings keeping only JSON-safe values (recursive, drops runtime). */
export function serializeSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (RUNTIME_KEYS.has(k) || typeof v === "function" || isRuntimeValue(v)) continue;
    if (Array.isArray(v)) {
      const arr = v.filter((x) => typeof x !== "function" && !isRuntimeValue(x));
      // Only keep primitive arrays / shallow JSON-safe objects.
      if (arr.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x))) {
        out[k] = [...arr];
      } else if (k === "lines") {
        // Lyrics: array of { text, start, end } objects — safe.
        try {
          out[k] = JSON.parse(JSON.stringify(arr));
        } catch {
          /* ignore */
        }
      }
      continue;
    }
    if (v && typeof v === "object") {
      // Small plain objects (e.g. shadow) — keep when JSON-safe.
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch {
        /* drop unserializable value */
      }
      continue;
    }
    if (["string", "number", "boolean"].includes(typeof v) || v === null) out[k] = v;
  }
  return out;
}

function findPoolForClip(
  clip: TimelineClip,
  pool: MediaItem[],
): MediaItem | undefined {
  const s = clip.settings as Record<string, unknown>;
  // Explicit reference (new clips always store mediaId).
  if (typeof s.mediaId === "string" && s.mediaId) {
    const hit = pool.find((m) => m.id === s.mediaId);
    if (hit) return hit;
  }
  // Object-identity match (clip created from a pool asset).
  for (const m of pool) {
    if (s.mediaElement && m.element && s.mediaElement === m.element) return m;
    if (s.mediaElements && m.elements && s.mediaElements === m.elements) return m;
    const gf = (s.gifFrames as unknown[] | null) ?? null;
    const mgf = (m as { gifFrames?: unknown }).gifFrames as unknown[] | undefined;
    if (Array.isArray(gf) && gf.length > 0 && mgf === gf) return m;
  }
  // URL match (music via audioUrl, or URL-based background).
  const urls = getMediaUrls(clip);
  if (urls.length > 0) {
    const hit = pool.find((m) => urls.includes(m.url));
    if (hit) return hit;
  }
  return undefined;
}

export function serializeClip(clip: TimelineClip, pool: MediaItem[]): ProjectClip {
  const s = clip.settings as Record<string, unknown>;
  const linked = findPoolForClip(clip, pool);
  let media: ProjectClipMedia | null = null;
  if (linked) {
    media = {
      mediaId: linked.id,
      fileName: typeof s.fileName === "string" ? (s.fileName as string) : linked.name,
      mediaType: typeof s.mediaType === "string" ? (s.mediaType as string) : linked.type,
    };
  } else if (clip.type === "music" && typeof s.audioUrl === "string" && s.audioUrl) {
    // Pool-less music (timeline file picker): synthesize media on export.
    media = { mediaId: `__clip:${clip.id}`, fileName: typeof s.name === "string" ? (s.name as string) : "music" };
  }
  return {
    id: clip.id,
    type: clip.type,
    trackId: clip.trackId,
    start: clip.start,
    duration: clip.duration,
    settings: serializeSettings(s),
    media,
  };
}

export function serializeMedia(m: MediaItem): ProjectMedia {
  const isBlob = m.url.startsWith("blob:");
  return {
    id: m.id,
    name: m.name,
    kind: m.type,
    origin: m.source,
    source: isBlob
      ? { type: "asset", value: `assets/${m.id}` }
      : { type: "url", value: m.url },
    thumbnail: m.thumbnail,
    duration: m.duration,
    width: m.width,
    height: m.height,
  };
}

export interface SerializeInput {
  metaName: string;
  output: ProjectOutput;
  tracks: Array<{ id: string; name: string; locked?: boolean }>;
  video: ProjectRouteState;
  thumb: ProjectRouteState;
  mediaPool: MediaItem[];
  videoClipsLive: TimelineClip[];
  thumbClipsLive: TimelineClip[];
  lyricsSettings: Record<string, unknown>;
}

function routeOf(live: TimelineClip[], snap: ProjectRouteState, pool: MediaItem[]): ProjectRouteState {
  const clips = (live.length > 0 ? live : snap.clips.map((c) => c as unknown as TimelineClip)).map((c) =>
    serializeClip(c, pool),
  );
  return { clips, selectedClipId: snap.selectedClipId };
}

export function serializeProject(input: SerializeInput): ProjectV1 {
  return {
    version: PROJECT_VERSION,
    meta: {
      name: input.metaName || "Untitled Project",
      createdAt: new Date().toISOString(),
      appVersion: "1",
    },
    output: input.output,
    tracks: input.tracks.map((t) => ({ ...t })),
    routes: {
      video: routeOf(input.videoClipsLive, input.video, input.mediaPool),
      thumb: routeOf(input.thumbClipsLive, input.thumb, input.mediaPool),
    },
    mediaPool: input.mediaPool.map(serializeMedia),
    lyricsSettings: { ...input.lyricsSettings },
  };
}
