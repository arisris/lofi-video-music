// Generic two-tier request cache: fast in-memory L1 plus sessionStorage L2.
// L2 survives page reloads but dies with the tab — nothing is ever written
// to disk. Reads refresh recency (true LRU with idle TTL); quota pressure
// evicts least-recently-used entries first so new writes can land.
//
// In-flight deduplication is built in: concurrent identical requests share
// a single loader execution. Failures are never cached.

export interface RequestCacheOptions {
  /** sessionStorage key prefix (namespace). Omit for a memory-only cache. */
  storagePrefix?: string;
  /** Freshness window in ms (idle: refreshed on every read). Defaults to 10 min. */
  ttlMs?: number;
  /** Max in-memory entries (LRU). Defaults to 100. */
  maxEntries?: number;
  /** Max serialized bytes per sessionStorage entry. Defaults to 1_000_000. */
  maxEntryBytes?: number;
}

export interface RequestCache {
  fetchCached<T>(key: string, loader: () => Promise<T>): Promise<T>;
  read<T>(key: string): T | null;
  write(key: string, data: unknown): void;
  clear(): void;
}

interface StoredEntry {
  at: number;
  seq: number;
  data: unknown;
}

function isQuotaError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || code === 22 || code === 1014;
}

export function createRequestCache(
  options: RequestCacheOptions = {},
): RequestCache {
  const {
    storagePrefix,
    ttlMs = 10 * 60 * 1000,
    maxEntries = 100,
    maxEntryBytes = 1_000_000,
  } = options;

  const mem = new Map<string, StoredEntry>();
  const inflight = new Map<string, Promise<unknown>>();
  // Monotonic tiebreaker for same-millisecond timestamps (see eviction).
  let seq = 0;

  const store = (): Storage | null => {
    if (!storagePrefix) return null;
    try {
      return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
      return null;
    }
  };

  /** Refresh a session entry's recency without resurrecting evicted keys. */
  const touchTier = (key: string, data: unknown): void => {
    if (!storagePrefix) return;
    const s = store();
    if (!s) return;
    const full = storagePrefix + key;
    try {
      if (s.getItem(full) === null) return;
      s.setItem(full, JSON.stringify({ at: Date.now(), seq: ++seq, data }));
    } catch {
      /* recency refresh is optional */
    }
  };

  const readTier = <T>(key: string): T | null => {
    if (!storagePrefix) return null;
    const s = store();
    if (!s) return null;
    let raw: string | null = null;
    try {
      raw = s.getItem(storagePrefix + key);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as Partial<StoredEntry>;
      if (typeof entry.at !== "number" || Date.now() - entry.at > ttlMs) {
        try {
          s.removeItem(storagePrefix + key);
        } catch {
          /* ignore */
        }
        return null;
      }
      // Touch: a read counts as use — refresh recency (idle TTL).
      touchTier(key, entry.data);
      return entry.data as T;
    } catch {
      try {
        s.removeItem(storagePrefix + key);
      } catch {
        /* ignore */
      }
      return null;
    }
  };

  /** Remove the least-recently-used entry. Returns false when none remain. */
  const evictOldest = (s: Storage, prefix: string): boolean => {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    let oldestSeq = Infinity;
    try {
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (!k?.startsWith(prefix)) continue;
        // Unparseable entries sort first (at = 0): evicted before valid ones.
        let at = 0;
        let sq = 0;
        try {
          const entry = JSON.parse(s.getItem(k) ?? "") as Partial<StoredEntry>;
          if (typeof entry.at === "number") at = entry.at;
          if (typeof entry.seq === "number") sq = entry.seq;
        } catch {
          /* keep at = 0 */
        }
        if (at < oldestAt || (at === oldestAt && sq < oldestSeq)) {
          oldestAt = at;
          oldestSeq = sq;
          oldestKey = k;
        }
      }
    } catch {
      return false;
    }
    if (!oldestKey) return false;
    try {
      s.removeItem(oldestKey);
      return true;
    } catch {
      return false;
    }
  };

  const writeTier = (key: string, data: unknown): void => {
    if (!storagePrefix) return;
    const s = store();
    if (!s) return;
    let json: string;
    try {
      json = JSON.stringify({ at: Date.now(), seq: ++seq, data });
    } catch {
      return;
    }
    if (json.length > maxEntryBytes) return;
    // Quota full: evict least-recently-used entries until the write fits.
    // Each pass removes one entry, so the loop always terminates.
    for (;;) {
      try {
        s.setItem(storagePrefix + key, json);
        return;
      } catch (e) {
        if (!isQuotaError(e) || !evictOldest(s, storagePrefix)) return;
      }
    }
  };

  const writeMem = (key: string, data: unknown): void => {
    if (mem.size >= maxEntries) {
      const oldest = mem.keys().next();
      if (!oldest.done) mem.delete(oldest.value);
    }
    mem.set(key, { at: Date.now(), seq: ++seq, data });
  };

  const read = <T>(key: string): T | null => {
    const hit = mem.get(key);
    if (hit) {
      if (Date.now() - hit.at > ttlMs) {
        mem.delete(key);
      } else {
        mem.delete(key);
        mem.set(key, hit);
        // Keep L2 recency in step so post-reload eviction reflects true use.
        touchTier(key, hit.data);
        return hit.data as T;
      }
    }
    const tierHit = readTier<T>(key);
    if (tierHit != null) {
      writeMem(key, tierHit);
      return tierHit;
    }
    return null;
  };

  const write = (key: string, data: unknown): void => {
    writeMem(key, data);
    writeTier(key, data);
  };

  const clear = (): void => {
    mem.clear();
    if (!storagePrefix) return;
    const s = store();
    if (!s) return;
    const doomed: string[] = [];
    try {
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(storagePrefix)) doomed.push(k);
      }
    } catch {
      return;
    }
    doomed.forEach((k) => {
      try {
        s.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  };

  const fetchCached = async <T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> => {
    const hit = read<T>(key);
    if (hit != null) return hit;
    const ongoing = inflight.get(key) as Promise<T> | undefined;
    if (ongoing) return ongoing;
    const task = loader().then(
      (data) => {
        inflight.delete(key);
        write(key, data);
        return data;
      },
      (err) => {
        inflight.delete(key);
        throw err;
      },
    );
    inflight.set(key, task);
    return task;
  };

  return { fetchCached, read, write, clear };
}
