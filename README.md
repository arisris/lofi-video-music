# lofi-video-music-generator

Make lofi music videos in your browser. Lay music, looping backgrounds, karaoke lyrics, audio-reactive visualizers, and cozy VFX on a timeline — then record the result as a video. A second portrait canvas handles your cover thumbnail.

## What you can make

- Full-length lofi videos: background loop + music + karaoke text + visualizer + rain/snow/grain on top.
- Short loops and livestream-style scenes with beat-reactive glow.
- Square/portrait cover art on the dedicated thumbnail canvas.

## Workflow

1. **Collect media** — upload your own files, or search Pexels and Pixabay from inside the Media tab.
2. **Build the scene** — drop a background, add overlays, shapes, and text; drag directly on the canvas with snap guides.
3. **Add music and lyrics** — put a track on the timeline, paste or sync LRC lyrics, pick a karaoke style.
4. **Bring it alive** — add a visualizer (bars, circle, aura, vinyl, tunnel, and more) plus VFX like rain, snow, fireflies, or film grain.
5. **Record and share** — hit record at 720p, 1080p, or 1440p; export your project as a `.lofi.zip` to back it up or move machines.

## Features

**Timeline** — multi-track, trim and rearrange clips, snap guides, zoom, undo-friendly editing.

**Lyrics** — karaoke display with LRC timing, tap-to-sync editor, per-song styling that follows the playing track.

**Visualizers (10)** — aura, bars, circle, kaleidoscope, liquid waves, lissajous, orb, tunnel, vinyl, waveform. Most react to the music with glow and rainbow options.

**VFX (8)** — rain, GPU rain, snow, smoke, fireflies, lightning flash, film grain / VHS, vignette.

**Media** — image, video, audio, and GIF uploads; Pexels/Pixabay search with type, orientation, and duration filters; animated emoji.

**Thumbnail mode** — one click switches to a portrait canvas for still cover art; your video timeline stays untouched.

**Projects** — export/import a single `.lofi.zip` (project + assets). Validate any bundle with:

```bash
bun run validate:project <bundle.lofi.zip>
```

## Getting started

```bash
bun install
bun run dev
```

Open the printed URL (default `http://localhost:5173/`).

```bash
bun run build     # production build
bun run preview   # build, then serve it locally
bun run deploy    # build, then deploy to Cloudflare
```

## Stock search setup

In-app Pexels/Pixabay search goes through a small Cloudflare Worker proxy with response caching. Set these as Worker env vars (never in a local `.env`):

- `PEXELS_API_KEY`
- `PIXABAY_API_KEY`

Without keys, uploads and emoji still work; only stock search is unavailable.

## Requirements

- [Bun](https://bun.com) v1.4.x
- Modern browser with Canvas, WebGL, and `MediaRecorder`
- Cloudflare account + stock API keys (only for Pexels/Pixabay search)

## Contributing

Setup notes, commands, and architecture conventions live in `AGENTS.md`.
