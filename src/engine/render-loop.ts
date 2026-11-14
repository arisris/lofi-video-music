// Render loop: time-based clips, then global VFX on top.
// Persistent per-layer VFX state so particles don't reset every frame.
// renderProjectFrame is pure (no store) so projects can render
// standalone/headless; renderFrame is just the editor wrapper reading the store.
import { getDesignSize } from "../shared/lib/canvas-space";
import type { TimelineClip } from "../shared/types/clip";
import { withClipTransform } from "../shared/lib/canvas-transform";
import { manageVideoPlayback } from "../shared/lib/video-playback";
import { clipRegistry } from "../modules/clips";
import { titleSettingsForFrame } from "../modules/clips/title/definition";
import { lyricsClip } from "../modules/clips/lyrics/definition";
import { drawCanvasOverlays } from "../modules/editor/canvas-drag";
import { activeMusicLyrics } from "../modules/lyrics/active-track";
import { useEditorStore } from "../store/editor-store";

export interface RenderProjectOptions {
  /** Draw snap guides + selection box (default true in the editor). */
  overlays?: boolean;
  /** Explicit design space (headless). Defaults to the active store. */
  width?: number;
  height?: number;
  /** Editor route ("="/"video", "/image"=thumb). Global lyrics are skipped on thumb. */
  route?: string;
  /** Global lyrics style (defaults to the editor store). */
  lyricsSettings?: Record<string, unknown>;
}

/** Pure render from a clip list — never touches the store (headless-safe). */
export function renderProjectFrame(
  ctx: CanvasRenderingContext2D,
  clips: TimelineClip[],
  time: number,
  opts: RenderProjectOptions = {},
) {
  const w = opts.width ?? getDesignSize().w;
  const h = opts.height ?? getDesignSize().h;
  // Scale design space to the backing store (grows while recording) so the
  // recording matches the preview instead of shrinking every clip.
  const backingW = ctx.canvas?.width || w;
  const backingH = ctx.canvas?.height || h;
  const sx = backingW / w;
  const sy = backingH / h;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  const active = clips.filter(
    (c) =>
      (c.settings.enabled as boolean | undefined) !== false &&
      time >= c.start &&
      time < c.start + c.duration,
  );

  // Bottom layer: backgrounds first, sorted by ascending start so clips
  // added later paint over during crossfades.
  // Top layer: other occluders follow ARRAY ORDER (insertion order),
  // not start — so the most recently stacked clip is always on top
  // even when its start is earlier. Audio-only music is skipped.

  const allBgClips = clips.filter(
    (c) =>
      c.type === "background" &&
      (c.settings.enabled as boolean | undefined) !== false,
  );
  // Overlap window ±0.5s so adjacent clips crossfade instead of hard-cutting
  const isBgActive = (c: TimelineClip) =>
    time >= c.start - 0.5 && time <= c.start + c.duration + 0.5;
  const bgClips = allBgClips
    .filter(isBgActive)
    .sort((a, b) => a.start - b.start);
  const fgClips = active.filter(
    (c) => c.type !== "background" && c.type !== "music",
  );

  // Idle backdrop: neutral solid (no hue) so clip colors read
  // as-is. Base #111 is already filled above; no gradient.
  const hasBgMedia = bgClips.some((c) => {
    const s = c.settings as Record<string, unknown>;
    return (
      (s.mediaType === "image" && s.mediaElement) ||
      (s.mediaType === "video" && Array.isArray(s.mediaElements)) ||
      (s.mediaType === "gif" && Array.isArray(s.gifFrames))
    );
  });

  for (const clip of bgClips) {
    const def = clipRegistry.get(clip.type);
    if (!def) continue;
    const localTime = time - clip.start;
    // 1s crossfade when the previous clip ends exactly where this one starts;
    // the newer clip paints on top (sorted by start ascending).
    let fade = 1;
    if (localTime >= -0.5 && localTime < 0.5) {
      const prev = allBgClips.find(
        (c) =>
          c.id !== clip.id &&
          Math.abs(c.start + c.duration - clip.start) < 0.2,
      );
      if (prev) fade = Math.max(0, Math.min(1, (localTime + 0.5) / 1.0));
    }
    const baseOpacity =
      typeof clip.settings.opacity === "number" ? clip.settings.opacity : 1;
    // Full-canvas bbox so the x/y/scale/rotation transform applies around the
    // frame centre (same convention as withClipTransform on the background
    // pass). Animation stays inside def.draw; withClipTransform is
    // transform-only. The def keeps no getItemBoundingBox on purpose so the
    // clip never hijacks canvas hit-testing.
    const bgBbox = { x: 0, y: 0, width: w, height: h };
    const bgSettings: Record<string, unknown> = { ...clip.settings, opacity: baseOpacity * fade };
    withClipTransform(ctx, bgSettings, bgBbox, () =>
      def.draw({
        ctx,
        w,
        h,
        // Shallow copy — never mutate the store.
        settings: bgSettings,
        localTime,
        duration: clip.duration,
        clipId: clip.id,
      }),
    );
    if (Array.isArray(clip.settings.mediaElements)) {
      manageVideoPlayback(
        clip,
        time,
        "mediaElements",
        (clip.settings.loop as boolean | undefined) !== false,
        0.5,
      );
    }
  }

  // Dim media backgrounds so upper layers stay readable
  if (hasBgMedia) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, w, h);
  }

  for (const clip of fgClips) {
    const def = clipRegistry.get(clip.type);
    if (!def) continue;
    const localTime = time - clip.start;
    // Title with autoTrackName resolves against the clip list (pure, no store).
    // Unresolved (no active track / empty text) draws nothing.
    let settings = clip.settings;
    if (clip.type === "title") {
      const resolved = titleSettingsForFrame(clip.settings, clips, time);
      if (!resolved) continue;
      settings = resolved;
    }
    const drawOne = () =>
      def.draw({
        ctx,
        w,
        h,
        settings,
        localTime,
        duration: clip.duration,
        clipId: clip.id,
      });
    // Apply canvas position/rotation/scale around the clip bbox
    // (mirrors the old drawWithTransform; animation stays inside def.draw).
    const bbox = def.getItemBoundingBox
      ? def.getItemBoundingBox(ctx, w, h, settings, localTime)
      : null;
    if (bbox) withClipTransform(ctx, settings, bbox, drawOne);
    else {
      // A def may leak globalAlpha/composite/transform — contain it so the
      // next clip is not contaminated (only the transform is reset below).
      ctx.save();
      try {
        drawOne();
      } finally {
        ctx.restore();
      }
    }
    if (Array.isArray(clip.settings.mediaElements)) {
      manageVideoPlayback(
        clip,
        time,
        "mediaElements",
        (clip.settings.loop as boolean | undefined) !== false,
      );
    }
  }

  // Global lyrics (production model: Qr): lines belong to the music clip
  // currently playing, drawn with the global lyricsSettings style. The global
  // transform applies around the layout bbox (mirrors old drawWithTransform).
  {
    const gs = opts.lyricsSettings ?? useEditorStore.getState().lyricsSettings ?? {};
    if ((gs.enabled as boolean | undefined) !== false) {
      const track = activeMusicLyrics(clips, time, opts.route ?? "/");
      if (track) {
        const merged: Record<string, unknown> = {
          ...(lyricsClip.defaultSettings ?? {}),
          ...gs,
          lines: track.lines,
        };
        const bbox = lyricsClip.getItemBoundingBox?.(ctx, w, h, merged, track.localTime);
        const drawOne = () =>
          lyricsClip.draw({
            ctx,
            w,
            h,
            settings: merged,
            localTime: track.localTime,
            duration: track.music.duration,
            clipId: track.music.id,
          });
        if (bbox) withClipTransform(ctx, merged, bbox, drawOne);
        else {
          ctx.save();
          try {
            drawOne();
          } finally {
            ctx.restore();
          }
        }
      }
    }
  }

  // Snap guides + selection transform box (editor only, not headless).
  if (opts.overlays !== false) drawCanvasOverlays(ctx, w, h);
  // Reset the context to identity so painters outside this frame
  // don't inherit the backing-store scale.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Editor wrapper: read clips from the store then render with overlays. */
export function renderFrame(ctx: CanvasRenderingContext2D, time: number) {
  const { clips, route } = useEditorStore.getState();
  renderProjectFrame(ctx, clips, time, { overlays: true, route });
}
