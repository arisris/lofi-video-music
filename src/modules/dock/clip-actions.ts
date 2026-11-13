import { createTimelineClip } from "../clips/_core/factory";
import { getClipDef } from "../clips";
import { useEditorStore } from "../../store/editor-store";

export function addClipOfType(type: string, overrides: Record<string, unknown> = {}) {
  const def = getClipDef(type);
  const st = useEditorStore.getState();
  // music→track-1, others follow the selected track except
  // track-1 (redirected to track-2).
  const selected = st.selectedTrackId;
  const trackId =
    type === "music"
      ? "track-1"
      : selected && selected !== "track-1"
        ? selected
        : "track-2";
  const { trackId: overrideTrack, ...settingOverrides } = overrides as {
    trackId?: string;
    [k: string]: unknown;
  };
  st.addClip(
    createTimelineClip(
      type as never,
      st.currentTime,
      { ...(def?.defaultSettings ?? {}), ...settingOverrides },
      def?.defaultDuration ?? 5,
      overrideTrack ?? trackId,
    ),
  );
}
