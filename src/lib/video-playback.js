import { State } from "./state";

/**
 * Manages video playback for looping clips with crossfade.
 * Extracted from render.js to eliminate ~150 lines of duplicated code
 * between background-clip and overlay-clip video management.
 *
 * @param {Object} clip - The timeline clip object
 * @param {number} globalTime - Current global timeline time
 * @param {Object} options - Configuration options
 * @param {string} options.elementsKey - Key for video elements array ('bgElements' or 'mediaElements')
 * @param {string} options.typeKey - Key for media type ('bgType' or 'mediaType')
 * @param {string} options.typeValue - Expected type value ('video')
 * @param {boolean} [options.alwaysLoop=true] - Whether to force looping behavior
 * @param {number} [options.activeMargin=0] - Extra margin (seconds) before/after clip for activation
 */
export const manageVideoPlayback = (clip, globalTime, options) => {
  const {
    elementsKey,
    typeKey,
    typeValue = "video",
    alwaysLoop = true,
    activeMargin = 0
  } = options;

  const vids = clip.settings[elementsKey];
  if (clip.settings[typeKey] !== typeValue || !vids || !Array.isArray(vids) || vids.length === 0 || vids.some(v => !v || typeof v.pause !== "function")) return;

  const isActive = (clip.settings.enabled !== false) &&
    (globalTime >= clip.start - activeMargin && globalTime <= clip.start + clip.duration + activeMargin);

  if (!isActive) {
    vids.forEach(v => {
      if (v && typeof v.pause === "function" && !v.paused) {
        v.pause();
        v.currentTime = 0;
      }
    });
    return;
  }

  const vid1 = vids[0];
  const speed = clip.settings.speed || 1.0;

  // Enforce video playback rate
  vids.forEach(v => {
    if (v.playbackRate !== speed) v.playbackRate = speed;
  });

  const shouldLoop = alwaysLoop ? true : (clip.settings.loop !== false);
  const duration = clip.settings.videoDuration || vid1.duration;
  const localTime = globalTime - clip.start;

  if (!duration) return;

  if (shouldLoop) {
    manageLoopingPlayback(vids, localTime, duration, speed);
  } else {
    manageNonLoopingPlayback(vids, localTime, duration, speed);
  }
};

/**
 * Handles looping playback with crossfade between two video elements.
 */
const manageLoopingPlayback = (vids, localTime, duration, speed) => {
  const crossfadeDur = Math.min(1.5, duration / 4);
  const period = duration - crossfadeDur;
  const virtualTime = Math.max(0, localTime * speed);

  const loopIndex = Math.floor(virtualTime / period);
  const loopTime = virtualTime % period;

  const primaryIdx = loopIndex % 2;
  const secondaryIdx = (primaryIdx + 1) % 2;

  const primaryVid = vids[primaryIdx];
  const secondaryVid = vids[secondaryIdx];

  const inCrossfade = loopTime < crossfadeDur && loopIndex > 0;

  const primaryTargetTime = loopTime;
  const secondaryTargetTime = inCrossfade ? (loopTime + period) : 0;

  if (State.isPlaying) {
    // Manage primary video
    if (primaryVid.paused) {
      primaryVid.currentTime = primaryTargetTime;
      primaryVid.play().catch(() => {});
    } else if (Math.abs(primaryVid.currentTime - primaryTargetTime) > 0.5) {
      primaryVid.currentTime = primaryTargetTime;
    }

    // Manage secondary video
    if (inCrossfade) {
      if (secondaryVid.paused) {
        secondaryVid.currentTime = secondaryTargetTime;
        secondaryVid.play().catch(() => {});
      } else if (Math.abs(secondaryVid.currentTime - secondaryTargetTime) > 0.5) {
        secondaryVid.currentTime = secondaryTargetTime;
      }
    } else {
      if (!secondaryVid.paused) {
        secondaryVid.pause();
        secondaryVid.currentTime = 0;
      }
    }
  } else {
    // Scrubbing/Paused mode
    if (!primaryVid.paused) primaryVid.pause();
    if (Math.abs(primaryVid.currentTime - primaryTargetTime) > 0.1) {
      primaryVid.currentTime = primaryTargetTime;
    }

    if (inCrossfade) {
      if (!secondaryVid.paused) secondaryVid.pause();
      if (Math.abs(secondaryVid.currentTime - secondaryTargetTime) > 0.1) {
        secondaryVid.currentTime = secondaryTargetTime;
      }
    } else {
      if (!secondaryVid.paused) secondaryVid.pause();
      if (secondaryVid.currentTime !== 0) secondaryVid.currentTime = 0;
    }
  }
};

/**
 * Handles non-looping playback (single play through).
 */
const manageNonLoopingPlayback = (vids, localTime, duration, speed) => {
  const targetTime = Math.max(0, Math.min(duration - 0.05, localTime * speed));
  const primaryVid = vids[0];
  const secondaryVid = vids[1];

  if (secondaryVid && !secondaryVid.paused) {
    secondaryVid.pause();
    secondaryVid.currentTime = 0;
  }

  if (State.isPlaying && localTime < duration) {
    if (primaryVid.paused) {
      primaryVid.currentTime = targetTime;
      primaryVid.play().catch(() => {});
    } else if (Math.abs(primaryVid.currentTime - targetTime) > 0.5) {
      primaryVid.currentTime = targetTime;
    }
  } else {
    if (!primaryVid.paused) primaryVid.pause();
    if (Math.abs(primaryVid.currentTime - targetTime) > 0.1) {
      primaryVid.currentTime = targetTime;
    }
  }
};
