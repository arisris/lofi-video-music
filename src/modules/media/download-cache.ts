// Persistent cache for remote provider downloads (Pexels/Pixabay only).
// Bytes live in IndexedDB so the Downloaded section survives across sessions;
// only metadata + blob are stored, live elements are rebuilt on hydrate.
import type { MediaItem } from "./media-helper";

const DB_NAME = "MediaLibraryDb";
const DB_VERSION = 1;
const STORE_NAME = "downloaded";

export interface DownloadRecord {
  id: string;
  name: string;
  type: string;
  source: string;
  mime: string;
  blob: Blob;
  thumbnail: string | null;
  duration: number;
  width: number;
  height: number;
  remoteUrl: string;
  createdAt: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    openDb().then((db) => {
      const t = db.transaction(STORE_NAME, mode);
      const req = run(t.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }, reject);
  });

export const listDownloads = (): Promise<DownloadRecord[]> =>
  tx<DownloadRecord[]>("readonly", (s) => s.getAll()).catch((err) => {
    console.warn("[downloads] list failed:", err);
    return [];
  });

export const putDownload = (rec: DownloadRecord): Promise<void> =>
  tx("readwrite", (s) => s.put(rec)).then(() => undefined);

export const deleteDownload = (id: string): Promise<void> =>
  tx("readwrite", (s) => s.delete(id))
    .then(() => undefined)
    .catch((err) => {
      console.warn("[downloads] delete failed:", err);
    });

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to load downloaded image"));
    img.src = url;
  });
}

function loadVideoEl(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.loop = false;
    v.playsInline = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error("failed to load downloaded video"));
    v.load();
  });
}

/** Rebuild live MediaItems from persisted blobs (fresh blob: URLs per session). */
export async function hydrateDownloads(): Promise<MediaItem[]> {
  const recs = await listDownloads();
  const out: MediaItem[] = [];
  for (const r of recs) {
    try {
      const url = URL.createObjectURL(r.blob);
      const base = {
        id: r.id,
        name: r.name,
        type: r.type,
        source: r.source,
        url,
        thumbnail: r.thumbnail,
        duration: r.duration,
        width: r.width,
        height: r.height,
        persisted: true as const,
      };
      if (r.type === "video") {
        const [a, b] = await Promise.all([loadVideoEl(url), loadVideoEl(url)]);
        out.push({
          ...base,
          duration: a.duration || r.duration,
          width: a.videoWidth || r.width,
          height: a.videoHeight || r.height,
          element: null,
          elements: [a, b],
        });
      } else {
        const img = await loadImageEl(url);
        out.push({
          ...base,
          width: img.naturalWidth || r.width,
          height: img.naturalHeight || r.height,
          element: img,
          elements: null,
        });
      }
    } catch (err) {
      console.warn(`[downloads] skip ${r.name}:`, err);
    }
  }
  return out;
}
