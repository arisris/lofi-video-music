import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { createHandlers } from "../lib/factory";

/** Empty query params arrive as "" — treat them as missing so defaults apply. */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** Full validation for every query param this endpoint accepts. */
export const pexelsQuerySchema = z.object({
  query: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().trim().min(1, "Query parameter is required"),
  ),
  type: z.preprocess(
    emptyToUndefined,
    z.enum(["video", "photo"]).default("video"),
  ),
  orientation: z.preprocess(
    emptyToUndefined,
    z.enum(["landscape", "portrait", "square"]).optional(),
  ),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).default(1),
  ),
  per_page: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(80).default(30),
  ),
});

export const pexelsSearchApiHandlers = createHandlers(
  cache({ cacheName: "pexels", cacheControl: "public, max-age=3600" }),
  zValidator("query", pexelsQuerySchema, (result) => {
    if (!result.success) {
      const first = result.error.issues[0];
      throw new HTTPException(400, {
        message: first?.message ?? "Invalid query parameters",
      });
    }
  }),
  async (c) => {
    const { query, type, orientation, page, per_page } = c.req.valid("query");

    const apiKey = c.env.PEXELS_API_KEY;
    if (!apiKey) {
      throw new HTTPException(500, {
        message: "Pexels API key not configured on server",
      });
    }

    const path = type === "photo" ? "search" : "videos/search";
    let pexelsUrl =
      `https://api.pexels.com/v1/${path}` +
      `?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`;

    if (orientation) {
      pexelsUrl += `&orientation=${orientation}`;
    }

    let response: Response;
    try {
      response = await fetch(pexelsUrl, {
        headers: { Authorization: apiKey },
      });
    } catch (err) {
      throw new HTTPException(500, {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new HTTPException(response.status as ContentfulStatusCode, {
        message: `Pexels API error: ${response.status} - ${errText}`,
      });
    }

    return c.json(await response.json());
  },
);
