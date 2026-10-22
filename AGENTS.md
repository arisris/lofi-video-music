# AGENTS.md

## Stack

Bun · Vite 8 (Cloudflare plugin) · React 19 + Tailwind v4 · Zustand · TypeScript.

App code is `src/**/*.ts(x)`; the Worker is `worker/index.ts` (Pexels/Pixabay proxy, deployed with Wrangler).

## Commands

- `bun install` / `bun run dev` / `bun run build` / `bun run preview` / `bun run deploy` / `bun run clean`
- `bunx tsc --noEmit` — app (`tsconfig.json`)
- `bunx tsc --noEmit -p worker/tsconfig.json` — Worker
- `bunx tsc --noEmit -p tsconfig.node.json` — `vite.config.ts`

Run all three typechecks before calling a change done. No npm, no lint — don't invent them.

## Dev server

**The user runs it. Do not start it.** Starting one takes the port from the session they have open and kills their HMR state and open tabs. If a task needs one, say so and let them start it.

Before any browser work, check whether one is already up and use it:

    curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/

## Browser checks

Use the Playwright MCP tools — the session is visible and interruptible. This needs the dev server running, which is the user's job.

Always finish in this order:

1. `browser_tabs({ action: "list" })` — count what is open
2. `browser_tabs({ action: "close", index })` — once per tab
3. `browser_close()`

`browser_close()` alone only releases the _current page_; every other tab stays open, so leftovers accumulate. Closing the last tab tears the browser down — if step 3 then errors with `Target.createTarget: Failed to open a new tab`, the browser is already gone, which is the desired end state.

## Architecture

Entry point: `src/app.tsx` — React shell, hash router, runtime binding.

Routes are hash-based with the `#!` prefix: `/` is the video editor, `/image` the thumbnail editor. Route swap goes through the `mode` slice action (`swapRoute`). The Zustand store is the single source of truth.

- `src/store/` — store, slices, actions (`src/store/actions/`)
- `src/types/` — shared types (clips, media, panels)
- `src/components/` — React panels; `clip-settings/` holds per-clip-type settings views
- `src/lib/` — engine: render loop, audio, drag, recorder, `runtime.ts`
- `src/lib/clips/` — clip types (text, music, background, overlay, shape…)
- `src/lib/vfx/` — visual effects (rain, snow, fireflies, film grain…)
- `src/lib/gl-viz/` — shader visualizers: one definition per file in `defs/`, plus the engine
- `src/utils/`, `src/data/` — helpers, IndexedDB, static JSON

**Worker** (`worker/index.ts`): `/api/pexels/search` and `/api/pixabay/search`, cached via the Cloudflare Cache API. Env vars `PEXELS_API_KEY` and `PIXABAY_API_KEY` are set in Cloudflare.

**Rendering** is canvas-based: `src/lib/render.ts` runs the loop and reads the store directly; `src/lib/runtime.ts` holds the canvas context and audio graph refs.

## Gotchas

- **State updates must be immutable.** Nested in-place mutations (e.g. `clip.settings.x = 5`) do not re-render. Use `updateTimelineClipSettings` / `updateClipSettings` from `src/store/actions/`, and `bumpClips()` after any imperative change that bypassed the store.
- **HMR**: `src/store/editor-store.ts` snapshots state into `import.meta.hot.data`; `src/app.tsx` re-syncs audio on hot reload.
- **Tailwind v4**: `@plugin` directive syntax in `src/tailwind.css`; Iconify icons via `@iconify/tailwind4`.
- **No local env file**: `.env` is gitignored. API keys are Worker env vars, not Vite env vars.
- **Recording**: `MediaRecorder` API; resolution and FPS live on the store as `recordResolution` / `recordFps`.
- **`onSettings`** in `src/lib/clips/*` and `src/lib/vfx/*` is a React component `(props: { clip? }) => JSX`; renderers only reference the view.
- **Textarea/content inputs stay uncontrolled** (`defaultValue` + `key` per clip id) so the canvas renderer keeps its own text state.
- **Pointer-anchored menus**: use `src/components/ui/anchored-menu.ts`; a plain `top: pointerY` gets cut off near the bottom of the screen.
