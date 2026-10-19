import { editorStore } from "../../store/editor-store";
import { useState } from "react";
import {
  updateTimelineClipSettings,
  bumpClips,
} from "../../store/actions/timeline-actions";
import {
  SharedTextSettingsView,
  SharedTransformSettingsView,
  SharedAnimationSettingsView,
  useThumbnailMode,
} from "./shared";
import { CharBox } from "../char-box";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the "text" timeline clip. */
export const TextSettingsView = ({ clip }: ClipViewProps) => {
  const isThumbnailMode = useThumbnailMode();
  const [showCharBox, setShowCharBox] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const selectedClip =
    clip ||
    editorStore
      .getState()
      .timelineClips.find(
        (c: any) =>
          c.id === editorStore.getState().selectedClipId && c.type === "text",
      );

  if (!selectedClip) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 italic">
        Select a text from the list to change settings
      </div>
    );
  }

  const settings = selectedClip.settings as Record<string, any>;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  const insertChar = (char: string) => {
    const el = document.getElementById("text-editor-" + selectedClip.id);
    setShowCharBox(false);
    if (el) {
      const start = (el as unknown as HTMLTextAreaElement).selectionStart ?? 0;
      const end = (el as unknown as HTMLTextAreaElement).selectionEnd ?? start;
      const text = settings.content || "";
      settings.content = text.substring(0, start) + char + text.substring(end);
      bumpClips();
      // Reset cursor position after re-render
      setTimeout(() => {
        el.focus();
        (el as unknown as HTMLTextAreaElement).setSelectionRange(
          start + char.length,
          start + char.length,
        );
      }, 0);
    } else {
      settings.content = (settings.content || "") + char;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 duration-300">
      <div className="relative">
        <textarea
          id={"text-editor-" + selectedClip.id}
          key={"textarea-" + selectedClip.id}
          defaultValue={settings.content || ""}
          className="min-h-15 w-full resize-y rounded border border-slate-700 bg-slate-800 p-2 text-xs text-white outline-none focus:border-blue-500"
          onInput={(e) => {
            settings.content = e.currentTarget.value;
          }}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <div className="relative">
            <button
              ref={(el) => setTriggerEl(el)}
              className={`flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-400 transition-all hover:bg-slate-700 ${
                showCharBox ? "border-blue-500/30 text-blue-400" : ""
              }`}
              onClick={() => setShowCharBox((v) => !v)}
            >
              <i className="icon-[ri--chat-smile-2-line] h-3 w-3" />
              Emoji &amp; Chars
            </button>
            {showCharBox && (
              <CharBox
                trigger={triggerEl}
                onSelect={insertChar}
                onClose={() => setShowCharBox(false)}
              />
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            Use \n for multiple lines
          </p>
        </div>
      </div>

      <SharedTextSettingsView
        settings={settings}
        updateSettings={update}
        sections={["typography", "strokeShadow", "background", "textEffects"]}
      />
      <SharedTransformSettingsView
        settings={settings}
        updateSettings={update}
      />
      {!isThumbnailMode && (
        <SharedAnimationSettingsView
          settings={settings}
          updateSettings={update}
        />
      )}
    </div>
  );
};
