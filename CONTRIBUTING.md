# Contributing

Thanks for stopping by. This is a full client-side static app — Bun,
Vite 8, React + Tailwind. No backend, no database.

## Setup

```bash
bun install
bun run dev
```

Open the printed URL (default `http://localhost:5173/`).

## Commands

- `bun run dev` — start the dev server
- `bun run build` — production build (static `dist/`, host anywhere)
- `bun run preview` — build, then serve it locally
- `bun run deploy` — alias for build
- `bunx tsc --noEmit` — typecheck (run this before finishing)
- `bun fmt` — format the repo
- `bun run validate:project <bundle.lofi.zip>` — validate a project bundle
- `bun run clean` — reinstall from scratch

No npm, no separate linter.

## Layout

- `src/modules/` — feature areas: `editor` (timeline, canvas), `media`
  (uploads, stock search), `lyrics`, `visualizers`, `vfx`, `audio`,
  `recorder`, `project`, `library-panels`, `dock`, `clips`, `bg-transitions`
- `src/shared/` — reusable bits: `lib` (generic helpers), `ui`, `hooks`, `types`
- `src/engine/`, `src/store/` — rendering engine and app state
- `scripts/` — `validate-project.ts`, `check-tailwind.ts`

Stock search (Pexels/Pixabay) calls the provider APIs directly from the
browser with the user's own keys from Settings — see
`src/modules/media/stock/`. Keys live in the user's `localStorage` and must
never be committed or bundled.

## Conventions

- Write in English: code, comments, commits, docs, UI strings.
- Prefer editing an existing file over creating a new one.
- Reusable, provider-agnostic logic belongs in `src/shared/lib/`;
  feature-specific code stays in its module.
- Keep the repo lean: think twice before adding a dependency.
