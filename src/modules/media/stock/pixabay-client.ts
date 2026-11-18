// Direct Pixabay API client (no proxy). The caller supplies the user's own key,
// sent as the `key` query parameter. See https://pixabay.com/api/docs/.
import { buildStockCacheKey, fetchStockCached } from "./search-cache";

export interface PixabayItem {
  id: number;
  user: string;
  duration: number;
  videos: Record<
    string,
    { url: string; width: number; height: number; thumbnail?: string }
  >;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  pageURL: string;
}

export interface PixabaySearchParams {
  key: string;
  query: string;
  type: "video" | "photo" | "illustration" | "vector";
  orientation?: "all" | "landscape" | "portrait";
  colors?: string;
  page?: number;
  per_page?: number;
}

export interface PixabaySearchResult {
  hits: PixabayItem[];
}

/** Throw a readable Error when the Pixabay API rejects the request. */
async function throwForStatus(res: Response): Promise<never> {
  let detail = "";
  try {
    const text = await res.text();
    if (text) detail = `: ${text.slice(0, 200)}`;
  } catch {
    /* unreadable body — keep the generic message */
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error(
      `Invalid Pixabay API key (rejected with ${res.status})${detail}`,
    );
  }
  if (res.status === 429) {
    throw new Error(
      `Pixabay rate limit reached (${res.status}). Try again later${detail}`,
    );
  }
  throw new Error(`Pixabay search failed (${res.status})${detail}`);
}

export async function searchPixabayDirect(
  params: PixabaySearchParams,
): Promise<PixabaySearchResult> {
  const { key, query, type } = params;
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 55;
  const orientation = params.orientation ?? "all";
  const colors = params.colors ?? "";
  return fetchStockCached<PixabaySearchResult>(
    buildStockCacheKey("pixabay", {
      query: query.trim(),
      type,
      orientation,
      colors,
      page,
      per_page,
    }),
    async () => {
      // The video and image endpoints live under different paths.
      const path = type === "video" ? "videos/" : "";
      let url =
        `https://pixabay.com/api/${path}` +
        `?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query.trim())}&page=${page}&per_page=${per_page}`;
      if (type !== "video") {
        url += `&image_type=${type}`;
      }
      if (orientation !== "all") {
        url += `&orientation=${orientation}`;
      }
      if (colors) {
        url += `&colors=${encodeURIComponent(colors)}`;
      }
      // Never touch the browser disk cache (see pexels-client.ts): stock
      // results must not survive a restart.
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) await throwForStatus(res);
      const data = (await res.json()) as Partial<PixabaySearchResult>;
      return { hits: data.hits ?? [] };
    },
  );
}
