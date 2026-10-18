import { editorStore } from "../../store/editor-store";
import { VignetteSettingsView } from "../../components/clip-settings/vfx/vignette";
import { getAudioReactivity } from "../../utils/helpers";

export const VignetteVFX = {
  id: "vignette",
  name: "Beat Vignette",
  icon: "icon-[ri--focus-3-line]",

  settings: {
    opacity: 0.4,
    color: "#000000",
    audioReactive: false,
  },

  drawItem(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
    _localTime: number,
    _clip: Record<string, any>,
  ) {
    const opacity = settings.opacity !== undefined ? settings.opacity : 0.4;
    const color = settings.color || "#000000";

    const audioLevel = settings.audioReactive ? getAudioReactivity(editorStore.getState(), "bass") : 0;

    // Pulse opacity and close in the radius on strong bass beats
    const activeOpacity = Math.max(0.0, Math.min(1.0, opacity + audioLevel * 0.45));

    // Scale the vignette circle radius based on audio level
    const maxRadius = Math.sqrt(w * w + h * h) / 2;
    const radiusScale = settings.audioReactive ? Math.max(0.5, 1.1 - audioLevel * 0.45) : 1.0;
    const outerRadius = maxRadius * radiusScale;

    // Convert hex color to rgba for gradient
    // Simple helper to parse hex to rgb
    let r = 0,
      g = 0,
      b = 0;
    const hex = color.replace(/^#/, "");
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }

    ctx.save();

    // Create radial gradient anchored in center
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, outerRadius);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`); // center is transparent
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${activeOpacity})`); // edges are colored

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  },

  onSettings: VignetteSettingsView,
};
