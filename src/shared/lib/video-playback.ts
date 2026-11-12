import type { TimelineClip } from "../../shared/types/clip";
import { useEditorStore } from "../../store/editor-store";

/**
 * Syncs <video> elements to the timeline — mirrors src_old/lib/video-playback.ts.
 * Looping clips ping-pong two elements with a short crossfade at each loop
 * seam; the draw side (background definition) blends the pair the same way.
 * Video elements are stored in settings[elementsKey] by the media module.
 */
export function manageVideoPlayback(
  clip: TimelineClip,
  globalTime: number,
  elementsKey = "mediaElements",
  alwaysLoop = true,
  activeMargin = 0,
): void {
  const vids = clip.settings[elementsKey];
  if (!Array.isArray(vids) || vids.length === 0) return;
  if (vids.some((v) => !v || typeof (v as HTMLVideoElement).pause !== "function")) return;

  const elements = vids as HTMLVideoElement[];
  const isActive =
    (clip.settings.enabled as boolean | undefined) !== false &&
    globalTime >= clip.start - activeMargin &&
    globalTime <= clip.start + clip.duration + activeMargin;
  if (!isActive) {
    for (const v of elements) {
      if (!v.paused) v.pause();
      if (v.readyState >= 1 && v.currentTime !== 0) {
        try {
          v.currentTime = 0;
        } catch {
          /* metadata not ready */
        }
      }
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
  const shouldLoop = alwaysLoop ? true : (clip.settings.loop as boolean | undefined) !== false;
  if (shouldLoop) manageLoopingPlayback(elements, localTime, duration, speed);
  else manageNonLoopingPlayback(elements, localTime, duration, speed);
}

/** Looping playback with crossfade between two video elements. */
function manageLoopingPlayback(
  vids: HTMLVideoElement[],
  localTime: number,
  duration: number,
  speed: number,
): void {
  const crossfadeDur = Math.min(1.5, duration / 4);
  const period = duration - crossfadeDur;
  if (period <= 0 || vids.length < 2) {
    manageNonLoopingPlayback(vids, localTime, duration, speed);
    return;
  }
  const virtualTime = Math.max(0, localTime * speed);
  const loopIndex = Math.floor(virtualTime / period);
  const loopTime = virtualTime % period;

  const primaryVid = vids[loopIndex % 2];
  const secondaryVid = vids[(loopIndex + 1) % 2];
  if (!primaryVid || !secondaryVid) return;

  const inCrossfade = loopTime < crossfadeDur && loopIndex > 0;
  const primaryTargetTime = loopTime;
  const secondaryTargetTime = inCrossfade ? loopTime + period : 0;
  const isPlaying = useEditorStore.getState().playing;

  if (isPlaying) {
    if (primaryVid.paused) {
      safeSeek(primaryVid, primaryTargetTime, 0);
      void primaryVid.play().catch(() => {});
    } else {
      safeSeek(primaryVid, primaryTargetTime, 0.5);
    }
    if (inCrossfade) {
      if (secondaryVid.paused) {
        safeSeek(secondaryVid, secondaryTargetTime, 0);
        void secondaryVid.play().catch(() => {});
      } else {
        safeSeek(secondaryVid, secondaryTargetTime, 0.5);
      }
    } else if (!secondaryVid.paused) {
      secondaryVid.pause();
      safeSeek(secondaryVid, 0, 0.05);
    }
  } else {
    // Scrubbing/paused: seek precisely, keep both paused.
    if (!primaryVid.paused) primaryVid.pause();
    safeSeek(primaryVid, primaryTargetTime, 0.1);
    if (!secondaryVid.paused) secondaryVid.pause();
    if (inCrossfade) {
      safeSeek(secondaryVid, secondaryTargetTime, 0.1);
    } else {
      safeSeek(secondaryVid, 0, 0.05);
    }
  }
}

/** Seek that never throws before metadata is available. */
function safeSeek(v: HTMLVideoElement, t: number, tolerance: number): void {
  if (v.readyState < 1) return;
  if (Math.abs(v.currentTime - t) <= tolerance) return;
  try {
    v.currentTime = t;
  } catch {
    /* metadata not ready yet — retried next frame */
  }
}

/** Non-looping playback (single play through). */
function manageNonLoopingPlayback(
  vids: HTMLVideoElement[],
  localTime: number,
  duration: number,
  speed: number,
): void {
  const targetTime = Math.max(0, Math.min(duration - 0.05, localTime * speed));
  const primaryVid = vids[0];
  const secondaryVid = vids[1];
  if (!primaryVid) return;

  if (secondaryVid && !secondaryVid.paused) {
    secondaryVid.pause();
    safeSeek(secondaryVid, 0, 0.05);
  }

  const isPlaying = useEditorStore.getState().playing;
  if (isPlaying && localTime < duration) {
    if (primaryVid.paused) {
      safeSeek(primaryVid, targetTime, 0);
      void primaryVid.play().catch(() => {});
    } else {
      safeSeek(primaryVid, targetTime, 0.5);
    }
  } else {
    if (!primaryVid.paused) primaryVid.pause();
    safeSeek(primaryVid, targetTime, 0.1);
  }
}
