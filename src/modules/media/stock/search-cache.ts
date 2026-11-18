// Short-lived in-memory cache for stock search responses (Pexels + Pixabay).
// The library panel remounts on every rail-tab switch, wiping its result
// lists — without this cache every identical query would hit the provider
// again. Entries live at module scope so they survive remounts.

import { STOCK_KEYS_EVENT } from "./api-keys";

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;

const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/** Build a cache key from effective request params (never include the API key). */
export const buildStockCacheKey = (
  provider: string,
  params: Record<string, unknown>,
): string => `${provider}:${JSON.stringify(params)}`;

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh recency.
  cache.delete(key);
  cache.set(key, hit);
  return hit.data as T;
}

function writeCache(key: string, data: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), data });
}

/**
 * Return the cached response when fresh; otherwise run `loader` once even
 * across concurrent callers, then cache the result. Failures are never cached.
 */
export async function fetchStockCached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = readCache<T>(key);
  if (hit) return hit;
  const ongoing = inflight.get(key) as Promise<T> | undefined;
  if (ongoing) return ongoing;
  const task = loader().then(
    (data) => {
      inflight.delete(key);
      writeCache(key, data);
      return data;
    },
    (err) => {
      inflight.delete(key);
      throw err;
    },
  );
  inflight.set(key, task);
  return task;
}

// Results fetched with one key must never be served to another key.
if (typeof window !== "undefined") {
  window.addEventListener(STOCK_KEYS_EVENT, () => {
    cache.clear();
  });
}
