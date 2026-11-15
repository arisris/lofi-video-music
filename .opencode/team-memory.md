## 2026-11-15 — Remove wouter, zustand hash-sync routing

- Convention: routes are zustand `route` ("/" | "/image") in `src/store/editor-store.ts` + mirror helper `src/store/route-hash.ts` (parse/write/navigate/useRouteHashSync, diff-guarded both ways).
- Commands that worked: `bunx tsc --noEmit`, `bunx tsc -p worker/tsconfig.json --noEmit`, `bunx tsc -p tsconfig.node.json --noEmit`, `bun run build`, `bun test src/store/route-hash.test.ts` (9 pass), `bun remove wouter`.
- Gotcha: `window.location.hash = "/image"` relies on browser #-normalization; tests assert raw value. Prefer `HASH_FOR_ROUTE[route]` if touched. `startsWith("/image")` maps `#/images` -> `/image` (prior quirk preserved).
- Gotcha: `swapRoute` has no pushHistory, so back/forward never pollutes undo; undo/redo flips route -> subscription mirrors to hash (adds Back entries, converges).
- Open risk: `useRouteHashSync` hook (mount/hashchange/subscription) has zero automated tests; only parse/write/navigate covered.
