import type { TimelineClip } from "../../shared/types/clip";

/**
 * Syncs <video> elements to the timeline — adapted from
 * src_old/lib/video-playback.ts (loop + 2-element crossfade).
 * Video elements are stored in settings[elementsKey] by the media module.
 */
export function manageVideoPlayback(
  clip: TimelineClip,
  globalTime: number,
  elementsKey = "mediaElements",
  alwaysLoop = true,
): void {
  const vids = clip.settings[elementsKey];
  if (!Array.isArray(vids) || vids.length === 0) return;
  if (vids.some((v) => !v || typeof (v as HTMLVideoElement).pause !== "function")) return;

  const elements = vids as HTMLVideoElement[];
  const isActive = globalTime >= clip.start && globalTime <= clip.start + clip.duration;
  if (!isActive) {
    for (const v of elements) {
      if (!v.paused) v.pause();
      v.currentTime = 0;
    }
    return;
  }
  const speed = typeof clip.settings.speed === "number" ? clip.settings.speed : 1;
  for (const v of elements) {
    if (v.playbackRate !== speed) v.playbackRate = speed;
  }
  const duration = typeof clip.settings.videoDuration === "number"
    ? clip.settings.videoDuration as number
    : elements[0].duration || 0;
  if (!duration) return;
  const localTime = globalTime - clip.start;
  if (alwaysLoop) {
    const crossfade = Math.min(1.5, duration / 4);
    const period = Math.max(0.1, duration - crossfade);
    const virtual = Math.max(0, localTime * speed);
    const loopTime = virtual % period;
    const target = loopTime;
    const primary = elements[0];
    if (primary.paused) {
      primary.currentTime = target;
      void primary.play().catch(() => {});
    } else if (Math.abs(primary.currentTime - target) > 0.5) {
      primary.currentTime = target;
    }
  } else {
    const target = Math.max(0, Math.min(duration - 0.05, localTime * speed));
    const primary = elements[0];
    if (primary.paused) {
      primary.currentTime = target;
      void primary.play().catch(() => {});
    } else if (Math.abs(primary.currentTime - target) > 0.5) {
      primary.currentTime = target;
    }
  }
}
