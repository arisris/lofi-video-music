import { createFactory } from "hono/factory";

export type Bindings = {
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;
};
export type HEnv = {
  Variables: Record<string, any>;
  Bindings: Bindings;
};

export const { createApp, createHandlers, createMiddleware } =
  createFactory<HEnv>();
