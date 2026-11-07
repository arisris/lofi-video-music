import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createHandlers } from "../lib/factory";

/** Empty query params arrive as "" — treat them as missing so defaults apply. */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** Full validation for every query param this endpoint accepts. */
export const pixabayQuerySchema = z.object({
  query: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().trim().min(1, "Query parameter is required"),
  ),
  type: z.preprocess(
    emptyToUndefined,
    z.enum(["video", "photo", "illustration", "vector", "all"]).default("video"),
  ),
  orientation: z.preprocess(
    emptyToUndefined,
    z.enum(["all", "landscape", "portrait"]).default("all"),
  ),
  colors: z.preprocess(
    emptyToUndefined,
    z.enum(["transparent"]).optional(),
  ),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).default(1),
  ),
  per_page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(3).max(200).default(30),
  ),
});

export const pixabaySearchApiHandlers = createHandlers(
  cache({ cacheName: "pixabay", cacheControl: "public, max-age=3600" }),
  zValidator("query", pixabayQuerySchema, (result) => {
    if (!result.success) {
      const first = result.error.issues[0];
      throw new HTTPException(400, {
        message: first?.message ?? "Invalid query parameters",
      });
    }
  }),
  async (c) => {
    const { query, type, orientation, colors, page, per_page } =
      c.req.valid("query");

    const apiKey = c.env.PIXABAY_API_KEY;
    if (!apiKey) {
      throw new HTTPException(500, {
        message: "Pixabay API key not configured on server",
      });
    }

    // The video and image endpoints live under different paths.
    const path = type === "video" ? "videos/" : "";
    let pixabayUrl =
      `https://pixabay.com/api/${path}` +
      `?key=${apiKey}&q=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`;

    if (type !== "video" && type !== "all") {
      pixabayUrl += `&image_type=${type}`;
    }

    if (orientation !== "all") {
      pixabayUrl += `&orientation=${orientation}`;
    }

    if (colors === "transparent") {
      pixabayUrl += `&colors=transparent`;
    }

    let response: Response;
    try {
      response = await fetch(pixabayUrl);
    } catch (err) {
      throw new HTTPException(500, {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new HTTPException(response.status as ContentfulStatusCode, {
        message: `Pixabay API error: ${response.status} - ${errText}`,
      });
    }

    return c.json(await response.json());
  },
);
