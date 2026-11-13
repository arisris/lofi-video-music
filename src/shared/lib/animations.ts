import { useEditorStore as editorStore } from "../../store/editor-store";
import { runtime } from "./runtime";
import {
  CLIP_TRANSITION_SECONDS,
  enterTransition,
  exitTransition,
} from "./transitions";

/**
 * Handles Pre-built In/Out Transitions and Dynamic Animations.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} settings - Clip settings containing animation info
 * @param {Number} localTime - Time in seconds since the clip started
 * @param {Number} duration - Total clip duration in seconds
 */
export const applyClipAnimations = (
  ctx: CanvasRenderingContext2D,
  settings: Record<string, any>,
  localTime: number,
  duration: number,
  clipType: string | null = null,
) => {
  // Thumbnail route skips animations for every clip except VFX —
  // the overlay/glviz panels still show this section in /image,
  // but the engine does not apply it.
  const isThumbnailMode = editorStore.getState().route === "/image";
  if (isThumbnailMode) {
    const vfxTypes = [
      "rain",
      "rain_gpu",
      "smoke",
      "flash",
      "snow",
      "fireflies",
      "filmgrain",
      "vignette",
    ];
    if (!clipType || !vfxTypes.includes(clipType)) {
      return;
    }
  }

  if (!settings.animations) return;

  const isPlaying = editorStore.getState().playing;

  const anim = settings.animations;
  const inType = anim.inType || "none";
  const outType = anim.outType || "none";
  const effectType = anim.type || "none";

  /** Pixels travelled by the slide effects. */
  const SLIDE_DISTANCE = 50;

  let opacity = 1;
  let offsetY = 0;
  let scale = 1;

  // 1. IN TRANSITIONS
  // Skip the in-transition while paused so a clip resting at its first frame is
  // still fully visible in the editor preview instead of fading in from 0.
  if (isPlaying && localTime < CLIP_TRANSITION_SECONDS) {
    const enter = enterTransition(inType, localTime / CLIP_TRANSITION_SECONDS);
    opacity *= enter.opacity;
    offsetY += enter.offsetY;
    scale *= enter.scale;
  }

  // 2. OUT TRANSITIONS
  if (isPlaying && localTime > duration - CLIP_TRANSITION_SECONDS) {
    const exit = exitTransition(
      outType,
      (duration - localTime) / CLIP_TRANSITION_SECONDS,
    );
    // The exit can only darken what the entrance already did, so a clip short
    // enough to be entering and leaving at once fades out smoothly instead of
    // snapping back to full opacity halfway through.
    opacity = Math.min(opacity, exit.opacity);
    offsetY += exit.offsetY;
    scale *= exit.scale;
  }

  // Apply Transitions
  ctx.globalAlpha *= opacity;
  if (offsetY !== 0) ctx.translate(0, offsetY * SLIDE_DISTANCE);
  if (scale !== 1) ctx.scale(scale, scale);

  // 3. CONTINUOUS ANIMATIONS (Smooth 60fps using performance.now)
  const time = performance.now() / 1000;

  // Calculate Audio Boost (if enabled)
  let audioBoost = 1.0;
  if (anim.audioReactive && runtime.dataArray && runtime.dataArray.length > 0) {
    // Average some mid-low frequencies for a good 'thump'
    let sum = 0;
    const count = Math.min(20, runtime.dataArray.length);
    for (let i = 0; i < count; i++) sum += runtime.dataArray[i] ?? 0;
    const avg = sum / count; // 0 to 255
    audioBoost = 1.0 + (avg / 255) * 1.5; // Up to 2.5x boost
  }

  if (effectType === "pulse") {
    const scale = 1 + Math.sin(time * Math.PI * 2 * 0.8) * 0.05 * audioBoost;
    ctx.scale(scale, scale);
  } else if (effectType === "float") {
    const offsetY = Math.sin(time * Math.PI * 2 * 0.5) * 8 * audioBoost;
    ctx.translate(0, offsetY);
  } else if (effectType === "shake") {
    const intensity = 3 * audioBoost;
    const offsetX = (Math.random() - 0.5) * intensity;
    const offsetY = (Math.random() - 0.5) * intensity;
    ctx.translate(offsetX, offsetY);
  } else if (effectType === "swing") {
    const rotation = Math.sin(time * Math.PI * 2 * 0.4) * 0.05 * audioBoost;
    ctx.rotate(rotation);
  }
};
