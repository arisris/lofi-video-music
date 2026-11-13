# AGENTS.md

## Language

Always write in English: code, comments, JSDoc, commit messages, docs, and user-facing strings. Never commit Indonesian text.

## Stack

Bun · Vite 8 (Cloudflare plugin) · React 19 + Tailwind v4 · Zustand · TypeScript.

App code is `src/**/*.ts(x)`; the Worker is `worker/index.ts` (Pexels/Pixabay proxy, deployed with Wrangler).

## Commands

- `bun install` / `bun run dev` / `bun run build` / `bun run preview` / `bun run deploy` / `bun run clean`
- `bunx tsc --noEmit` — app (`tsconfig.json`)
- `bunx tsc --noEmit -p worker/tsconfig.json` — Worker
- `bunx tsc --noEmit -p tsconfig.node.json` — `vite.config.ts`
- `bun run validate:project <bundle.lofi.zip>` — validate an exported project bundle (schema + assets)

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

## Architecture (rewrite 2026-11; `src_old/` remains on disk as a git-ignored legacy reference, no longer cited from source)

Entry point: `src/app.tsx` — React shell, hash router (wouter `useHashLocation`),
route swap via `swapRoute` (per-route snapshot in the store).

- `src/shared/` — reusable only, must not import `modules/`:
  - `shared/types/clip.ts` — single domain types (`ClipType`, `TimelineClip`, `FieldSchema`, `ClipDefinition`, `DrawContext`)
  - `shared/ui/` — `Card`, `ChoiceGrid`, `FieldLabel`/`SectionTitle`, `FontSelector`, `InspectorRoot`, `RangeInput`, `SliderControl`, `TextInput`, `Button`, `SegmentedTabs`, `SettingRow`/`TogglePill`, `EmptyState`, `Select`, `TimeInput`, `ToggleControl`, `ScrubInput`, `ColorInput`, `SchemaFields` + barrel `index.ts`
  - `shared/hooks/useClipSettings.ts` — the only settings writer for a clip instance (immutable)
  - `shared/lib/` — `animations`, `canvas-space` (+`recordSize`), `canvas-transform`, `draw-bg`, `emoji-render`, `fonts`, `format`, `icon-cache`, `media-urls`, `runtime` (browser refs), `text-templates`, `thumbnail`, `transitions`, `video-playback`, `webgl-renderer`
- `src/modules/clips/_core/` — `registry.ts` (generic `createRegistry`), `factory.ts`
- `src/modules/clips/<type>/definition.{ts,tsx}` — 1 folder per clip (text, title, shape, lyrics, background, overlay, music, playlist, glviz, vfx adapter); adding a clip = 1 folder + 1 line in `src/modules/clips/index.ts`
- `src/modules/project/` — `schema.ts`, `serialize.ts`, `rehydrate.ts`, `bundle.ts`, `store-io.ts` (project export/import)
- `src/modules/vfx/` — `_core/{types,base-particle}` + 1 folder per effect (rain, rain-gpu, snow, smoke, fireflies, flash, film-grain, vignette); `index.ts` registry
- `src/modules/visualizers/` — `_core/{types,registry,engine,shader}` + `defs/` (10 shaders), `index.ts`, `VisualizerSettings.tsx` (field → control adapter)
- `src/modules/{lyrics,audio,media,recorder}/` — pure `lyrics.ts` + `active-track.ts` + `SyncEditor.tsx` (the Lyrics panel uses it); `audio-engine.ts` (WebAudio 3-band EQ); `media-helper.ts` (gifuct) — media panel UI lives in `panels/`; `recorder.ts` (MediaRecorder)
- `src/modules/dock/` — `MediaDock.tsx` (left icon rail w-14 + tab content) + `clip-actions.ts` (add clip/VFX layer)
- `src/modules/panels/` — each dock tab's content: `MediaLibraryPanel` (+ uploads/pexels/pixabay/emoji, shared `StockSearchBar`/`FilterChipRow`/`TimelineAddButtons`/`StockLoadMore`), `TextPanel`, `ShapePanel`, `VfxPanel`, `GlobalSettingsPanel` (project export/import), `LyricsPanel` (music-target picker + `SyncEditor` tabs)
- `src/modules/editor/` — `InspectorPanel` (right inspector: global-lyrics branch + per-type views via `SchemaFields`), `clip-views/` (one inspector view per clip type, incl. `TextSettings.tsx` with the shared Typography/Stroke/Transform/Animation sections), `Timeline` (Tracks header, ruler, track rows, bottom Add Music + zoom), `TransportBar` (playback controls + record dropdown), `VideoPreview` (canvas + recording pill), `Resizer`, `RecordSettingsModal`, `ClipContextMenu`, `canvas-drag`/`timeline-drag` (pointer + scrub interaction)
- `src/store/editor-store.ts` — single zustand store: clips + per-route snapshots (`videoClips`/`thumbClips`), mediaPool, recording
- `src/engine/render-loop.ts` — canvas loop: active clips then global VFX (persistent per-layer particle state)
- `src/data/` — static JSON (emoji, chars)

**Worker** (`worker/index.ts`): `/api/pexels/search` and `/api/pixabay/search`, cached via the Cloudflare Cache API. Env vars `PEXELS_API_KEY` and `PIXABAY_API_KEY` are set in Cloudflare.

**Rendering** is canvas-based: `src/engine/render-loop.ts` reads the store directly; `src/shared/lib/runtime.ts` holds canvas/audio refs (bound by `VideoPreview`).

## Gotchas

- **State updates must be immutable.** Nested in-place mutations (e.g. `clip.settings.x = 5`) do not re-render. Use `useClipSettings().set`, `updateClipSettings`, or `moveClip`/`trimClip` from `src/store/editor-store.ts`. VFX particle stash lives in the per-layer `VfxState` passed to `draw`, never on the clip.
- **Add clip/VFX/visualizer**: 1 `definition` folder + register in `index.ts` + (if needed) a `FieldSchema` schema. The inspector picks it up automatically via `SchemaFields` / `VisualizerSettings`.
- **Tailwind v4**: `@plugin` directive syntax in `src/tailwind.css`; Iconify icons via `@iconify/tailwind4`.
- **No local env file**: `.env` is gitignored. API keys are Worker env vars, not Vite env vars.
- **Recording**: `MediaRecorder` API; resolution and FPS live on the store as `recordResolution` / `recordFps`.
- **`SettingsView`** for a clip is a `(props: { clipId: string }) => JSX` component; renderers only reference the view. The default is `SchemaFields` from `shared/ui`.
- **Textarea/content inputs stay uncontrolled** (`defaultValue` + `key` per clip id) so the canvas renderer keeps its own text state.
- **Pointer-anchored menus**: clamp to the viewport (`Math.min(e.clientX, window.innerWidth - menuWidth)`); a plain `top: pointerY` gets clipped at the bottom of the screen.
