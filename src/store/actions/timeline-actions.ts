import type { ClipSettings } from "../../types/clips";
import { editorStore } from "../editor-store";
import { revokeClipUrls } from "../../utils/helpers";

/**
 * Immutable update of a timeline clip's own settings object (per-clip values
 * such as content/colors live on the clip itself, not the global registry).
 */
export function updateTimelineClipSettings(clipId: string, patch: Partial<ClipSettings>): void {
  const state = editorStore.getState();
  const next = state.timelineClips.map((c) =>
    c.id === clipId ? { ...c, settings: { ...c.settings, ...patch } } : c,
  );
  editorStore.setState({ timelineClips: next });
}

/**
 * Delete a clip from the active route's source (video snapshot during
 * thumbnail mode) and revoke its media URLs. Ported from the legacy delete
 * handler in `clips-panel.js`.
 */
export function deleteClip(clipId: string | null): void {
  if (!clipId) return;
  const state = editorStore.getState();

  if (state.currentRoute === "/image" && state.videoClips?.some((c) => c.id === clipId)) {
    const dead = state.videoClips.find((c) => c.id === clipId);
    if (dead) revokeClipUrls(dead, state);
    editorStore.setState({ videoClips: state.videoClips.filter((c) => c.id !== clipId), selectedClipId: null });
  } else {
    const dead = state.timelineClips.find((c) => c.id === clipId);
    if (dead) revokeClipUrls(dead, state);
    editorStore.setState({ timelineClips: state.timelineClips.filter((c) => c.id !== clipId), selectedClipId: null });
  }
}
