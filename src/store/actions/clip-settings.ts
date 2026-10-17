import type { ClipRegistryEntry } from "../../types/clips";
import type { ClipSettings } from "../../types/clips";
import { editorStore } from "../editor-store";
import { ClipRegistry } from "../../lib/clips/index";

/**
 * Immutable update of a registry entry's settings.
 *
 * Legacy Mithril code bound `clip.settings` to the settings object by
 * reference (see `ClipRegistry.register`), so plain nested mutation left React
 * subscriptions dead and object replacement left legacy bindings stale.
 * This helper replaces the settings object and rebinds every registered
 * clip's `.settings`, keeping both worlds consistent.
 */
export function updateClipSettings(id: string, patch: Partial<ClipSettings>): void {
  const state = editorStore.getState();
  const current = state.clipSettings[id];
  const next: Record<string, ClipSettings> = {
    ...state.clipSettings,
    [id]: { ...current, ...patch },
  };

  // Re-bind live clips to the new settings reference (legacy compatibility).
  const entries = ClipRegistry.getAll() as ClipRegistryEntry[];
  for (const clip of entries) {
    if (next[clip.id]) clip.settings = next[clip.id];
  }

  editorStore.setState({ clipSettings: next });
}
