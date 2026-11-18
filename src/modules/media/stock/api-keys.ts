// User-provided stock API keys, stored in localStorage (per browser, per user).
// These keys never leave the device except as credentials on direct
// api.pexels.com / pixabay.com requests. They are never part of project bundles.

const PEXELS_STORAGE_KEY = "lofi.pexelsKey";
const PIXABAY_STORAGE_KEY = "lofi.pixabayKey";

/** Fired on window whenever either key is saved or cleared. */
export const STOCK_KEYS_EVENT = "lofi:stock-keys-changed";

export const PEXELS_KEY_URL = "https://www.pexels.com/api/";
export const PIXABAY_KEY_URL = "https://pixabay.com/api/docs/";

export const MISSING_PEXELS_KEY_MESSAGE =
  "No Pexels API key saved. Add your free key in Settings to search Pexels.";
export const MISSING_PIXABAY_KEY_MESSAGE =
  "No Pixabay API key saved. Add your free key in Settings to search Pixabay.";

function readKey(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeKey(storageKey: string, key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(storageKey, trimmed);
    else localStorage.removeItem(storageKey);
  } catch {
    /* storage blocked — key stays session-only in the caller's state */
  }
  window.dispatchEvent(new CustomEvent(STOCK_KEYS_EVENT));
}

export const getPexelsKey = (): string => readKey(PEXELS_STORAGE_KEY);
export const getPixabayKey = (): string => readKey(PIXABAY_STORAGE_KEY);

export const setPexelsKey = (key: string): void =>
  writeKey(PEXELS_STORAGE_KEY, key);
export const setPixabayKey = (key: string): void =>
  writeKey(PIXABAY_STORAGE_KEY, key);
