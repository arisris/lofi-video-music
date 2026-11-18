# AGENTS.md

Human contributor guide lives in `CONTRIBUTING.md` — stack, commands,
layout, and conventions there apply here too. This file only adds
agent-specific rules.

## Language

Write in English: code, comments, JSDoc, commits, docs, UI strings. Never commit Indonesian text.

## Dev server

The user runs it. Do not start it. Before browser work, check `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.

## Browser checks

Use Playwright MCP tools. Always close all tabs when done: list tabs, close each, then `browser_close()`.

## Verification

Run `bunx tsc --noEmit` before finishing. Verify behavior through execution
(tests, scripts, browser checks) whenever reasonable — do not rely on
already-checked claims.
