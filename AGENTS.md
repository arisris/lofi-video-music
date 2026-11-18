# AGENTS.md

## Language

Write in English: code, comments, JSDoc, commits, docs, UI strings. Never commit Indonesian text.

## Stack

Bun · Vite 8 · React + Tailwind — full client-side static app (no backend).

App: `src/**/*.ts(x)`; stock search (Pexels/Pixabay) calls provider APIs
directly from the browser with user keys from Settings (`src/modules/media/stock/`).

## Commands

- `bun install` / `bun run dev` / `bun run build` / `bun run preview` / `bun run deploy` / `bun run clean`
- `bunx tsc --noEmit` — app + `vite.config.ts`

Run the typecheck before finishing. No npm, no lint.

## Dev server

The user runs it. Do not start it. Before browser work, check `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.

## Browser checks

Use Playwright MCP tools. Always close all tabs when done: list tabs, close each, then `browser_close()`.
