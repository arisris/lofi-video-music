# AGENTS.md

## Stack

- **Runtime**: Bun
- **Bundler**: Vite 8 + Cloudflare Vite plugin (`@cloudflare/vite-plugin`)
- **UI**: React 19 (`src/components/`, `src/app.tsx`) + Tailwind CSS v4
- **State**: Zustand store (`src/store/editor-store.ts` + slices in `src/store/slices/`)
- **Backend**: Cloudflare Worker (`worker/index.ts`) — proxies Pexels/Pixabay API calls
- **Deploy**: Cloudflare Workers via `wrangler deploy`
- **Language**: TypeScript everywhere — the app is `src/**/*.ts(x)`, the Worker is `worker/index.ts`

## Commands

- `bun install` — install deps
- `bun run dev` — start Vite dev server (`vite dev`)
- `bun run build` — production build (`vite build`)
- `bun run preview` — build then `vite preview`
- `bun run deploy` — build then `wrangler deploy`
- `bun run clean` — remove node_modules and reinstall
- `bunx tsc --noEmit` — typecheck the app (`tsconfig.json`)
- `bunx tsc --noEmit -p worker/tsconfig.json` — typecheck the Cloudflare Worker
- `bunx tsc --noEmit -p tsconfig.node.json` — typecheck `vite.config.ts`

  Three separate programs; run all three before calling a change done. (no npm, no lint configured — do not invent them)

## Dev server

**The user runs the dev server. Do not start it.** If a task seems to need one
running, say so and let them start it. Starting one silently takes the port out
from under the session they already have open, and HMR state, open tabs and any
page they were mid-way through all go with it.

This applies to `bun run dev` on 5173.

Before any browser work, check whether a server is already up and use it if so:

    curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/

## Browser checks

Drive the browser with the Playwright MCP tools: the session is visible and
interruptible. This needs the dev server running, which means it needs the user
to have started it.

Always finish MCP browser work in this order:

1. `browser_tabs({ action: "list" })` — count what is open
2. `browser_tabs({ action: "close", index })` — once per tab
3. `browser_close()`

`browser_close()` alone only releases the _current page_; every other tab stays open. Each `browser_navigate` adds one, so a run with several checks leaves several tabs, and the leftovers accumulate until the MCP server runs out of memory.

Closing the last tab tears the browser down, so step 3 only works while a tab still exists. If it errors with `Target.createTarget: Failed to open a new tab`, the browser is already gone — that is the desired end state, not a failure.

## Architecture

**Two routes** defined in `src/app.tsx` via hashchange + regex parser:

- `/` — video editor mode
- `/image` — thumbnail editor mode

State is swapped between routes via the `mode` slice action (`swapRoute`). The Zustand store is the single source of truth.

**Entry point**: `src/app.tsx` — React shell, hash router, runtime binding

**Key directories**:

- `src/store/` — Zustand store, slices, and actions (`src/store/actions/`)
- `src/types/` — shared TypeScript types (clips, media, panels)
- `src/components/` — React components (UI panels, timeline, inspector, clip settings views)
- `src/components/clip-settings/` — settings views per clip type (the `onSettings` React components)
- `src/lib/clips/` — clip type implementations (text, music, background, overlay, shape, etc.)
- `src/lib/vfx/` — visual effects (rain, snow, fireflies, film grain, etc.)
- `src/lib/visualizers/` — legacy Canvas 2D audio visualizers (bars, circle, waveform, etc.), frozen
- `src/lib/gl-viz/` — shader visualizers: one self-describing definition per file in `defs/`, plus the engine that renders them onto the 2D canvas
- `src/lib/` — core engine: render loop (`render.ts`), audio, drag, recorder, `runtime.ts`
- `src/utils/` — helpers, IndexedDB, UI helpers
- `src/data/` — static JSON (emoji, character data)

**Worker** (`worker/index.ts`): Cloudflare Worker with two API endpoints:

- `/api/pexels/search` — proxies Pexels video/photo search
- `/api/pixabay/search` — proxies Pixabay video/image search
- Uses Cloudflare Cache API for caching responses
- Env vars `PEXELS_API_KEY` and `PIXABAY_API_KEY` must be set in Cloudflare

**Rendering**: Canvas-based. `src/lib/render.ts` runs the render loop and reads state directly from the Zustand store. `src/lib/runtime.ts` holds the canvas context, audio graph refs, and other shared runtime references.

## Gotchas

- **State updates must be immutable**: nested in-place mutations (e.g. `clip.settings.x = 5`) do **not** trigger React re-renders. Use the helpers in `src/store/actions/timeline-actions.ts` (`updateTimelineClipSettings`, `bumpClips`) or `src/store/actions/clip-settings.ts` (`updateClipSettings`). `bumpClips()` is the store poke to use after any imperative change that did not go through the store.
- **HMR sync**: `src/store/editor-store.ts` snapshots state into `import.meta.hot.data`, and `src/app.tsx` re-syncs audio state on hot reload.
- **Route prefix**: routing is hash-based with the `#!` prefix, parsed in `src/app.tsx`.
- **Tailwind v4**: Uses `@plugin` directive syntax in `src/tailwind.css` (not the old `plugins` config). Iconify icons via `@iconify/tailwind4` plugin.
- **No env file locally**: `.env` is gitignored. API keys are Cloudflare Worker env vars, not Vite env vars.
- **Video recording**: Uses `MediaRecorder` API. Recording settings (resolution, FPS) live on the store as `recordResolution` / `recordFps`.
- **Clip renderer contract**: `onSettings` in `src/lib/clips/*` and `src/lib/vfx/*` is a React function component `(props: { clip? }) => JSX`; the renderers only reference the view, they never render UI themselves.
- **Uncontrolled inputs**: textarea/content inputs stay uncontrolled (`defaultValue` + `key` per clip id) so the canvas renderer keeps its own text state.
- **Pointer-anchored menus**: `src/components/ui/anchored-menu.ts` measures a menu after it renders and keeps it inside the viewport — it opens upwards when there is no room below the pointer, and slides back from the edges. Any menu that opens at the pointer should use the hook; a plain `top: pointerY` gets cut off near the bottom of the screen.
