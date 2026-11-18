// Short-lived session cache for stock search responses (Pexels + Pixabay).
// The library panel remounts on every rail-tab switch, wiping its result
// lists — without this cache every identical query would hit the provider
// again. Two tiers: a fast in-memory Map plus sessionStorage, so results
// survive a page reload but never a closed tab: stock responses must not
// persist on disk beyond the session.

import { STOCK_KEYS_EVENT } from "./api-keys";

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 100;
/** Largest single response (serialized) allowed into sessionStorage. */
const SESSION_MAX_BYTES = 1_000_000;
const SESSION_PREFIX = "lofi.stock.";

const memCache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readSessionTier<T>(key: string): T | null {
  const store = sessionStore();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(SESSION_PREFIX + key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > TTL_MS) {
      store.removeItem(SESSION_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    store.removeItem(SESSION_PREFIX + key);
    return null;
  }
}

export function writeSessionTier(key: string, data: unknown): void {
  const store = sessionStore();
  if (!store) return;
  let json: string;
  try {
    json = JSON.stringify({ at: Date.now(), data });
  } catch {
    return;
  }
  if (json.length > SESSION_MAX_BYTES) return;
  try {
    store.setItem(SESSION_PREFIX + key, json);
  } catch {
    // Quota full: drop our own stale entries once, then give up silently.
    try {
      clearSessionTiers();
      store.setItem(SESSION_PREFIX + key, json);
    } catch {
      /* session caching unavailable — memory tier still applies */
    }
  }
}

export function clearSessionTiers(): void {
  const store = sessionStore();
  if (!store) return;
  const doomed: string[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k?.startsWith(SESSION_PREFIX)) doomed.push(k);
    }
  } catch {
    return;
  }
  doomed.forEach((k) => {
    try {
      store.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}

/** Build a cache key from effective request params (never include the API key). */
export const buildStockCacheKey = (
  provider: string,
  params: Record<string, unknown>,
): string => `${provider}:${JSON.stringify(params)}`;

function readMemCache<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    memCache.delete(key);
    return null;
  }
  // Refresh recency.
  memCache.delete(key);
  memCache.set(key, hit);
  return hit.data as T;
}

function writeMemCache(key: string, data: unknown): void {
  if (memCache.size >= MAX_ENTRIES) {
    const oldest = memCache.keys().next();
    if (!oldest.done) memCache.delete(oldest.value);
  }
  memCache.set(key, { at: Date.now(), data });
}

/**
 * Return the cached response when fresh (memory first, then sessionStorage);
 * otherwise run `loader` once even across concurrent callers, then cache the
 * result in both tiers. Failures are never cached.
 */
export async function fetchStockCached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const memHit = readMemCache<T>(key);
  if (memHit) return memHit;
  const sessionHit = readSessionTier<T>(key);
  if (sessionHit) {
    writeMemCache(key, sessionHit);
    return sessionHit;
  }
  const ongoing = inflight.get(key) as Promise<T> | undefined;
  if (ongoing) return ongoing;
  const task = loader().then(
    (data) => {
      inflight.delete(key);
      writeMemCache(key, data);
      writeSessionTier(key, data);
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
    memCache.clear();
    clearSessionTiers();
  });
}
