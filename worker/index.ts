import { HTTPException } from "hono/http-exception";
import { createApp } from "./lib/factory";
import { pexelsSearchApiHandlers } from "./handlers/pexels-search-api";
import { pixabaySearchApiHandlers } from "./handlers/pixabay-search-api";

const app = createApp();

app.get("/api/pexels/search", ...pexelsSearchApiHandlers);
app.get("/api/pixabay/search", ...pixabaySearchApiHandlers);

app.get("/api/transcribe", (c) => {
  return c.json({ message: "Not yet implemented" });
});

app.notFound((c) => c.body(null, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
