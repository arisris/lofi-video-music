import type { TimelineClip } from "../../shared/types/clip";
import { useEditorStore } from "../../store/editor-store";
import { resolveVideoLoop } from "./video-loop";

/**
 * Syncs <video> elements to the timeline
 * Looping clips ping-pong two elements with a short crossfade at each loop
 * seam; the draw side (background definition) blends the pair the same way.
 * Video elements are stored in settings[elementsKey] by the media module.
 *
 * Resume tolerance: re-assigning currentTime — even to the current value —
 * flushes the decoder (seeking/seeked fire), flashing stale frames. The
 * paused branch already pins elements within 0.1s, so resume only seeks on
 * genuine drift and otherwise just plays.
 */
const RESUME_SYNC_TOLERANCE = 0.15;
export function manageVideoPlayback(
  clip: TimelineClip,
  globalTime: number,
  elementsKey = "mediaElements",
  alwaysLoop = true,
  activeMargin = 0,
): void {
  const vids = clip.settings[elementsKey];
  if (!Array.isArray(vids) || vids.length === 0) return;
  if (
    vids.some((v) => !v || typeof (v as HTMLVideoElement).pause !== "function")
  )
    return;

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
  const speed =
    typeof clip.settings.speed === "number" ? clip.settings.speed : 1;
  for (const v of elements) {
    if (v.playbackRate !== speed) v.playbackRate = speed;
  }
  const duration =
    typeof clip.settings.videoDuration === "number"
      ? (clip.settings.videoDuration as number)
      : elements[0].duration || 0;
  if (!duration) return;
  const localTime = globalTime - clip.start;
  const shouldLoop = alwaysLoop
    ? true
    : (clip.settings.loop as boolean | undefined) !== false;
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
  const blend = resolveVideoLoop(localTime, speed, duration, vids.length);
  if (!blend) {
    manageNonLoopingPlayback(vids, localTime, duration, speed);
    return;
  }
  const { period, loopIndex, loopTime, inCrossfade } = blend;

  const primaryVid = vids[loopIndex % vids.length];
  const secondaryVid = vids[(loopIndex + 1) % vids.length];
  if (!primaryVid || !secondaryVid) return;

  const primaryTargetTime = loopTime;
  const secondaryTargetTime = inCrossfade ? loopTime + period : 0;
  const isPlaying = useEditorStore.getState().playing;

  if (isPlaying) {
    if (primaryVid.paused) {
      safeSeek(primaryVid, primaryTargetTime, RESUME_SYNC_TOLERANCE);
      void primaryVid.play().catch(() => {});
    } else {
      safeSeek(primaryVid, primaryTargetTime, 0.5);
    }
    if (inCrossfade) {
      if (secondaryVid.paused) {
        safeSeek(secondaryVid, secondaryTargetTime, RESUME_SYNC_TOLERANCE);
        void secondaryVid.play().catch(() => {});
      } else {
        safeSeek(secondaryVid, secondaryTargetTime, 0.5);
      }
    } else if (!secondaryVid.paused) {
      secondaryVid.pause();
      safeSeek(secondaryVid, 0, 0.05);
    }
  } else {
    // Scrubbing/paused: pin precisely, keep both paused. Throttled so a
    // fast drag doesn't abort the decoder on every frame (scrub flicker).
    if (!primaryVid.paused) primaryVid.pause();
    pinSeek(primaryVid, primaryTargetTime, 0.1);
    if (!secondaryVid.paused) secondaryVid.pause();
    if (inCrossfade) {
      pinSeek(secondaryVid, secondaryTargetTime, 0.1);
    } else {
      pinSeek(secondaryVid, 0, 0.05);
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

/** Last pin-seek issue time per element (scrub throttle). */
const lastPinSeek = new WeakMap<HTMLVideoElement, number>();
const PIN_SEEK_MIN_GAP = 80;

/**
 * Paused/scrub pin: converge without aborting the decoder every frame.
 * Skips while a seek is in flight or inside the throttle gap — the next
 * frame carries a newer target anyway, so this only delays, never drops.
 */
function pinSeek(v: HTMLVideoElement, t: number, tolerance: number): void {
  if (v.readyState < 1) return;
  if (v.seeking) return;
  if (Math.abs(v.currentTime - t) <= tolerance) return;
  const now = performance.now();
  if (now - (lastPinSeek.get(v) ?? 0) < PIN_SEEK_MIN_GAP) return;
  try {
    v.currentTime = t;
    lastPinSeek.set(v, now);
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
      safeSeek(primaryVid, targetTime, RESUME_SYNC_TOLERANCE);
      void primaryVid.play().catch(() => {});
    } else {
      safeSeek(primaryVid, targetTime, 0.5);
    }
  } else {
    if (!primaryVid.paused) primaryVid.pause();
    pinSeek(primaryVid, targetTime, 0.1);
  }
}
