import type { ClipDefinition } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { useEditorStore } from "../../../store/editor-store";
import { clipsForAudio } from "../../audio/audio-engine";
import { drawTextItem, getTextBoundingBox } from "../text/draw-text";

// Legacy app mirror (global TitleClip): when autoTrackName is on, the drawn
// text is the active music clip's name under the playhead; with no active music
// nothing is drawn.
/** Name of the active music clip under the playhead (null when none). */
function activeMusicName(): string | null {
  const st = useEditorStore.getState();
  const t = st.currentTime;
  const active = clipsForAudio().find(
    (c) =>
      c.type === "music" &&
      (c.settings.enabled as boolean | undefined) !== false &&
      t >= c.start &&
      t <= c.start + c.duration,
  );
  if (!active) return null;
  const name = active.settings.name;
  return typeof name === "string" && name ? name : "Untitled Track";
}

/** Text to measure/draw: active track name when auto, else content. */
function resolvedText(settings: Record<string, unknown>): string | null {
  const auto = (settings.autoTrackName as boolean | undefined) !== false;
  if (!auto) return typeof settings.content === "string" ? settings.content : "";
  return activeMusicName();
}

// Title uses the same text renderer with larger/bolder defaults.
// Legacy app mirror (global TitleClip): when autoTrackName is on, the drawn
// text is the active music clip's name under the playhead; with no active music
// nothing is drawn.
export const titleClip: ClipDefinition = {
  type: "title",
  name: "Title",
  icon: "mdi:format-title",
  defaultDuration: 4,
  defaultSettings: {
    content: "Midnight Drive",
    autoTrackName: true,
    ...DEFAULT_TRANSFORM,
    fontFamily: "sans-serif",
    fontWeight: "bold",
    fontSize: 96,
    lineHeight: 1.2,
    textAlign: "center",
    textColor: "#fbbf24",
    strokeColor: "#000000",
    strokeWidth: 0,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    bgColor: "transparent",
    bgPadding: 10,
    bgRadius: 8,
    textEffect: "none",
    typewriterSpeed: 15,
    typewriterOut: true,
  },
  schema: [
    { key: "content", label: "Title", kind: "text" },
    { key: "fontSize", label: "Size", kind: "slider", min: 24, max: 220 },
    { key: "textColor", label: "Color", kind: "color" },
  ],
  draw({ ctx, w, h, settings, localTime, duration }) {
    const text = resolvedText(settings as Record<string, unknown>);
    if (text === null || !text) return;
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "title");
    drawTextItem(ctx, w, h, { ...settings, content: text }, localTime, duration, -200);
    ctx.restore();
  },
  getItemBoundingBox(ctx, w, h, settings) {
    const text = resolvedText(settings as Record<string, unknown>) ?? "";
    return getTextBoundingBox(ctx, w, h, { ...settings, content: text }, -200);
  },
};
