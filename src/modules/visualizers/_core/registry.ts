// Registry of shader visualizer definitions, keyed by id.
//
// Deliberately separate from ClipRegistry: a VisualizerDef is a *style* the
// glviz clip can take, not a clip type in its own right. The glviz clip is the
// single registered clip type; every definition hangs off it as `settings.style`.

import type { VisualizerDef } from "./types";

const registry = new Map<string, VisualizerDef>();

export const registerVisualizer = (def: VisualizerDef): void => {
  registry.set(def.id, def);
};

/** Resolves a style id, or undefined when it was never registered or removed. */
export const getVisualizerDef = (id: string): VisualizerDef | undefined =>
  registry.get(id);

export const listVisualizerDefs = (): VisualizerDef[] => [...registry.values()];

/**
 * Resolves a style id, falling back to the first registered definition.
 *
 * Timelines persist `settings.style`, so removing a definition must not break
 * projects saved earlier - the clip keeps rendering, just with a different
 * look. Warns once per missing id so the cause is visible in the console.
 */
const warned = new Set<string>();
export const resolveVisualizerDef = (id: string): VisualizerDef | undefined => {
  const found = registry.get(id);
  if (found) return found;

  const fallback = registry.values().next().value;
  if (fallback && !warned.has(id)) {
    warned.add(id);
    console.warn(
      `[glviz] unknown visualizer "${id}", falling back to "${fallback.id}". ` +
        `Re-register it in src/lib/gl-viz/defs/ to restore it.`,
    );
  }
  return fallback;
};
