// Registry of shader visualizer definitions, keyed by id.
//
// Built on the shared createRegistry (same shape as clips/vfx, keyed on `id`
// instead of `type`): a VisualizerDef is a *style* the glviz clip can take,
// not a clip type in its own right. The glviz clip is the single registered
// clip type; every definition hangs off it as `settings.variant`.

import { createRegistry } from "../../clips/_core/registry";
import type { VisualizerDef } from "./types";

const registry = createRegistry<VisualizerDef>((e) => e.id);

export const registerVisualizer = (def: VisualizerDef): void => {
  registry.register(def);
};

/** Resolves a style id, or undefined when it was never registered or removed. */
export const getVisualizerDef = (id: string): VisualizerDef | undefined =>
  registry.get(id);

export const listVisualizerDefs = (): VisualizerDef[] => registry.list();

/**
 * Resolves a style id, falling back to the first registered definition.
 *
 * Timelines persist `settings.variant`, so removing a definition must not break
 * projects saved earlier - the clip keeps rendering, just with a different
 * look. Warns once per missing id so the cause is visible in the console.
 */
const warned = new Set<string>();
export const resolveVisualizerDef = (id: string): VisualizerDef | undefined => {
  const found = registry.get(id);
  if (found) return found;

  const fallback = registry.list()[0];
  if (fallback && !warned.has(id)) {
    warned.add(id);
    console.warn(
      `[glviz] unknown visualizer "${id}", falling back to "${fallback.id}". ` +
        `Re-register it in src/modules/visualizers/defs/ to restore it.`,
    );
  }
  return fallback;
};
