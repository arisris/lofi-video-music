# Migration Plan: Mithril + JS → React + TypeScript + Zustand

> Branch: `react` | Base: `master` (commit 94c2cf4) | Last updated: 2026-10-18

## 1. Goals

Rewrite the UI layer of lofi-video-music-generator using:

- **React** replacing Mithril.js
- **TypeScript** as the primary language (gradual migration, not big-bang)
- **Zustand** for state management, replacing the mutable global `State` object

Key principles:

1. **Incremental, not big-bang** — every phase ends with an app that still runs normally with `bun run dev`.
2. **Keep the engine** — all canvas/render/audio code (~30 files in `src/lib/`) is not rewritten, only typed and re-integrated with the right patterns (refs + transient updates).
3. **Worker untouched** — `src/worker.js` (Pexels/Pixabay proxy) does not change at all.

---

## 2. Current State Analysis

### 2.1 Code size (total ~8,270 lines)

| Area | Files | Lines | Effort Estimate |
|---|---|---|---|
| Components (Mithril) | 17 | ~4,300 | **High** — manual conversion to JSX + hooks |
| Lib engine (render, audio, drag, clips, vfx, visualizers) | ~30 | ~2,300 | **Low–Medium** — mostly framework-agnostic, typing only |
| `src/main.js` (routing + shell + HMR) | 1 | 278 | **Medium** — full rewrite |
| `src/lib/state.js` | 1 | 155 | **Medium** — split into Zustand store |
| `src/utils/` | 3 | ~470 | Low |
| `src/worker.js` | 1 | 181 | ✅ Untouched |

### 2.2 Riskiest areas

- **`src/lib/state.js`** — a single mutable global object with no explicit reactivity (relies on manual `m.redraw()` calls). Its state must be mapped carefully to Zustand slices so no logic is lost.
- **Routing + route-swap state** — `main.js` has `swapRouteClips()` that swaps `timelineClips/tracks/selected*` between video (`/`) and thumbnail (`/image`) modes. It mutates state silently; a careless port could cause the two modes to overwrite each other.
- **HMR audio sync** — `main.js` restores the audio position after hot-reload; this pattern must be reimplemented on top of Zustand.
- **High-frequency render loop** — `render.js` reads `State` every frame; careless integration (React re-render per frame) would tank performance.

---

## 3. Target Architecture

```
src/
  worker.js                 ✅ UNCHANGED
  main.tsx                  ← React entry (replaces main.js)
  app/
    App.tsx                 ← Root component + hash router
    routes/                 ← Video ("/") & thumbnail ("/image") screens
  store/
    editor-store.ts         ← create store + compose slices + HMR persistence
    slices/
      playback.ts           ← isPlaying, currentTime, playlist + transitions
      timeline.ts           ← timelineTracks, timelineClips, selected*, zoom, clipSettings
      media-pool.ts         ← mediaPool + panel state (emoji/pexels/pixabay)
      recording.ts          ← record mode/resolution/fps, modal
      layout.ts             ← panel width, collapse, activeClipTab
      thumbnail.ts          ← thumbnail layers + selectedLayerId
      interaction.ts        ← drag/transform/snap transient state (added during review)
      mode.ts               ← route snapshots + swapRoute action (added during review)
    selectors.ts            ← memoized selector helpers
  types/
    clips.ts                ← Clip union types + per-type settings
    media.ts
    panels.ts               ← media panel (emoji/pexels/pixabay) UI state types
  components/               ← 1:1 conversion, one .tsx file per panel
  lib/                      ← kept as-is initially; typed to .ts gradually
  utils/                    ← typed to .ts gradually
```

---

## 4. Work Phases

### Phase 0 — Infrastructure

- [x] Install `react`, `react-dom`, `zustand` (react@19.3.1, zustand@5.0.15)
- [x] Dev deps: `typescript@7`, `@vitejs/plugin-react@6`, `@types/react@19`, `@types/react-dom@19`, `@types/node`
- [x] Update `vite.config.ts` — `@vitejs/plugin-react` added (converted from `vite.config.js`)
- [x] Create `tsconfig.json` (+ `tsconfig.node.json`): `allowJs` on during transition, `strict` on for new files
- [x] Verify: `bun run dev` still runs normally (UI still Mithril), `bun run build` passes, `tsc --noEmit` clean

### Phase 1 — `state.js` → Zustand

- [x] Create `types/` — Clip union types (text/music/background/overlay/shape/playlist/visualizer), TimelineTrack, MediaItem
- [x] Build the store with slices per the target architecture (`playback`, `recording`, `timeline`, `interaction`, `media-pool`, `layout`, `mode`, `thumbnail`)
- [x] Move `swapRouteClips` into a store action (`ModeSlice.swapRoute`, video ⇄ thumbnail mode swap)
- [x] Preserve the HMR persistence pattern: `import.meta.hot.data` snapshot in `editor-store.ts`
- [x] Interim: `src/lib/state.js` is a Proxy bridge forwarding every read/write into the store (legacy components untouched)
- [x] `main.js` route handlers now call the store action
- [x] Verified: `tsc --noEmit` clean, build passes, Playwright smoke test (boot w/o console errors, Add Track, /image ⇄ / route swap)

### Phase 2 — React entry, routing, and shell

- [x] Create `main.tsx` (`createRoot`, mounts on `#root`)
- [x] Hash router `#!` — two routes (`/` and `/image`) calling the swap action in the store (`applyRoute` + `hashchange` in `App.tsx`)
- [x] Convert the shell `Editor` → JSX (`App.tsx`): 3-panel layout + audio element + record modal
- [x] Mount `<canvas>`, `<video>`, `<audio>` via React refs; runtime binding retries until Mithril hosts render
- [x] Move global drag listeners & render loop startup into `useEffect` with proper cleanup; rAF loop guarded against HMR double-start
- [x] Re-implement HMR audio re-sync on top of the store
- [x] Remove legacy `main.js`; `index.html` now loads `./src/main.tsx`
- [x] Added `MithrilBridge` (`src/compat/mithril-bridge.tsx`) hosting legacy Mithril panels inside React during the transition
- [x] Verified: `tsc --noEmit` clean, build passes, Playwright smoke test — boot with no console errors, canvas painted by the render loop, runtime refs bound (canvas/ctx/audioEl), mode swap `/` ⇄ `#!/image` works incl. thumbnail default clips

### Phase 3 — Component conversion (small → large, one commit per file)

| # | Component | Lines | Status |
|---|---|---|---|
| 1 | `inspector-panel.js` | 10 | ✅ (with #2) |
| 2 | `resizer.js` | 38 | ✅ (with #1) |
| 3 | `vfx-panel.js` | 52 | ✅ (with #4) |
| 4 | `media-pool.js` | 79 | ✅ (with #3) |
| 5 | `settings-panel.js` | 95 | ✅ |
| 6 | `ui/scrub-input.js` | 80 | ✅ → `ui/scrub-input.tsx` (with #15) |
| 7 | `ui/color-input.js` | 83 | ✅ → `ui/color-input.tsx` (with #15) |
| 8 | `clips-panel.js` | 139 | ✅ |
| 9 | `video-preview.js` | 133 | ✅ |
| 10 | `char-box.js` | 159 | ✅ → `char-box.tsx` (with #15) |
| 11 | `record-settings-modal.js` | 231 | ✅ |
| 12 | `text-panel.js` | 279 | ✅ |
| 13 | `transport-bar.js` | 301 | ✅ |
| 14 | `shape-panel.js` | 451 | ✅ |
| 15 | `shared-clip-settings.js` | 474 | ✅ → `clip-settings/shared.tsx` + per-clip views in `clip-settings/` (all legacy `onSettings` renderers converted; MithrilBridge removed) |
| 16 | `timeline.js` | 879 | ✅ |
| 17 | `media-library-panel.js` | 1117 | ✅ |

Conversion rules:

- `m(Component)` → `<Component />`
- `attrs` → typed props
- `oncreate/onremove` → `useEffect` + cleanup
- Components subscribe only to the slices they need (granular state), never the whole store
- [x] After all components are `.tsx`: remove `mithril` from `package.json` and remove all remaining `m.redraw()` calls — DONE in `e7bc9a8` (dependencies removed; every `m.redraw()` no-op replaced by `bumpClips()` or dropped where the render loop already repaints)

### Phase 4 — Typing `lib/` and `utils/`

- [x] Rename `.js` → `.ts` gradually, leaf-first order: `vfx/` → `visualizers/` → `clips/` → `render.js`, `audio.js`, `drag.js`, `recorder.js` → `utils/` — DONE, one commit per batch:
  | Commit | Scope |
  |---|---|
  | `065e833` | `lib/vfx/*.ts` (10 files) + `lib/webgl-renderer.ts` |
  | `f7ca994` | `lib/visualizers/*.ts` + `lib/runtime.ts` (`RuntimeRefs`: engine refs non-null, UI refs nullable) |
  | `f6fc890` | `lib/clips/*.ts` (11 files: registry, index, renderers, `draw-bg`, upload helpers) |
  | `7dc1f82` | `lib/render.ts` (per-frame `m.redraw()` removed), `lib/video-playback.ts` (`ManageVideoOptions`), `lib/animations.ts` |
  | `268e15d` | `lib/audio.ts` (mithril import dropped, 4× `m.redraw()` → `bumpClips()`, `runtime.source` type fix) |
  | `2d61e5e` | `lib/drag.ts` (`DragPointerEvent`), `lib/recorder.ts` (`runtime.recordedChunks`), `lib/clip-factory.ts`, `lib/templates.ts` |
  | `8f842a3` | `lib/fonts.ts`, `lib/emoji-render.ts`, `lib/media-helper.ts` (`MediaItem`, `MediaComplete`) |
  | `181ee3e` | `utils/helpers.ts` (`BBox`, `HSL`), `utils/indexed-db.ts` (`IconRecord`), `utils/ui-helpers.ts` |
  | `24d3e62` | `lib/state.ts` (Proxy bridge kept, typed as `LegacyStateView`) |

  Conventions: renderer entry points are `(ctx: CanvasRenderingContext2D, w: number, h: number, settings: Record<string, any>, localTime, clip)`; unused params are prefixed with `_`; `Uint8Array<ArrayBuffer>` for the analyser FFT buffer; `runtime.recordedChunks` added for the recorder.
- [x] **First, convert the deferred clip-settings layer** (Mithril-rooted by `src/lib/clips/*` renderers) → DONE:
  - `shared-clip-settings.js` → `clip-settings/shared.tsx` (`SharedTextSettingsView`, `SharedTransformSettingsView`, `SharedAnimationSettingsView`)
  - `ui/scrub-input.tsx`, `ui/color-input.tsx`, `char-box.tsx` (React intersector/​picker equivalents)
  - Per-clip settings views in `src/components/clip-settings/`: `shape`, `music`, `overlay`, `background`, `text`, `title`, `playlist`, `visualizer` + `vfx/*` (8 VFX views) + `vfx-controls`
  - Registry contract change: `onSettings` is now a **React function component** `(props: { clip? }) => JSX`; renderer `.js` files merely reference their view
  - `clips-panel.tsx` renders `onSettings` directly (MithrilBridge deleted); subscribes to the active clip source array so in-place/immutable settings updates re-render
  - `updateTimelineClipSettings(clipId, patch, clipPatch?)` now also patches top-level clip props (`duration`, particle caches like `drops`/`snowballs`) and thumbnail-mode `videoClips`; new `bumpClips()` helper replaces legacy `m.redraw()` after imperative uploads
  - Remaining `m.redraw()` calls in `lib/` (audio, drag, render loop, fonts, clip-factory, recorder) are no-ops now that no Mithril roots exist — they get removed during the `.js` → `.ts`Rename step below
- [x] Properly type `runtime.js` (holds refs to canvas/audio/video) → `lib/runtime.ts` with a `RuntimeRefs` interface; engine refs (`audioCtx`, `analyser`, EQ/gain/panner, `dataArray`) are non-null because the audio engine builds them before the render loop starts, while UI refs (`canvas`, `ctx`, `audioEl`, `mediaRecorder`) stay nullable for React consumers
- [x] Tear down the legacy typed `State`; all state access goes through the typed store → DONE in three commits: `d94ed33` (React components), `e72727a` (engine leaf modules), `b16f64d` (engine core + `src/lib/state.ts` deleted). Along the way the typed store surfaced latent mismatches that are now fixed: `RecordMode` is `'timeline' | 'clip'`, `staticSnapTargetsX/Y` are `CanvasSnapTarget[]`, `transformMode` accepts `null`, and the dead `store.dataArray` field was dropped (FFT buffer lives in `runtime`). Drag/clip mutations are immutable (`updateTimelineClipSettings` / `updateClipSettings`).
- [x] Verify: clean build with no errors (`bunx tsc -noEmit` clean, `bun run build` green, Playwright smoke test on the production preview build: shape clip + canvas drag + Rain VFX slider + 3s playback + thumbnail route, zero console errors)

### Phase 5 — Cleanup & finalization

- [x] `tsconfig.json`: `allowJs`/`checkJs` removed, `strict` applies to every file; `src/worker.js` is excluded explicitly (built by Wrangler, imported by nothing) — done in `8e9a9d5`
- [x] Remove `mithril` from `package.json`, clean node_modules (`bun install`) — done in `e7bc9a8` (`bun remove mithril @types/mithril`)
- [x] Update `README.md` & `AGENTS.md`: new stack (TypeScript, React, Zustand), new directories (`src/store/`, `src/types/`, `src/app/`) — done in `8e183fb`
- [x] Full end-to-end test: video editor, thumbnail editor, playback, record — 13/13 checks pass on the dev server (upload media, add shape/text/VFX clips, playback with audio init, canvas drag, inspector scrub input, record → webm download, route swap both ways, aspect ratio switch), zero console errors. One real bug was found and fixed along the way (`09d6815`): NaN transform values on the thumbnail route.
- [ ] `bun run deploy` (handled manually by the user)

---

## 5. Technical Gotchas (important during implementation)

1. **Render & playback must stay "transient"** — values that change every frame (`currentTime`, drag positions) are read in components via `useStore.getState()` or `store.subscribe()` outside React re-renders. Live-value UI (e.g. `recordingTime`) uses `useStore` with a narrow selector + throttled updates (`requestAnimationFrame`), never per-frame re-renders.
2. **Zustand + HMR** — use the `import.meta.hot.data` pattern (already present in `state.js`) to snapshot the store so hot-reloads do not reset editor state.
3. **Don't mix bug fixes with migration** — bug fixes and component conversions are separate commits so each component diff is a pure migration (easy to review).
4. **External deps are safe** — `fix-webm-duration`, `gifuct-js`, `hono` are unaffected by the migration.
5. **`window.innerWidth`** at `state.js` lines 74–75 moves to `layout.ts` with a `typeof window !== "undefined"` guard — not critical here (no SSR), but keeps things typed consistently.

---

## 6. Milestones

- [x] **M1** — Infrastructure: deps installed, `tsconfig.json` ready, build safe (Phase 0)
- [x] **M2** — Zustand slices complete + video ⇄ thumbnail mode swap working (Phase 1)
- [x] **M3** — `main.tsx` + React shell alive in the browser (Phase 2)
- [x] **M4** — 17 components 100% `.tsx`, `mithril` removed (Phase 3)
- [x] **M5** — `lib/` + `utils/` 100% `.ts`, State bridge removed, `strict` for all files, docs updated (Phases 4–5)

The migration is complete: only the deploy step remains (run by the user).
