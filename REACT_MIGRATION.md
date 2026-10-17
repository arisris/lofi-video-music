# Rencana Migrasi: Mithril + JS → React + TypeScript + Zustand

> Branch: `react` | Basis: `master` (commit 94c2cf4) | Terakhir diperbarui: 2026-10-18

## 1. Tujuan

Menulis ulang UI aplikasi lofi-video-music-generator dengan:

- **React** sebagai pengganti Mithril.js
- **TypeScript** sebagai bahasa utama (migrasi bertahap, bukan big-bang)
- **Zustand** sebagai state management, menggantikan objek `State` global yang mutable

Prinsip penting:

1. **Incremental, bukan big-bang** — setiap fase diakhiri dengan aplikasi yang tetap bisa `bun run dev` dan berjalan normal.
2. **Engine dipertahankan** — seluruh kode canvas/render/audio (~30 file di `src/lib/`) tidak ditulis ulang, hanya di-type dan diintegrasikan ulang dengan pattern yang tepat (refs + transient updates).
3. **Worker tidak tersentuh** — `src/worker.js` (proxy Pexels/Pixabay) tidak berubah sama sekali.

---

## 2. Analisis Kondisi Saat Ini

### 2.1 Ukuran kode (total ±8.270 baris)

| Area | Jumlah File | Baris | Perkiraan Upaya |
|---|---|---|---|
| Components (Mithril) | 17 file | ~4.300 | **Tinggi** — konversi manual ke JSX + hooks |
| Lib engine (render, audio, drag, clips, vfx, visualizers) | ~30 file | ~2.300 | **Rendah–Sedang** — kebanyakan framework-agnostic, tinggal typing |
| `src/main.js` (routing + shell + HMR) | 1 file | 278 | **Sedang** — ditulis ulang |
| `src/lib/state.js` | 1 file | 155 | **Sedang** — dipecah jadi store Zustand |
| `src/utils/` | 3 file | ~470 | Rendah |
| `src/worker.js` | 1 file | 181 | ✅ Tidak disentuh |

### 2.2 Bagian yang paling berisiko

- **`src/lib/state.js`** — satu objek global mutable tanpa reactivity eksplisit (mengandalkan `m.redraw()` manual). Pecahan state-nya harus dipetakan teliti ke slices Zustand supaya tidak ada logic yang hilang.
- **Routing + swap state** — `main.js` punya `swapRouteClips()` yang menukar `timelineClips/tracks/selected*` antara mode video (`/`) dan thumbnail (`/image`). Melewati mutasi objek diam-diam; kalau diport dengan tergesah, state dua mode bisa saling tertukar.
- **HMR sync audio** — `main.js` merestore posisi audio setelah hot-reload; pola ini harus diimplementasikan ulang di atas Zustand.
- **Render loop berfrekuensi tinggi** — `render.js` membaca `State` tiap frame; kalau salah integrasi (re-render React per frame), performa bakal anjlok.

---

## 3. Arsitektur Target

```
src/
  worker.js                 ✅ TIDAK DIUBAH
  main.tsx                  ← React entry (menggantikan main.js)
  app/
    App.tsx                 ← Root component + hash router
    routes/                 ← Screen video ("/") & thumbnail ("/image")
  store/
    editor-store.ts         ← create store + compose slices + HMR persist
    slices/
      transport.ts          ← isPlaying, currentTime, isTransitioning
      timeline.ts           ← timelineTracks, timelineClips, selected*, zoom
      media-pool.ts         ← mediaPool + panel state (emoji/pexels/pixabay)
      recording.ts          ← record mode/resolution/fps, modal
      layout.ts             ← panel widths, collapse, activeClipTab
      thumbnail.ts          ← thumbnail layers + selectedLayerId
    selectors.ts            ← selector memo util
  types/
    clips.ts                ← union tipe Clip + settings per type
    media.ts
  components/               ← hasil konversi 1:1, file .tsx per panel
  lib/                      ← dibiarkan dulu; di-type bertahap ke .ts
  utils/                    ← di-type bertahap ke .ts
```

---

## 4. Fase Kerja

### Fase 0 — Infrastruktur

- [ ] Instal `react`, `react-dom`, `zustand`
- [ ] DevDep: `typescript`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`
- [ ] Perbarui `vite.config` — tambahkan `@vitejs/plugin-react`
- [ ] Buat `tsconfig.json` (+ `tsconfig.node.json`): `allowJs` aktif selama transisi, `strict` aktif untuk file baru
- [ ] Verifikasi: `bun run dev` masih jalan normal (UI masih Mithril)

### Fase 1 — Dari `state.js` ke Zustand

- [ ] Buat `types/` — union tipe Clip (text/music/background/overlay/shape/playlist/visualizer), TimelineTrack, MediaItem
- [ ] Buat store dengan slice-slice sesuai arsitektur di atas
- [ ] Pindahkan `swapRouteClips` jadi action di store (video ⇄ thumbnail mode swap)
- [ ] Pertahankan pola persist HMR: `import.meta.hot.data` untuk store
- [ ] Sementara: `state.js` jadi bridge yang forward ke store agar komponen Mithril lama masih jalan
- [ ] Verifikasi paritas fitur: playback, add/remove clip, drag, record settings

### Fase 2 — Entry, routing, dan shell React

- [ ] Buat `main.tsx` (`createRoot`)
- [ ] Hash router `#!` — dua route (`/` dan `/image`) yang memanggil action swap di store
- [ ] Konversi shell `Editor` → JSX (`App.tsx`): layout 3 panel + audio element + record modal
- [ ] Pasang `<canvas>`, `<video>`, `<audio>` via React refs; drop `document.getElementById` di init
- [ ] Pindahkan listener drag global & render loop startup ke `useEffect` dengan cleanup benar
- [ ] Re-implement HMR audio re-sync di atas store
- [ ] Hapus `main.js` lama; verifikasi `bun run dev` dan `bun run build`

### Fase 3 — Konversi komponen (kecil → besar, satu commit per file)

| # | Komponen | Baris | Status |
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

Aturan konversi:

- `m(Component)` → `<Component />`
- `attrs` → props typed
- `oncreate/onremove` → `useEffect` + cleanup
- Komponen subscribe ke slice yang dibutuhkan saja (state granular), bukan seluruh store
- [ ] Setelah semua komponen `.tsx`: hapus `mithril` dari `package.json` dan seluruh `m.redraw()` tersisa

### Fase 4 — Typing `lib/` dan `utils/`

- [ ] Rename `.js` → `.ts` bertahap, urutan dari leaf ke root: `vfx/` → `visualizers/` → `clips/` → `render.js`, `audio.js`, `drag.js`, `recorder.js` → `utils/`
- [ ] Type `runtime.js` dengan benar (berisi refs ke canvas/audio/video)
- [ ] Typing `State` legacy dibongkar; semua akses state lewat store yang sudah typed
- [ ] Verifikasi: build tanpa error

### Fase 5 — Cleanup & finalisasi

- [ ] `tsconfig.json`: matikan `allowJs`, aktifkan `strict` untuk seluruh file (atau pakai per-directory override)
- [ ] Hapus `mithril` dari `package.json`, bersihkan node_modules (`bun install`)
- [ ] Perbarui `README.md` & `AGENTS.md`: stack baru (TypeScript, React, Zustand), direktori baru (`src/store/`, `src/types/`, `src/app/`)
- [ ] Uji penuh end-to-end: layout editor, thumbnail editor, playback, record, `bun run deploy`

---

## 5. Gotcha Teknis (catatan penting saat implementasi)

1. **Render & playback harus "transient"** — nilai yang berubah tiap frame (`currentTime`, posisi drag) dibaca komponen via `useStore.getState()` atau `store.subscribe()` di luar re-render React. UI khusus yang butuh label live (mis. `recordingTime`) pakai `useStore` dengan selector sempit + update throttled (`requestAnimationFrame`), bukan per-frame re-render.
2. **Zustand + HMR** — gunakan pola `import.meta.hot.data` (sudah ada di `state.js`) untuk menyimpan snapshot store agar hot reload tidak mereset state editor.
3. **Jangan perbaiki bug di `lib/` sambil memigrasi** — perbaikan bug dan konversi komponen dikerjakan di commit terpisah agar diff per komponen murni migrasi (gampang direview).
4. **Dep eksternal tetap aman** — `fix-webm-duration`, `gifuct-js`, `hono` tidak terpengaruh migrasi.
5. **`window.innerWidth`** di `state.js` baris 74–75 akan dipindah ke `layout.ts` dengan guard `typeof window !== "undefined"` — masalahnya hanya untuk kompatibilitas SSR (tidak krusial di sini, tapi tetap tiped konsisten).

---

## 6. Milestone

- [ ] **M1** — Infrastruktur: deps terpasang, `tsconfig.json` siap, build aman (Fase 0)
- [ ] **M2** — Zustand slices lengkap + mode swap video ⇄ thumbnail berjalan (Fase 1)
- [ ] **M3** — `main.tsx` + React shell hidup di browser (Fase 2)
- [ ] **M4** — 17 komponen 100% `.tsx`, `mithril` dihapus (Fase 3)
- [ ] **M5** — `lib/` + `utils/` 100% `.ts`, `strict` aktif, docs diperbarui (Fase 4–5)
