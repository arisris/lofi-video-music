import { editorStore } from "../store/editor-store";
import { runtime } from "./runtime";

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
  const isThumbnailMode = editorStore.getState().currentRoute === "/image";
  if (isThumbnailMode) {
    const vfxTypes = ["rain", "smoke", "flash", "snow", "fireflies", "filmgrain", "vignette"];
    if (!clipType || !vfxTypes.includes(clipType)) {
      return;
    }
  }

  if (!settings.animations) return;

  const anim = settings.animations;
  const inType = anim.inType || "none";
  const outType = anim.outType || "none";
  const effectType = anim.type || "none";

  const TRANS_DUR = 0.6; // Fixed duration for all transitions
  
  let opacity = 1;
  let transX = 0;
  let transY = 0;
  let transScale = 1;

  // 1. IN TRANSITIONS
  if (localTime < TRANS_DUR) {
    const p = localTime / TRANS_DUR; // 0 to 1
    const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

    if (inType === "fade") {
      opacity = easeOutCubic(p);
    } else if (inType === "slide-up") {
      opacity = easeOutCubic(p);
      transY = (1 - easeOutCubic(p)) * 50;
    } else if (inType === "slide-down") {
      opacity = easeOutCubic(p);
      transY = (1 - easeOutCubic(p)) * -50;
    } else if (inType === "zoom-in") {
      opacity = easeOutCubic(p);
      transScale = 0.5 + easeOutBack(p) * 0.5;
    } else if (inType === "bounce") {
      opacity = easeOutCubic(p);
      transScale = easeOutBack(p);
    }
  }

  // 2. OUT TRANSITIONS
  if (localTime > (duration - TRANS_DUR)) {
    const p = (duration - localTime) / TRANS_DUR; // 1 to 0
    const easeInCubic = (x: number) => x * x * x;

    if (outType === "fade") {
      opacity = Math.min(opacity, easeInCubic(p));
    } else if (outType === "slide-up") {
      opacity = Math.min(opacity, easeInCubic(p));
      transY -= (1 - easeInCubic(p)) * 50;
    } else if (outType === "slide-down") {
      opacity = Math.min(opacity, easeInCubic(p));
      transY += (1 - easeInCubic(p)) * 50;
    } else if (outType === "zoom-out") {
      opacity = Math.min(opacity, easeInCubic(p));
      transScale *= (0.5 + easeInCubic(p) * 0.5);
    }
  }

  // Apply Transitions
  ctx.globalAlpha *= opacity;
  if (transX !== 0 || transY !== 0) ctx.translate(transX, transY);
  if (transScale !== 1) ctx.scale(transScale, transScale);

  // 3. CONTINUOUS ANIMATIONS (Smooth 60fps using performance.now)
  const time = performance.now() / 1000;
  
  // Calculate Audio Boost (if enabled)
  let audioBoost = 1.0;
  if (anim.audioReactive && runtime.dataArray) {
    // Average some mid-low frequencies for a good 'thump'
    let sum = 0;
    const count = 20;
    for (let i = 0; i < count; i++) sum += runtime.dataArray[i];
    const avg = sum / count; // 0 to 255
    audioBoost = 1.0 + (avg / 255) * 1.5; // Up to 2.5x boost
  }

  if (effectType === "pulse") {
    const scale = 1 + Math.sin(time * Math.PI * 2 * 0.8) * 0.05 * audioBoost;
    ctx.scale(scale, scale);
  } 
  else if (effectType === "float") {
    const offsetY = Math.sin(time * Math.PI * 2 * 0.5) * 8 * audioBoost;
    ctx.translate(0, offsetY);
  }
  else if (effectType === "shake") {
    const intensity = 3 * audioBoost;
    const offsetX = (Math.random() - 0.5) * intensity;
    const offsetY = (Math.random() - 0.5) * intensity;
    ctx.translate(offsetX, offsetY);
  }
  else if (effectType === "swing") {
    const rotation = Math.sin(time * Math.PI * 2 * 0.4) * 0.05 * audioBoost;
    ctx.rotate(rotation);
  }
};
