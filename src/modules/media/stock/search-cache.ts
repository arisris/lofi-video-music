// Stock search cache (Pexels + Pixabay): a preconfigured shared request
// cache. Entries are keyed by effective request params — never by API key —
// and are dropped whenever the user changes a key.

import { createRequestCache } from "../../../shared/lib/request-cache";
import { STOCK_KEYS_EVENT } from "./api-keys";

const stockCache = createRequestCache({
  storagePrefix: "lofi.stock.",
  ttlMs: 10 * 60 * 1000,
  maxEntries: 100,
  maxEntryBytes: 1_000_000,
});

/** Build a cache key from effective request params (never include the API key). */
export const buildStockCacheKey = (
  provider: string,
  params: Record<string, unknown>,
): string => `${provider}:${JSON.stringify(params)}`;

export function fetchStockCached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  return stockCache.fetchCached(key, loader);
}

// Tier access (tests, inspection).
export const readSessionTier = <T>(key: string): T | null =>
  stockCache.read<T>(key);
export const writeSessionTier = (key: string, data: unknown): void =>
  stockCache.write(key, data);
export const clearSessionTiers = (): void => stockCache.clear();

// Results fetched with one key must never be served to another key.
if (typeof window !== "undefined") {
  window.addEventListener(STOCK_KEYS_EVENT, () => stockCache.clear());
}
