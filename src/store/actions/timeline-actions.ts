import type { ClipSettings, TimelineClip } from "../../types/clips";
import { editorStore } from "../editor-store";
import { revokeClipUrls } from "../../utils/helpers";

/**
 * Immutable update of a timeline clip's own settings object (per-clip values
 * such as content/colors live on the clip itself, not the global registry).
 *
 * Also handles thumbnail-mode clips (stored in `videoClips`) and lets callers
 * patch top-level clip props (e.g. `duration`, particle caches) alongside the
 * settings patch.
 */
export function updateTimelineClipSettings(
  clipId: string,
  patch: Partial<ClipSettings>,
  clipPatch: Partial<TimelineClip> = {},
): void {
  const state = editorStore.getState();

  const apply = (clips: TimelineClip[]) =>
    clips.map((c) =>
      c.id === clipId
        ? ({ ...c, ...clipPatch, settings: { ...c.settings, ...patch } } as TimelineClip)
        : c,
    );

  const nextTimeline = apply(state.timelineClips);
  const nextVideo = state.currentRoute === "/image" ? apply(state.videoClips ?? []) : undefined;

  editorStore.setState(
    nextVideo ? { timelineClips: nextTimeline, videoClips: nextVideo } : { timelineClips: nextTimeline },
  );
}

/**
 * Force a re-render of React panels that read clip data from the store.
 * Used after in-place mutations from imperative code (e.g. media upload
 * processing) that need a store poke.
 */
export function bumpClips(): void {
  const state = editorStore.getState();
  const patch: Record<string, unknown> = { timelineClips: [...state.timelineClips] };
  if (state.currentRoute === "/image" && state.videoClips) {
    patch.videoClips = [...state.videoClips];
  }
  editorStore.setState(patch);
}

/**
 * Delete a clip from the active route's source (video snapshot during
 * thumbnail mode) and revoke its media URLs. Also used by the delete
 * handler in `clips-panel.js`.
 */
export function deleteClip(clipId: string | null): void {
  if (!clipId) return;
  const state = editorStore.getState();

  if (state.currentRoute === "/image" && state.videoClips?.some((c) => c.id === clipId)) {
    const dead = state.videoClips.find((c) => c.id === clipId);
    if (dead) revokeClipUrls(dead, state);
    editorStore.setState({
      videoClips: state.videoClips.filter((c) => c.id !== clipId),
      selectedClipId: null,
    });
    return;
  }

  const dead = state.timelineClips.find((c) => c.id === clipId);
  if (dead) revokeClipUrls(dead, state);
  editorStore.setState({
    timelineClips: state.timelineClips.filter((c) => c.id !== clipId),
    selectedClipId: null,
  });
}
