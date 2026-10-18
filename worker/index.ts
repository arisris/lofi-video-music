/**
 * Cloudflare Worker — proxies Pexels and Pixabay search so the API keys never
 * reach the browser. Registered via `main` in `wrangler.json`.
 */

/** Bindings/secret values available to this Worker. */
interface Env {
  /** Pexels API key (secret). */
  PEXELS_API_KEY: string;
  /** Pixabay API key (secret). */
  PIXABAY_API_KEY: string;
}

/** `caches.default` is the per-isolate cache in Workers; absent in some runtimes. */
function getCache(): Cache | null {
  try {
    return caches.default;
  } catch {
    console.warn("Cache API not available in this environment");
    return null;
  }
}

/** Returns a cached response for this URL, or null on a miss/unavailable cache. */
async function readCache(url: URL, request: Request): Promise<Response | null> {
  const cache = getCache();
  if (!cache) return null;

  try {
    const cached = await cache.match(new Request(url.toString(), request));
    if (cached) return cached;
  } catch (e) {
    console.warn("Error reading from cache:", e);
  }
  return null;
}

/** Stores a response for an hour, detached from the request lifetime. */
function writeCache(
  url: URL,
  request: Request,
  response: Response,
  ctx: ExecutionContext | undefined,
): void {
  const cache = getCache();
  if (!cache || !ctx) return;

  try {
    ctx.waitUntil(cache.put(new Request(url.toString(), request), response.clone()));
  } catch (e) {
    console.warn("Error writing to cache:", e);
  }
}

/** Wraps an upstream body in a JSON response that is safe to cache publicly. */
function cacheableJson(data: unknown): Response {
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
}

/** Turns an unknown thrown value into a message without leaking a stack trace. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Reproduces a non-OK upstream status while quoting the upstream body. */
async function upstreamError(provider: string, response: Response): Promise<Response> {
  const errText = await response.text();
  return Response.json(
    { error: `${provider} API error: ${response.status} - ${errText}` },
    { status: response.status },
  );
}

const PEXELS_ORIENTATIONS = ["landscape", "portrait", "square"];
const PIXABAY_ORIENTATIONS = ["all", "landscape", "portrait"];

async function handlePexelsSearch(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const query = url.searchParams.get("query") || "";
  const type = url.searchParams.get("type") || "video";
  const orientation = url.searchParams.get("orientation") || "";
  const page = url.searchParams.get("page") || "1";
  const perPage = url.searchParams.get("per_page") || "30";

  if (!query) {
    return Response.json({ error: "Query parameter is required" }, { status: 400 });
  }

  const apiKey = env.PEXELS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Pexels API key not configured on server" }, { status: 500 });
  }

  const cachedResponse = await readCache(url, request);
  if (cachedResponse) {
    console.log("Pexels query cache hit:", url.toString());
    return cachedResponse;
  }

  try {
    const path = type === "photo" ? "search" : "videos/search";
    let pexelsUrl =
      `https://api.pexels.com/v1/${path}` +
      `?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;

    if (PEXELS_ORIENTATIONS.includes(orientation)) {
      pexelsUrl += `&orientation=${orientation}`;
    }

    const response = await fetch(pexelsUrl, { headers: { Authorization: apiKey } });

    if (!response.ok) {
      return upstreamError("Pexels", response);
    }

    const apiResponse = cacheableJson(await response.json());
    writeCache(url, request, apiResponse, ctx);
    return apiResponse;
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}

async function handlePixabaySearch(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const query = url.searchParams.get("query") || "";
  const type = url.searchParams.get("type") || "video";
  const orientation = url.searchParams.get("orientation") || "";
  const colors = url.searchParams.get("colors") || "";
  const page = url.searchParams.get("page") || "1";
  const perPage = url.searchParams.get("per_page") || "30";

  if (!query) {
    return Response.json({ error: "Query parameter is required" }, { status: 400 });
  }

  const apiKey = env.PIXABAY_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Pixabay API key not configured on server" }, { status: 500 });
  }

  const cachedResponse = await readCache(url, request);
  if (cachedResponse) {
    console.log("Pixabay query cache hit:", url.toString());
    return cachedResponse;
  }

  try {
    // The video and image endpoints live under different paths.
    const path = type === "video" ? "videos/" : "";
    let pixabayUrl =
      `https://pixabay.com/api/${path}` +
      `?key=${apiKey}&q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;

    if (type !== "video" && type !== "all") {
      pixabayUrl += `&image_type=${type}`;
    }

    if (PIXABAY_ORIENTATIONS.includes(orientation)) {
      pixabayUrl += `&orientation=${orientation}`;
    }

    if (colors === "transparent") {
      pixabayUrl += `&colors=transparent`;
    }

    const response = await fetch(pixabayUrl);

    if (!response.ok) {
      return upstreamError("Pixabay", response);
    }

    const apiResponse = cacheableJson(await response.json());
    writeCache(url, request, apiResponse, ctx);
    return apiResponse;
  } catch (err) {
    return Response.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/pexels/search") {
      return handlePexelsSearch(request, url, env, ctx);
    }

    if (url.pathname === "/api/pixabay/search") {
      return handlePixabaySearch(request, url, env, ctx);
    }

    if (url.pathname === "/api/transcribe") {
      return Response.json({ message: "Not yet implemented" });
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;