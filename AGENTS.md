# AGENTS.md

## Stack

- **Runtime**: Bun
- **Bundler**: Vite 8 + Cloudflare Vite plugin (`@cloudflare/vite-plugin`)
- **UI**: React 19 (`src/components/`, `src/app/`) + Tailwind CSS v4
- **State**: Zustand store (`src/store/editor-store.ts` + slices in `src/store/slices/`)
- **Backend**: Cloudflare Worker (`src/worker.js`) — proxies Pexels/Pixabay API calls
- **Deploy**: Cloudflare Workers via `wrangler deploy`
- **Language**: TypeScript (`src/**/*.ts(x)`), except `src/worker.js` which stays JS

## Commands

- `bun install` — install deps
- `bun run dev` — start Vite dev server (`vite dev`)
- `bun run build` — production build (`vite build`)
- `bun run preview` — build then `vite preview`
- `bun run deploy` — build then `wrangler deploy`
- `bun run clean` — remove node_modules and reinstall
- `bunx tsc -noEmit` — typecheck (no npm, no lint/tests configured — do not invent them)

## Architecture

**Two routes** defined in `src/app/App.tsx` via hashchange + regex parser:
- `/` — video editor mode
- `/image` — thumbnail editor mode

State is swapped between routes via the `mode` slice action (`swapRoute`). The Zustand store is the single source of truth.

**Key directories**:
- `src/app/` — React shell, hash router, runtime binding
- `src/store/` — Zustand store, slices, and actions (`src/store/actions/`)
- `src/types/` — shared TypeScript types (clips, media, panels)
- `src/components/` — React components (UI panels, timeline, inspector, clip settings views)
- `src/components/clip-settings/` — settings views per clip type (the `onSettings` React components)
- `src/lib/clips/` — clip type implementations (text, music, background, overlay, shape, etc.)
- `src/lib/vfx/` — visual effects (rain, snow, fireflies, film grain, etc.)
- `src/lib/visualizers/` — audio visualizers (bars, circle, waveform, etc.)
- `src/lib/` — core engine: render loop (`render.ts`), audio, drag, recorder, `runtime.ts`
- `src/utils/` — helpers, IndexedDB, UI helpers
- `src/data/` — static JSON (emoji, character data)

**Worker** (`src/worker.js`): Cloudflare Worker with two API endpoints:
- `/api/pexels/search` — proxies Pexels video/photo search
- `/api/pixabay/search` — proxies Pixabay video/image search
- Uses Cloudflare Cache API for caching responses
- Env vars `PEXELS_API_KEY` and `PIXABAY_API_KEY` must be set in Cloudflare

**Rendering**: Canvas-based. `src/lib/render.ts` runs the render loop and reads state through the `src/lib/state.ts` bridge. `src/lib/runtime.ts` holds the canvas context, audio graph refs, and other shared runtime references.

## Gotchas

- **State updates must be immutable**: nested in-place mutations (e.g. `clip.settings.x = 5`) do **not** trigger React re-renders. Use the helpers in `src/store/actions/timeline-actions.ts` (`updateTimelineClipSettings`, `bumpClips`) or `src/store/actions/clip-settings.ts` (`updateClipSettings`). `bumpClips()` is the store poke that replaces the old `m.redraw()` calls.
- **HMR sync**: `src/store/editor-store.ts` snapshots state into `import.meta.hot.data`, and `App.tsx` re-syncs audio state on hot reload.
- **Route prefix**: routing is hash-based with the `#!` prefix, parsed in `App.tsx`.
- **Tailwind v4**: Uses `@plugin` directive syntax in `src/tailwind.css` (not the old `plugins` config). Iconify icons via `@iconify/tailwind4` plugin.
- **No env file locally**: `.env` is gitignored. API keys are Cloudflare Worker env vars, not Vite env vars.
- **Video recording**: Uses `MediaRecorder` API. Recording settings (resolution, FPS) are in `State.recordResolution` / `State.recordFps`.
- **Clip renderer contract**: `onSettings` in `src/lib/clips/*` and `src/lib/vfx/*` is a React function component `(props: { clip? }) => JSX`; the renderers only reference the view, they never render UI themselves.
- **Uncontrolled legacy inputs**: textarea/content inputs stay uncontrolled (`defaultValue` + `key` per clip id) so the canvas renderer keeps its own text state.