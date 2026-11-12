// Rehydrate: ProjectV1 + asset bytes → store-ready MediaItem & TimelineClip.
// All DOM element loading (Image/Video/GIF) happens here, centralized.
// gifuct-js loads on demand (GIF path only) so it stays out of the main chunk.
import type { TimelineClip } from "../../shared/types/clip";
import type { MediaItem } from "../media/media-helper";
import type { ProjectMedia, ProjectV1 } from "./schema";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${url.slice(0, 80)}`));
    img.src = url;
  });
}

function loadVideoPair(url: string): Promise<HTMLVideoElement[]> {
  const make = () =>
    new Promise<HTMLVideoElement>((resolve, reject) => {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.loop = false;
      v.playsInline = true;
      (v as HTMLVideoElement & { crossOrigin: string | null }).crossOrigin = "anonymous";
      v.onloadedmetadata = () => resolve(v);
      v.onerror = () => reject(new Error(`failed to load video: ${url.slice(0, 80)}`));
    });
  return Promise.all([make(), make()]);
}

export interface GifDecoded {
  frames: Array<{ canvas: HTMLCanvasElement; delay: number; dims: { left: number; top: number; width: number; height: number } }>;
  durationMs: number;
  width: number;
  height: number;
}

export async function decodeGifBytes(buf: ArrayBuffer): Promise<GifDecoded> {
  const { parseGIF, decompressFrames } = await import("gifuct-js");
  const gif = parseGIF(buf);
  const raw = decompressFrames(gif, true);
  const baking = document.createElement("canvas");
  baking.width = gif.lsd.width;
  baking.height = gif.lsd.height;
  const bctx = baking.getContext("2d")!;
  let prev: ImageData | null = null;
  const frames = raw.map((frame, i) => {
    if (i > 0) {
      const pf = raw[i - 1];
      if (pf.disposalType === 2) {
        bctx.clearRect(pf.dims.left, pf.dims.top, pf.dims.width, pf.dims.height);
      } else if (pf.disposalType === 3 && prev) {
        bctx.putImageData(prev, 0, 0);
      }
    }
    if (frame.disposalType === 3) prev = bctx.getImageData(0, 0, baking.width, baking.height);
    const tmp = document.createElement("canvas");
    tmp.width = frame.dims.width;
    tmp.height = frame.dims.height;
    const tctx = tmp.getContext("2d")!;
    tctx.putImageData(
      new ImageData(frame.patch as unknown as Uint8ClampedArray<ArrayBuffer>, frame.dims.width, frame.dims.height),
      0,
      0,
    );
    bctx.drawImage(tmp, frame.dims.left, frame.dims.top);
    const out = document.createElement("canvas");
    out.width = baking.width;
    out.height = baking.height;
    out.getContext("2d")!.drawImage(baking, 0, 0);
    return {
      canvas: out,
      delay: frame.delay || 100,
      dims: { left: 0, top: 0, width: baking.width, height: baking.height },
    };
  });
  const durationMs = frames.reduce((a, f) => a + f.delay, 0);
  return { frames, durationMs, width: gif.lsd.width, height: gif.lsd.height };
}

function gifThumbnail(frames: GifDecoded["frames"]): string | null {
  try {
    return frames.length > 0 ? frames[0].canvas.toDataURL("image/png") : null;
  } catch {
    return null;
  }
}

/** Rebuild one MediaItem from the project description + asset blob (if any). */
export async function rehydrateMedia(
  m: ProjectMedia,
  assets: Map<string, Blob>,
): Promise<{ item: MediaItem; blob?: Blob }> {
  let url = m.source.type === "url" ? m.source.value : "";
  let blob: Blob | undefined;
  if (m.source.type === "asset") {
    const hit = assets.get(m.source.value) ?? assets.get(m.source.value.replace(/^assets\//, ""));
    if (!hit) throw new Error(`missing asset: ${m.source.value} (${m.name})`);
    blob = hit;
    url = URL.createObjectURL(hit);
  }
  const base: MediaItem = {
    id: m.id,
    name: m.name,
    type: m.kind,
    source: m.origin,
    url,
    thumbnail: m.thumbnail ?? null,
    duration: m.duration,
    width: m.width,
    height: m.height,
    element: null,
    elements: null,
  };
  try {
    if (m.kind === "image") {
      const img = await loadImage(url);
      base.element = img;
      base.width = img.naturalWidth;
      base.height = img.naturalHeight;
    } else if (m.kind === "video") {
      const pair = await loadVideoPair(url);
      base.elements = pair;
      base.duration = pair[0].duration || m.duration;
      base.width = pair[0].videoWidth;
      base.height = pair[0].videoHeight;
    } else if (m.kind === "gif") {
      const buf = blob ? await blob.arrayBuffer() : await (await fetch(url)).arrayBuffer();
      const g = await decodeGifBytes(buf);
      (base as MediaItem & { gifFrames?: unknown; gifDuration?: number }).gifFrames = g.frames;
      (base as MediaItem & { gifFrames?: unknown; gifDuration?: number }).gifDuration = g.durationMs;
      base.duration = g.durationMs / 1000;
      base.width = g.width;
      base.height = g.height;
      if (!base.thumbnail) base.thumbnail = gifThumbnail(g.frames);
    }
    // audio: no element needed, URL is enough.
  } catch (e) {
    // A failed media load does not fail the whole project.
    console.warn(`[project] failed to load media (${m.name}):`, e);
  }
  return { item: base, blob };
}

/** Collect upload bytes for export: fetch pool blob: URLs + music audio. */
export interface ExportBlobsResult {
  blobs: Map<string, Blob>;
  /** Names of remote media that failed to download and keep using their URL. */
  remoteKept: string[];
}

export async function collectExportBlobs(
  project: ProjectV1,
  liveUrlOf: (mediaId: string) => string | undefined,
  liveAudioUrlOf: (syntheticId: string) => string | undefined,
): Promise<ExportBlobsResult> {
  const out = new Map<string, Blob>();
  const remoteKept: string[] = [];
  for (const m of project.mediaPool) {
    if (m.source.type === "asset") {
      const liveUrl = liveUrlOf(m.id);
      if (!liveUrl) continue;
      try {
        // blob: URLs are local uploads; remote URLs are best-effort
        // downloads so the bundle stays self-contained.
        const blob = await (await fetch(liveUrl)).blob();
        if (blob && blob.size > 0) out.set(m.source.value, blob);
      } catch {
        /* skip missing media */
      }
      continue;
    }
    // Remote (pexels/pixabay/url): best-effort download so the bundle is self-contained
    // and opens offline. On failure (e.g. CORS) → keep the URL reference.
    if (m.source.type === "url" && m.source.value) {
      try {
        const res = await fetch(m.source.value);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob || blob.size === 0) throw new Error("empty bytes");
        const key = `assets/${m.id}`;
        out.set(key, blob);
        m.source = { type: "asset", value: key };
      } catch {
        remoteKept.push(m.name);
      }
    }
  }
  // Pool-less music (timeline file picker): audio belongs to the clip, NOT library
  // media — blob stored at assets/__clip_<id>.audio, with no pool entry
  // (synthetic audio pool entries pollute the Uploads tab with blank cards).
  for (const route of [project.routes.video, project.routes.thumb]) {
    for (const c of route.clips) {
      if (c.media?.mediaId.startsWith("__clip:")) {
        const u = liveAudioUrlOf(c.media.mediaId);
        if (!u) continue;
        try {
          const blob = await (await fetch(u)).blob();
          out.set(`assets/__clip_${c.media.mediaId.slice("__clip:".length)}.audio`, blob);
        } catch {
          /* skip — clip keeps its remote URL */
        }
      }
    }
  }
  return { blobs: out, remoteKept };
}

/** Build a store-ready TimelineClip from a ProjectClip + live pool. */
export function rehydrateClip(
  c: ProjectV1["routes"]["video"]["clips"][number],
  pool: MediaItem[],
): TimelineClip {
  const settings: Record<string, unknown> = { ...(c.settings as object) };
  // Lyrics without ids (old/synthetic bundles) — assign stable ids so stamp/
  // per-line reset/delete and React keys don't target the wrong row.
  if (Array.isArray(settings.lines)) {
    settings.lines = (settings.lines as Array<Record<string, unknown>>).map(
      (l, i) => ({
        ...l,
        id:
          typeof l.id === "string" && l.id
            ? l.id
            : `lyric-imported-${i}-${Date.now().toString(36)}`,
      }),
    );
  }
  const ref = c.media;
  if (ref) {
    const hit =
      pool.find((m) => m.id === ref.mediaId) ??
      pool.find((m) => m.id === (ref.mediaId.startsWith("assets/") ? ref.mediaId.slice(7) : ref.mediaId));
    if (hit) {
      settings.mediaId = hit.id;
      if (ref.mediaType === "video" || (hit.type === "video" && ref.mediaType !== "image")) {
        settings.mediaElements = hit.elements ?? null;
        settings.mediaType = "video";
      } else if (hit.type === "gif") {
        settings.gifFrames =
          (hit as MediaItem & { gifFrames?: unknown }).gifFrames ?? null;
        settings.gifDuration =
          (hit as MediaItem & { gifDuration?: number }).gifDuration ?? 0;
        settings.mediaType = "gif";
      } else if (hit.type === "image") {
        settings.mediaElement = hit.element ?? null;
        settings.mediaType = "image";
      }
      if (typeof settings.fileName !== "string" || !settings.fileName) {
        settings.fileName = ref.fileName ?? hit.name;
      }
      if ((settings.thumbnail == null || settings.thumbnail === "") && hit.thumbnail) {
        settings.thumbnail = hit.thumbnail;
      }
      if (typeof settings.videoDuration !== "number" && hit.duration) {
        settings.videoDuration = hit.duration;
      }
    }
    // Audio (music): audioUrl points at the pool URL / clip asset.
    const audioHolder = settings as Record<string, unknown>;
    if (typeof audioHolder.audioUrl === "string") {
      const poolHit = pool.find((m) => m.url === audioHolder.audioUrl);
      if (poolHit) audioHolder.audioUrl = poolHit.url;
      else if (ref.mediaId.startsWith("assets/")) {
        const byAsset = pool.find((m) => m.id === ref.mediaId || m.url.includes(ref.mediaId));
        if (byAsset) audioHolder.audioUrl = byAsset.url;
      }
    }
  }
  return {
    id: c.id,
    type: c.type,
    trackId: c.trackId,
    start: c.start,
    duration: c.duration,
    settings,
  };
}
