// Project ↔ zustand store bridge: export active state, import bundle.
// Import is async (media elements must be reloaded from bytes/URL).
import type { TimelineClip } from "../../shared/types/clip";
import type { MediaItem } from "../media/media-helper";
import { useEditorStore } from "../../store/editor-store";
import { ensureDedicatedTracks } from "../../store/project-defaults";
import type { ProjectV1 } from "./schema";
import { pauseAudio } from "../audio/audio-engine";
import { serializeProject } from "./serialize";
import { collectExportBlobs, rehydrateClip, rehydrateMedia } from "./rehydrate";
import { packBundle, projectFileName, unpackBundle } from "./bundle";

export function buildProjectFromStore(name?: string): ProjectV1 {
  const s = useEditorStore.getState();
  // Snapshot both routes: active route from live clips, the rest from snapshot.
  const currentRoute = s.route;
  return serializeProject({
    metaName: name ?? s.projectName ?? "Untitled Project",
    output: {
      aspectRatio: s.aspectRatio,
      recordResolution: s.recordResolution,
      recordFps: s.recordFps,
    },
    tracks: s.tracks,
    video: {
      clips: [],
      selectedClipId: currentRoute === "/" ? s.selectedClipId : (s.videoSel ?? null),
    },
    thumb: {
      clips: [],
      selectedClipId: currentRoute === "/image" ? s.selectedClipId : (s.thumbSel ?? null),
    },
    mediaPool: s.mediaPool,
    videoClipsLive: currentRoute === "/" ? s.clips : (s.videoClips ?? []),
    thumbClipsLive: currentRoute === "/image" ? s.clips : (s.thumbClips ?? []),
    lyricsSettings: s.lyricsSettings,
  });
}

/**
 * Export the full bundle. Note: serializeProject uses the inactive-route
 * snapshot (videoClips/thumbClips) — make sure the snapshot is fresh by
 * stashing the inactive route's live clips when the snapshot is still null.
 */
export async function exportProjectBundle(name?: string): Promise<{ blob: Blob; filename: string; remoteKept: string[] }> {
  // Pure read: derive both routes' live clips without writing snapshots back
  // to the store (export must not mutate editor state).
  const fresh = useEditorStore.getState();
  const project = buildProjectFromStore(name);
  const byId = new Map(fresh.mediaPool.map((m) => [m.id, m.url]));
  const audioOf = (syntheticId: string): string | undefined => {
    const clipId = syntheticId.startsWith("__clip:") ? syntheticId.slice("__clip:".length) : syntheticId;
    const all = [...(fresh.route === "/" ? fresh.clips : (fresh.videoClips ?? [])), ...(fresh.route === "/image" ? fresh.clips : (fresh.thumbClips ?? []))];
    const c = all.find((x) => x.id === clipId);
    const u = (c?.settings as Record<string, unknown> | undefined)?.audioUrl;
    return typeof u === "string" ? u : undefined;
  };
  const { blobs, remoteKept } = await collectExportBlobs(project, (id) => byId.get(id), audioOf);
  const blob = await packBundle(project, blobs);
  return { blob, filename: projectFileName(project.meta.name), remoteKept };
}

export interface ImportResult {
  project: ProjectV1;
  mediaLoaded: number;
  mediaFailed: string[];
}

/** Import a bundle: unpack zip → rehydrate media → replace all editor state. */
export async function importProjectBundle(file: File | Blob): Promise<ImportResult> {
  // Pause first: swapping clip lists mid-play races the render loop and the
  // audio/video playback managers.
  {
    const cur = useEditorStore.getState();
    if (cur.playing) cur.setPlaying(false);
    pauseAudio();
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const { project, assets } = unpackBundle(buf);
  const failed: string[] = [];
  const pool: MediaItem[] = [];
  // Clip-owned audio URL (not library): mediaId → fresh blob URL.
  const clipAudio = new Map<string, string>();
  for (const m of project.mediaPool) {
    // Old-bundle compat: synthetic audio used to be pooled —
    // keep it out of the library, redirect to the clip audio map.
    if (m.kind === "audio" && (m.id.startsWith("assets/") || m.id.startsWith("__clip"))) {
      try {
        const blob =
          m.source.type === "asset"
            ? (assets.get(m.source.value) ?? assets.get(m.source.value.replace(/^assets\//, "")))
            : undefined;
        if (blob) clipAudio.set(m.id, URL.createObjectURL(blob));
        else if (m.source.type === "url") clipAudio.set(m.id, m.source.value);
      } catch (e) {
        failed.push(m.name);
        console.warn(`[project] skip media ${m.name}:`, e);
      }
      continue;
    }
    try {
      const { item } = await rehydrateMedia(m, assets);
      pool.push(item);
    } catch (e) {
      failed.push(m.name);
      console.warn(`[project] skip media ${m.name}:`, e);
    }
  }
  const poolById = new Map(pool.map((m) => [m.id, m]));
  // Clip-owned audio (__clip:<id>, new format): blob lives at
  // assets/__clip_<id>.audio — set audioUrl directly without touching the pool.
  for (const route of [project.routes.video, project.routes.thumb]) {
    for (const c of route.clips) {
      if (c.media && c.media.mediaId.startsWith("__clip:") && !poolById.has(c.media.mediaId)) {
        const key = `assets/__clip_${c.media.mediaId.slice("__clip:".length)}.audio`;
        const blob = assets.get(key);
        if (blob) c.settings.audioUrl = URL.createObjectURL(blob);
      }
    }
  }
  const applyClipAudio = (src: ProjectV1["routes"]["video"]["clips"][number], clip: TimelineClip) => {
    const ref = src.media?.mediaId;
    if (ref && clipAudio.has(ref)) clip.settings.audioUrl = clipAudio.get(ref);
    return clip;
  };
  // Lyrics normalization (production model): lines attach to the music
  // clip (new flat `settings.lines`, or legacy nested `settings.lyrics.lines`
  // with a startOffset axis) — flatten to clip-relative. Leftover lyrics
  // TIMELINE clips (layer era) merge into the most-overlapping music clip then
  // are discarded: no lyrics layer, one global layer follows the active music.
  const normalizeMusicLyrics = (clips: TimelineClip[]): TimelineClip[] => {
    const layers = clips.filter((c) => c.type === "lyrics");
    const overlap = (a: TimelineClip, b: TimelineClip) =>
      Math.max(0, Math.min(a.start + a.duration, b.start + b.duration) - Math.max(a.start, b.start));
    // Assign each lyrics layer to exactly one music clip (most overlap) so a
    // layer is never duplicated across tracks, and never silently dropped:
    // layers with no overlap are kept as-is.
    const musics = clips.filter((c) => c.type === "music");
    const assigned = new Map<string, TimelineClip[]>();
    const unassigned: TimelineClip[] = [];
    for (const l of layers) {
      let best: TimelineClip | null = null;
      let bestOv = 0;
      for (const m of musics) {
        const ov = overlap(l, m);
        if (ov > bestOv) {
          bestOv = ov;
          best = m;
        }
      }
      if (best && bestOv > 0) {
        const arr = assigned.get(best.id) ?? [];
        arr.push(l);
        assigned.set(best.id, arr);
      } else {
        unassigned.push(l);
      }
    }
    const out: TimelineClip[] = [];
    for (const m of clips) {
      if (m.type === "lyrics") continue;
      if (m.type !== "music") {
        out.push(m);
        continue;
      }
      const st = m.settings as Record<string, unknown>;
      const flat = st.lines;
      const nested = (st.lyrics as Record<string, unknown> | undefined)?.lines;
      const fromFlat = Array.isArray(flat) && flat.length > 0;
      let lines: unknown[] = fromFlat
        ? [...(flat as unknown[])]
        : Array.isArray(nested) && nested.length > 0
          ? [...(nested as unknown[])]
          : [];
      if (!fromFlat && lines.length > 0) {
        // The old axis included the audio startOffset; the new axis is clip-relative.
        const off = typeof st.startOffset === "number" ? st.startOffset : 0;
        if (off) {
          lines = lines.map((l) => {
            const o = l as Record<string, unknown>;
            const shift = (v: unknown) =>
              typeof v === "number" ? Math.max(0, v - off) : v;
            return { ...o, start: shift(o.start), end: shift(o.end) };
          });
        }
      }
      // Merge only layers assigned to this music clip (axis shifted).
      for (const layer of assigned.get(m.id) ?? []) {
        const llines = (layer.settings as Record<string, unknown>).lines;
        if (Array.isArray(llines)) {
          const shift = layer.start - m.start;
          for (const l of llines as unknown[]) {
            const o = l as Record<string, unknown>;
            const shiftT = (v: unknown) =>
              typeof v === "number" ? Math.max(0, v + shift) : v;
            lines.push({ ...o, start: shiftT(o.start), end: shiftT(o.end) });
          }
        }
      }
      const next = { ...m, settings: { ...st, lines } };
      delete (next.settings as Record<string, unknown>).lyrics;
      out.push(next);
    }
    // Layers with no overlapping music are preserved, not dropped.
    out.push(...unassigned);
    return out;
  };
  const videoClips: TimelineClip[] = normalizeMusicLyrics(
    project.routes.video.clips.map((c) => applyClipAudio(c, rehydrateClip(c, pool))),
  );
  const thumbClips: TimelineClip[] = project.routes.thumb.clips.map((c) =>
    applyClipAudio(c, rehydrateClip(c, pool)),
  );
  // Revoke old blobs that are no longer used (pool + clip-owned audio).
  const st = useEditorStore.getState();
  const oldAudio = new Set<string>();
  for (const c of [...st.clips, ...(st.videoClips ?? []), ...(st.thumbClips ?? [])]) {
    const u = (c.settings as Record<string, unknown>).audioUrl;
    if (typeof u === "string" && u.startsWith("blob:")) oldAudio.add(u);
  }
  const newAudio = new Set<string>();
  for (const c of [...videoClips, ...thumbClips]) {
    const u = (c.settings as Record<string, unknown>).audioUrl;
    if (typeof u === "string" && u.startsWith("blob:")) newAudio.add(u);
  }
  for (const u of oldAudio) {
    if (!newAudio.has(u)) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* noop */
      }
    }
  }
  for (const m of st.mediaPool) {
    if (m.url.startsWith("blob:") && !pool.some((p) => p.url === m.url)) {
      try {
        URL.revokeObjectURL(m.url);
      } catch {
        /* noop */
      }
    }
  }
  const route = st.route;
  const aspectRatio = project.output.aspectRatio === "9:16" ? "9:16" : "16:9";
  // Old bundles predate the dedicated background lane — insert it so bg
  // clips resolve to their lane via the hard lane rule.
  const tracks = ensureDedicatedTracks(
    project.tracks.length > 0 ? project.tracks : st.tracks,
  );
  const recordResolution =
    project.output.recordResolution === "1080p" ||
    project.output.recordResolution === "1440p" ||
    project.output.recordResolution === "720p"
      ? project.output.recordResolution
      : st.recordResolution;
  useEditorStore.setState({
    projectName: typeof project.meta.name === "string" && project.meta.name ? project.meta.name : st.projectName,
    tracks,
    mediaPool: pool,
    videoClips,
    thumbClips,
    videoSel: project.routes.video.selectedClipId,
    thumbSel: project.routes.thumb.selectedClipId,
    clips: route === "/" ? videoClips : thumbClips,
    selectedClipId: route === "/" ? project.routes.video.selectedClipId : project.routes.thumb.selectedClipId,
    selectedTrackId: "track-1",
    currentTime: 0,
    // New project = old undo history no longer applies.
    past: [],
    future: [],
    aspectRatio,
    recordResolution,
    recordFps: Number.isFinite(project.output.recordFps) ? project.output.recordFps : st.recordFps,
    lyricsSettings: { ...st.lyricsSettings, ...(project.lyricsSettings ?? {}) },
  });
  return { project, mediaLoaded: pool.length, mediaFailed: failed };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
