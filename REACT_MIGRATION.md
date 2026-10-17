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
      transport.ts          ← isPlaying, currentTime, isTransitioning
      timeline.ts           ← timelineTracks, timelineClips, selected*, zoom
      media-pool.ts         ← mediaPool + panel state (emoji/pexels/pixabay)
      recording.ts          ← record mode/resolution/fps, modal
      layout.ts             ← panel widths, collapse, activeClipTab
      thumbnail.ts          ← thumbnail layers + selectedLayerId
    selectors.ts            ← memoized selector helpers
  types/
    clips.ts                ← Clip union types + per-type settings
    media.ts
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

- [ ] Create `types/` — Clip union types (text/music/background/overlay/shape/playlist/visualizer), TimelineTrack, MediaItem
- [ ] Build the store with slices per the target architecture
- [ ] Move `swapRouteClips` into a store action (video ⇄ thumbnail mode swap)
- [ ] Preserve the HMR persistence pattern: `import.meta.hot.data` for the store
- [ ] Interim: `state.js` becomes a bridge forwarding to the store so legacy Mithril components keep working
- [ ] Verify feature parity: playback, add/remove clip, drag, record settings

### Phase 2 — React entry, routing, and shell

- [ ] Create `main.tsx` (`createRoot`)
- [ ] Hash router `#!` — two routes (`/` and `/image`) calling the swap action in the store
- [ ] Convert the shell `Editor` → JSX (`App.tsx`): 3-panel layout + audio element + record modal
- [ ] Mount `<canvas>`, `<video>`, `<audio>` via React refs; drop `document.getElementById` init
- [ ] Move global drag listeners & render loop startup into `useEffect` with proper cleanup
- [ ] Re-implement HMR audio re-sync on top of the store
- [ ] Remove legacy `main.js`; verify `bun run dev` and `bun run build`

### Phase 3 — Component conversion (small → large, one commit per file)

| # | Component | Lines | Status |
|---|---|---|---|
| 1 | `inspector-panel.js` | 10 | ☐ |
| 2 | `resizer.js` | 38 | ☐ |
| 3 | `vfx-panel.js` | 52 | ☐ |
| 4 | `media-pool.js` | 79 | ☐ |
| 5 | `settings-panel.js` | 95 | ☐ |
| 6 | `ui/scrub-input.js` | ~50 | ☐ |
| 7 | `ui/color-input.js` | ~50 | ☐ |
| 8 | `clips-panel.js` | 139 | ☐ |
| 9 | `video-preview.js` | 133 | ☐ |
| 10 | `char-box.js` | 159 | ☐ |
| 11 | `record-settings-modal.js` | 231 | ☐ |
| 12 | `text-panel.js` | 279 | ☐ |
| 13 | `transport-bar.js` | 301 | ☐ |
| 14 | `shape-panel.js` | 451 | ☐ |
| 15 | `shared-clip-settings.js` | 474 | ☐ |
| 16 | `timeline.js` | 879 | ☐ |
| 17 | `media-library-panel.js` | 1117 | ☐ |

Conversion rules:

- `m(Component)` → `<Component />`
- `attrs` → typed props
- `oncreate/onremove` → `useEffect` + cleanup
- Components subscribe only to the slices they need (granular state), never the whole store
- [ ] After all components are `.tsx`: remove `mithril` from `package.json` and remove all remaining `m.redraw()` calls

### Phase 4 — Typing `lib/` and `utils/`

- [ ] Rename `.js` → `.ts` gradually, leaf-first order: `vfx/` → `visualizers/` → `clips/` → `render.js`, `audio.js`, `drag.js`, `recorder.js` → `utils/`
- [ ] Properly type `runtime.js` (holds refs to canvas/audio/video)
- [ ] Tear down the legacy typed `State`; all state access goes through the typed store
- [ ] Verify: clean build with no errors

### Phase 5 — Cleanup & finalization

- [ ] `tsconfig.json`: turn off `allowJs`, enable `strict` for all files (or use per-directory overrides)
- [ ] Remove `mithril` from `package.json`, clean node_modules (`bun install`)
- [ ] Update `README.md` & `AGENTS.md`: new stack (TypeScript, React, Zustand), new directories (`src/store/`, `src/types/`, `src/app/`)
- [ ] Full end-to-end test: video editor, thumbnail editor, playback, record, `bun run deploy`

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
- [ ] **M2** — Zustand slices complete + video ⇄ thumbnail mode swap working (Phase 1)
- [ ] **M3** — `main.tsx` + React shell alive in the browser (Phase 2)
- [ ] **M4** — 17 components 100% `.tsx`, `mithril` removed (Phase 3)
- [ ] **M5** — `lib/` + `utils/` 100% `.ts`, `strict` enabled, docs updated (Phases 4–5)
