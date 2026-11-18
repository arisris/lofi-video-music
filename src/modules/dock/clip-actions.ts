import { createTimelineClip } from "../clips/_core/factory";
import { getClipDef } from "../clips";
import { useEditorStore } from "../../store/editor-store";
import {
  BG_TRACK_ID,
  DEDICATED_TRACK_IDS,
  MUSIC_TRACK_ID,
  contentTrackId,
} from "../../store/project-defaults";

export function addClipOfType(type: string, overrides: Record<string, unknown> = {}) {
  const def = getClipDef(type);
  const st = useEditorStore.getState();
  // music→music lane, background→bg lane, others follow the selected
  // content track (dedicated lanes are never a fallback target).
  const selected = st.selectedTrackId;
  const trackId =
    type === "music"
      ? MUSIC_TRACK_ID
      : type === "background"
        ? BG_TRACK_ID
        : selected && !DEDICATED_TRACK_IDS.has(selected)
          ? selected
          : contentTrackId(st.tracks);
  const { trackId: overrideTrack, ...settingOverrides } = overrides as {
    trackId?: string;
    [k: string]: unknown;
  };
  // Background appends after the last bg clip — the lane never overlaps.
  const start =
    type === "background"
      ? st.clips
          .filter((c) => c.type === "background")
          .reduce((m, c) => Math.max(m, c.start + c.duration), 0)
      : st.currentTime;
  st.addClip(
    createTimelineClip(
      type as never,
      start,
      { ...(def?.defaultSettings ?? {}), ...settingOverrides },
      def?.defaultDuration ?? 5,
      overrideTrack ?? trackId,
    ),
  );
}
