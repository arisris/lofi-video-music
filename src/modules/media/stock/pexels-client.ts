// Direct Pexels API client (no proxy). The caller supplies the user's own key,
// sent as the Authorization header. See https://www.pexels.com/api/.

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  src: Record<string, string>;
}

export interface PexelsVideoFile {
  width: number;
  height: number;
  link: string;
  file_type: string;
  quality?: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
  user?: { name: string; url: string };
}

export interface PexelsSearchParams {
  key: string;
  query: string;
  type: "video" | "photo";
  orientation?: "all" | "landscape" | "portrait" | "square";
  page?: number;
  per_page?: number;
}

export interface PexelsSearchResult {
  photos: PexelsPhoto[];
  videos: PexelsVideo[];
}

/** Throw a readable Error when the Pexels API rejects the request. */
async function throwForStatus(res: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error)
      detail = `: ${body.error}`;
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Invalid Pexels API key (rejected with ${res.status})${detail}`,
    );
  }
  if (res.status === 429) {
    throw new Error(
      `Pexels rate limit reached (${res.status}). Try again later${detail}`,
    );
  }
  throw new Error(`Pexels search failed (${res.status})${detail}`);
}

export async function searchPexelsDirect(
  params: PexelsSearchParams,
): Promise<PexelsSearchResult> {
  const { key, query, type } = params;
  const page = params.page ?? 1;
  const per_page = params.per_page ?? 50;
  const path = type === "photo" ? "search" : "videos/search";
  let url =
    `https://api.pexels.com/v1/${path}` +
    `?query=${encodeURIComponent(query.trim())}&page=${page}&per_page=${per_page}`;
  if (params.orientation && params.orientation !== "all") {
    url += `&orientation=${params.orientation}`;
  }
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) await throwForStatus(res);
  const data = (await res.json()) as Partial<PexelsSearchResult>;
  return { photos: data.photos ?? [], videos: data.videos ?? [] };
}
