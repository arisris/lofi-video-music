import type { ClipDefinition, TimelineClip } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { drawTextItem, getTextBoundingBox } from "../text/draw-text";

/** Active music clip name at a global time (pure: no store reads). */
export function activeMusicNameIn(clips: TimelineClip[], globalTime: number): string | null {
  const active = clips.find(
    (c) =>
      c.type === "music" &&
      (c.settings.enabled as boolean | undefined) !== false &&
      globalTime >= c.start &&
      globalTime <= c.start + c.duration,
  );
  if (!active) return null;
  const name = active.settings.name;
  return typeof name === "string" && name ? name : "Untitled Track";
}

/** Text to draw/measure: active track name when auto, else manual content. */
export function resolveTitleText(
  settings: Record<string, unknown>,
  clips: TimelineClip[],
  globalTime: number,
): string | null {
  const auto = (settings.autoTrackName as boolean | undefined) !== false;
  if (!auto) return typeof settings.content === "string" ? settings.content : "";
  return activeMusicNameIn(clips, globalTime);
}

/** Merge resolved title text into settings so draw/bbox stay pure. */
export function titleSettingsForFrame(
  settings: Record<string, unknown>,
  clips: TimelineClip[],
  globalTime: number,
): Record<string, unknown> | null {
  const text = resolveTitleText(settings, clips, globalTime);
  if (text === null || !text) return null;
  return { ...settings, content: text };
}

// Title uses the text renderer with larger/bolder defaults.
// When autoTrackName is on, the caller (render-loop / canvas hit-test)
// resolves the active music name via titleSettingsForFrame; this definition
// never touches the store so headless export stays pure.
export const titleClip: ClipDefinition = {
  type: "title",
  name: "Title",
  icon: "mdi:format-title",
  defaultDuration: 4,
  defaultSettings: {
    content: "Midnight Drive",
    autoTrackName: true,
    ...DEFAULT_TRANSFORM,
    offsetY: -200,
    opacity: 1,
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
    { key: "opacity", label: "Opacity", kind: "slider", min: 0, max: 1, step: 0.05 },
    { key: "offsetY", label: "Base Y offset", kind: "slider", min: -500, max: 500, step: 1 },
  ],
  draw({ ctx, w, h, settings, localTime, duration }) {
    const text = typeof settings.content === "string" ? settings.content : "";
    if (!text) return;
    ctx.save();
    applyClipAnimations(ctx, settings, localTime, duration, "title");
    const opacity = typeof settings.opacity === "number" ? settings.opacity : 1;
    ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
    drawTextItem(ctx, w, h, settings, localTime, duration, -200);
    ctx.restore();
  },
  getItemBoundingBox(ctx, w, h, settings) {
    const text = typeof settings.content === "string" ? settings.content : "";
    if (!text) return null;
    return getTextBoundingBox(ctx, w, h, settings, -200);
  },
};
