# lofi-video-music-generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-v1.4-black)](https://bun.com)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-purple)](https://vite.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-teal)](https://tailwindcss.com)

> Make lofi music videos in your browser. Music, looping backgrounds,
> karaoke lyrics, audio-reactive visualizers, and cozy VFX on a timeline —
> then record the result as video. A second portrait canvas handles your
> cover thumbnail.

## Workflow

1. **Collect** — upload your own files, or search Pexels and Pixabay from the Media tab.
2. **Compose** — drop a background, add overlays, shapes, and text; drag on canvas with snap guides.
3. **Musicalize** — put a track on the timeline, paste or sync LRC lyrics, pick a karaoke style.
4. **Animate** — add a visualizer plus VFX like rain, snow, fireflies, or film grain.
5. **Record** — capture at 720p / 1080p / 1440p; back up or move machines with a `.lofi.zip` export.

## Features

| Area          | Highlights                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Timeline      | Multi-track, trim and rearrange clips, snap guides, zoom, undo-friendly editing                      |
| Lyrics        | Karaoke display with LRC timing, tap-to-sync editor, per-song styling that follows the playing track |
| Visualizers   | 10 total: aura, bars, circle, kaleidoscope, liquid waves, lissajous, orb, tunnel, vinyl, waveform   |
| VFX           | Rain (+ GPU rain), snow, smoke, fireflies, lightning flash, film grain / VHS, vignette               |
| Media         | Image, video, audio, and GIF uploads; stock search with type, orientation, and duration filters      |
| Thumbnails    | One click switches to a portrait canvas for still cover art; the video timeline stays untouched       |
| Projects      | Export/import a single `.lofi.zip` (project + assets) — validate any bundle before sharing           |

```bash
bun run validate:project <bundle.lofi.zip>
```

## Getting started

```bash
bun install
bun run dev
```

Open the printed URL (default `http://localhost:5173/`).

| Command           | Does what                                  |
| ----------------- | ------------------------------------------ |
| `bun run build`   | Production build (static `dist/`, host anywhere) |
| `bun run preview` | Build, then serve it locally               |
| `bun run deploy`  | Alias for build — deploy `dist/` to any static host |

## Stock search setup

In-app Pexels/Pixabay search calls the provider APIs directly from the
browser with your own free keys. Open Settings (gear tab, bottom of the left
rail) → Stock API Keys, paste each key, and Test it:

- Pexels: https://www.pexels.com/api/
- Pixabay: https://pixabay.com/api/docs/

Keys stay in `localStorage` (this browser only); typing saves, clearing the
field removes. Repeat searches are cached for the session (survives reload,
cleared on restart); changing a key drops the cache.

## Requirements

- [Bun](https://bun.com) v1.4.x
- Modern browser with Canvas, WebGL, and `MediaRecorder`
- Pexels/Pixabay API keys (free, only for stock search — paste in Settings)

## Contributing

Want to hack on it? See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
