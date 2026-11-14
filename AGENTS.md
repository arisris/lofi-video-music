# AGENTS.md

## Language

Write in English: code, comments, JSDoc, commits, docs, UI strings. Never commit Indonesian text.

## Stack

Bun · Vite 8 · React + Tailwind.

App: `src/**/*.ts(x)`; Worker: `worker/index.ts` (Pexels/Pixabay proxy, Wrangler-deployed).

## Commands

- `bun install` / `bun run dev` / `bun run build` / `bun run preview` / `bun run deploy` / `bun run clean`
- `bunx tsc --noEmit` — app; `-p worker/tsconfig.json` — Worker; `-p tsconfig.node.json` — `vite.config.ts`

Run all three typechecks before finishing. No npm, no lint.

## Dev server

The user runs it. Do not start it. Before browser work, check `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.

## Browser checks

Use Playwright MCP tools. Always close all tabs when done: list tabs, close each, then `browser_close()`.
