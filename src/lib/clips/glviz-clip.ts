import { editorStore } from "../../store/editor-store";
import { drawVisualizer, resolveBBox, resolveVisualizerDef } from "../gl-viz";
import type { BBox } from "../gl-viz";
import { WebGLRenderer } from "../webgl-renderer";
import { GlvizSettingsView } from "../../components/clip-settings/glviz";

/**
 * Timeline clip that renders a shader visualizer.
 *
 * Sibling of the legacy "visualizer" clip rather than a replacement: that one
 * draws with Canvas 2D from a frozen registry and is left untouched, so a
 * project using either keeps working.
 *
 * Everything visualizer-specific lives in src/lib/gl-viz/. This file only
 * adapts a definition to the clip contract - bounding box, animation clock
 * and the WebGL-unsupported message - so the registry keeps working while this
 * one changes shape.
 */
export const GlvizClip = {
  id: "glviz",
  name: "Shader Visualizer",
  icon: "icon-[ri--shapes-line]",

  settings: {
    style: "bars",
    opacity: 1,
  },

  /**
   * Definitions own their own defaults, so a fresh clip has to be built from
   * the selected one rather than from a shared table that would drift out of
   * sync with src/lib/gl-viz/defs/. This is the exact seam that left the
   * legacy visualizer clip missing reflectionOpacity and size on newly added
   * clips, papered over by ?? fallbacks in its inspector.
   */
  getDefaultSettings(specific: Record<string, unknown> = {}) {
    const style = (specific.style as string) || "bars";
    const def = resolveVisualizerDef(style);
    return {
      ...def?.settings,
      ...(def ? { style: def.id } : { style }),
      opacity: 1,
    };
  },

  getItemBoundingBox(
    _ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
  ): BBox | null {
    const def = resolveVisualizerDef(settings?.style as string);
    if (!def) return null;
    return resolveBBox(def, w, h, settings);
  },

  drawItem(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
    _localTime: number,
    clip: Record<string, any>,
  ) {
    const def = resolveVisualizerDef(settings?.style as string);
    if (!def) return;

    if (!WebGLRenderer.isSupported()) {
      ctx.save();
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
      ctx.font = "12px monospace";
      ctx.fillText(
        "WebGL not supported - Shader Visualizer disabled",
        20,
        h - 20,
      );
      ctx.restore();
      return;
    }

    // Run an animation clock off wall time rather than timeline time, so the
    // shader keeps moving while playback is paused and settings can be judged
    // without starting the track. Same approach as rain-gpu.
    const now = performance.now();
    if (clip.animTime === undefined) {
      clip.animTime = 0;
    } else {
      clip.animTime += Math.min(
        (now - (clip.lastRenderTime || now)) / 1000,
        0.1,
      );
    }
    clip.lastRenderTime = now;

    const bbox = resolveBBox(def, w, h, settings);
    ctx.save();
    ctx.globalAlpha = settings.opacity !== undefined ? settings.opacity : 1;
    drawVisualizer(
      def,
      ctx,
      bbox,
      settings,
      clip.animTime,
      editorStore.getState().isPlaying,
    );
    ctx.restore();
  },

  /** Empty on purpose: this is a timeline clip, drawn by drawItem. */
  draw() {},

  onSettings: GlvizSettingsView,
};
