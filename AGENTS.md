# AGENTS.md

## Stack

- **Runtime**: Bun
- **Bundler**: Vite 8 + Cloudflare Vite plugin (`@cloudflare/vite-plugin`)
- **UI**: Mithril.js (virtual DOM, not React/Vue) + Tailwind CSS v4
- **Backend**: Cloudflare Worker (`src/worker.js`) — proxies Pexels/Pixabay API calls
- **Deploy**: Cloudflare Workers via `wrangler deploy`
- **Language**: Pure JS (no TypeScript, no unit tests, no linting)

## Commands

- `bun install` — install deps
- `bun run dev` — start Vite dev server (`vite dev`)
- `bun run build` — production build (`vite build`)
- `bun run preview` — build then `vite preview`
- `bun run deploy` — build then `wrangler deploy`
- `bun run clean` — remove node_modules and reinstall

No test, lint, or typecheck commands exist. Do not invent them.

## Architecture

**Two routes** defined in `src/main.js` via `m.route`:
- `/` — video editor mode
- `/image` — thumbnail editor mode

State is swapped between routes via `swapRouteClips()`. Both share the same `State` object (`src/lib/state.js`).

**Key directories**:
- `src/components/` — Mithril components (UI panels, timeline, inspector)
- `src/lib/clips/` — clip type implementations (text, music, background, overlay, shape, etc.)
- `src/lib/vfx/` — visual effects (rain, snow, fireflies, film grain, etc.)
- `src/lib/visualizers/` — audio visualizers (bars, circle, waveform, etc.)
- `src/lib/` — core engine: render loop, audio, drag, recorder, state
- `src/utils/` — helpers, IndexedDB, UI helpers
- `src/data/` — static JSON (emoji, character data)

**Worker** (`src/worker.js`): Cloudflare Worker with two API endpoints:
- `/api/pexels/search` — proxies Pexels video/photo search
- `/api/pixabay/search` — proxies Pixabay video/image search
- Uses Cloudflare Cache API for caching responses
- Env vars `PEXELS_API_KEY` and `PIXABAY_API_KEY` must be set in Cloudflare

**Rendering**: Canvas-based. `src/lib/render.js` runs the render loop. `src/lib/runtime.js` holds the canvas context and shared runtime references.

## Gotchas

- **Mithril, not React**: Components use `m()` JSX-like calls, not JSX. Views return virtual DOM via `m(tag, attrs, children)`. State triggers redraws via `m.redraw()`.
- **HMR sync**: `src/main.js` has explicit HMR handling to re-sync audio state on hot reload. State is persisted across reloads via `src/lib/state.js`.
- **Route prefix**: Mithril route prefix is `#!` (hash-based routing).
- **Tailwind v4**: Uses `@plugin` directive syntax in `src/tailwind.css` (not the old `plugins` config). Iconify icons via `@iconify/tailwind4` plugin.
- **No env file locally**: `.env` is gitignored. API keys are Cloudflare Worker env vars, not Vite env vars.
- **Video recording**: Uses `MediaRecorder` API. Recording settings (resolution, FPS) are in `State.recordResolution` / `State.recordFps`.
