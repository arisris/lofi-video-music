import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import {
  drawVisualizer,
  listVisualizerDefs,
  resolveBBox,
  resolveVisualizerDef,
} from "../../visualizers";
import { useEditorStore } from "../../../store/editor-store";

export const glvizClip: ClipDefinition = {
  type: "glviz",
  name: "Visualizer",
  icon: "mdi:waveform",
  defaultDuration: 10,
  defaultSettings: {
    ...DEFAULT_TRANSFORM,
    variant: "bars",
    // Defaults must match the default variant — defs[0] is aura, so spreading
    // it here would leak aura's values (e.g. glow 1 instead of bars' 0.5)
    // into every fresh bars clip.
    ...(listVisualizerDefs().find((d) => d.id === "bars")?.settings ??
      listVisualizerDefs()[0]?.settings ?? { intensity: 60, color: "#22d3ee" }),
  },
  schema: [],
  draw({ ctx, w, h, settings, localTime, duration }) {
    const variant =
      typeof settings.variant === "string" ? settings.variant : "bars";
    const def = resolveVisualizerDef(variant);
    if (!def) return;
    const merged = { ...def.settings, ...settings };
    const bbox = resolveBBox(def, w, h, merged);
    const playing = useEditorStore.getState().playing;
    // In/Out/loop animations — legacy engine mirror (central drawWithTransform).
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "glviz");
    drawVisualizer(def, ctx, bbox, merged, localTime, playing);
    ctx.restore();
  },
  getItemBoundingBox(_ctx, w, h, settings) {
    const variant =
      typeof settings.variant === "string" ? settings.variant : "bars";
    const def = resolveVisualizerDef(variant);
    if (!def) return null;
    return resolveBBox(def, w, h, settings);
  },
};
