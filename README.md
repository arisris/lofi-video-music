# lofi-video-music-generator

A browser-based editor for building lofi music videos: compose a timeline with music, background videos, shapes, text, overlays, visualizers and VFX, then record the result as a video.

## Stack

- **Runtime**: [Bun](https://bun.com)
- **Build**: Vite 8 + Cloudflare Vite plugin
- **UI**: React 19 + Tailwind CSS v4, canvas-based render loop
- **State**: Zustand (single store in `src/store/`, slices per domain)
- **Language**: TypeScript throughout (no JavaScript sources left)
- **Backend**: Cloudflare Worker (`worker/index.ts`) proxying the Pexels and Pixabay APIs

## Development

To install dependencies:

```bash
bun install
```

To run the dev server:

```bash
bun run dev
```

Other scripts:

```bash
bun run build     # production build
bun run preview   # build then serve the production bundle
bun run deploy    # build then wrangler deploy
bunx tsc --noEmit  # typecheck the app
bunx tsc --noEmit -p worker/tsconfig.json  # typecheck the Worker
```

Setup notes are kept in `AGENTS.md`.

This project was created using `bun init` in bun v1.3.11. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.