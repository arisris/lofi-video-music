// Pure seamless-loop math for paired <video> elements.
//
// The draw side (background/overlay definitions) and the playback side
// (video-playback.ts) must agree on loopIndex/loopTime at the seam, so both
// go through this helper instead of duplicating the period math.
export interface VideoLoopBlend {
  /** Overlap window at each loop seam, in seconds of video time. */
  crossfadeDur: number;
  /** Steady-state loop length (videoDuration minus the overlap). */
  period: number;
  /** How many periods have elapsed (selects primary/secondary element). */
  loopIndex: number;
  /** Position inside the current period, in seconds of video time. */
  loopTime: number;
  /** True while the previous loop's tail is still fading out. */
  inCrossfade: boolean;
}

/**
 * Resolve the loop state for a clip at `localTime` (seconds, clip space)
 * playing at `speed` from a `videoDuration`-long source.
 * Returns null when seamless looping is impossible (unknown duration or
 * fewer than two elements) — callers then fall back to single playback.
 */
export function resolveVideoLoop(
  localTime: number,
  speed: number,
  videoDuration: number,
  elementCount: number,
): VideoLoopBlend | null {
  if (!Number.isFinite(localTime) || !Number.isFinite(speed)) return null;
  if (!(videoDuration > 0) || elementCount < 2) return null;
  const crossfadeDur = Math.min(1.5, videoDuration / 4);
  const period = videoDuration - crossfadeDur;
  if (!(period > 0)) return null;
  const virtualTime = Math.max(0, localTime * speed);
  const loopIndex = Math.floor(virtualTime / period);
  const loopTime = virtualTime % period;
  return {
    crossfadeDur,
    period,
    loopIndex,
    loopTime,
    inCrossfade: loopTime < crossfadeDur && loopIndex > 0,
  };
}
