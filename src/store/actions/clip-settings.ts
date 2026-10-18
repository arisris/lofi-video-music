import type { ClipRegistryEntry } from "../../types/clips";
import type { ClipSettings } from "../../types/clips";
import { editorStore } from "../editor-store";
import { ClipRegistry } from "../../lib/clips/index";

/**
 * Immutable update of a registry entry's settings.
 *
 * Settings are replaced rather than mutated in place: the registry holds
 * `clip.settings` by reference (see `ClipRegistry.register`), so plain nested
 * mutation would leave React subscriptions comparing against the same object,
 * while swapping the object without rebinding would leave the clips reading
 * the old one. This helper does both, keeping the two in step.
 */
export function updateClipSettings(id: string, patch: Partial<ClipSettings>): void {
  const state = editorStore.getState();
  const current = state.clipSettings[id];
  const next: Record<string, ClipSettings> = {
    ...state.clipSettings,
    [id]: { ...current, ...patch },
  };

  // Re-bind the registered clips to the new settings reference.
  const entries = ClipRegistry.getAll() as ClipRegistryEntry[];
  for (const clip of entries) {
    if (next[clip.id]) clip.settings = next[clip.id];
  }

  editorStore.setState({ clipSettings: next });
}
