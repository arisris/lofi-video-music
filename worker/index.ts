/**
 * Cloudflare Worker — proxies Pexels and Pixabay search so the API keys never
 * reach the browser. Registered via `main` in `wrangler.json`.
 *
 * Routed with Hono; GET responses are cached for an hour via `hono/cache`
 * (Cache API, keyed per URL). Only status 200 is cached — validation,
 * upstream, and server errors always pass through.
 */

import { Hono } from "hono";
import { cache } from "hono/cache";

/** Bindings/secret values available to this Worker. */
interface Env {
  /** Pexels API key (secret). */
  PEXELS_API_KEY: string;
  /** Pixabay API key (secret). */
  PIXABAY_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

/** Turns an unknown thrown value into a message without leaking a stack trace. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Reproduces a non-OK upstream status while quoting the upstream body. */
async function upstreamError(
  provider: string,
  response: Response,
): Promise<Response> {
  const errText = await response.text();
  return Response.json(
    { error: `${provider} API error: ${response.status} - ${errText}` },
    { status: response.status },
  );
}

const PEXELS_ORIENTATIONS = ["landscape", "portrait", "square"];
const PIXABAY_ORIENTATIONS = ["all", "landscape", "portrait"];

app.get(
  "/api/pexels/search",
  cache({ cacheName: "pexels", cacheControl: "public, max-age=3600" }),
  async (c) => {
    const query = c.req.query("query") || "";
    const type = c.req.query("type") || "video";
    const orientation = c.req.query("orientation") || "";
    const page = c.req.query("page") || "1";
    const perPage = c.req.query("per_page") || "30";

    if (!query) {
      return c.json({ error: "Query parameter is required" }, 400);
    }

    const apiKey = c.env.PEXELS_API_KEY;
    if (!apiKey) {
      return c.json({ error: "Pexels API key not configured on server" }, 500);
    }

    try {
      const path = type === "photo" ? "search" : "videos/search";
      let pexelsUrl =
        `https://api.pexels.com/v1/${path}` +
        `?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;

      if (PEXELS_ORIENTATIONS.includes(orientation)) {
        pexelsUrl += `&orientation=${orientation}`;
      }

      const response = await fetch(pexelsUrl, {
        headers: { Authorization: apiKey },
      });

      if (!response.ok) {
        return upstreamError("Pexels", response);
      }

      return c.json(await response.json());
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 500);
    }
  },
);

app.get(
  "/api/pixabay/search",
  cache({ cacheName: "pixabay", cacheControl: "public, max-age=3600" }),
  async (c) => {
    const query = c.req.query("query") || "";
    const type = c.req.query("type") || "video";
    const orientation = c.req.query("orientation") || "";
    const colors = c.req.query("colors") || "";
    const page = c.req.query("page") || "1";
    const perPage = c.req.query("per_page") || "30";

    if (!query) {
      return c.json({ error: "Query parameter is required" }, 400);
    }

    const apiKey = c.env.PIXABAY_API_KEY;
    if (!apiKey) {
      return c.json({ error: "Pixabay API key not configured on server" }, 500);
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

      return c.json(await response.json());
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 500);
    }
  },
);

app.get("/api/transcribe", (c) => {
  return c.json({ message: "Not yet implemented" });
});

app.notFound((c) => c.body(null, 404));

export default app;
