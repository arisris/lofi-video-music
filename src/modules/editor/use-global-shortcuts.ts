import { useEffect } from "react";
import { pauseAudio, playAudio, seekTo } from "../audio/audio-engine";
import { getTotalDuration, useEditorStore } from "../../store/editor-store";
import { isTypingTarget } from "../../shared/lib/shortcuts";

/** Single global keydown handler for app shortcuts (playback + editing).
 * Replaces the scattered per-component listeners so behavior, guards
 * (typing / recording), and the help dialog stay in one place. */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lower = key.toLowerCase();
      const typing = isTypingTarget(e.target);

      // Escape always closes the topmost layer first.
      if (key === "Escape") {
        if (st.showShortcutsHelp) {
          e.preventDefault();
          useEditorStore.setState({ showShortcutsHelp: false });
          return;
        }
        if (st.showRecordSettingsModal) {
          e.preventDefault();
          useEditorStore.setState({ showRecordSettingsModal: false });
          return;
        }
        if (st.showRecordMenu) {
          e.preventDefault();
          useEditorStore.setState({ showRecordMenu: false });
          return;
        }
        if (st.selectedTransitionClipId) {
          e.preventDefault();
          useEditorStore.setState({ selectedTransitionClipId: null });
          return;
        }
        if (typing) return;
        if (st.selectedClipId) {
          e.preventDefault();
          st.select(null);
        }
        return;
      }

      if (e.altKey || typing) return;

      // Ctrl/Cmd combinations.
      if (mod) {
        if (lower === "z" && !e.shiftKey) {
          if (st.isRecording) return;
          e.preventDefault();
          st.undo();
          return;
        }
        if (lower === "y" || (lower === "z" && e.shiftKey)) {
          if (st.isRecording) return;
          e.preventDefault();
          st.redo();
          return;
        }
        if (lower === "d") {
          const id = st.selectedClipId;
          if (!id || id === "lyrics" || st.isRecording) return;
          if (!st.clips.some((c) => c.id === id)) return;
          e.preventDefault();
          st.duplicateClip(id);
          return;
        }
        if (key === "/") {
          e.preventDefault();
          useEditorStore.setState({ showShortcutsHelp: true });
          return;
        }
        return;
      }

      // Help dialog.
      if (key === "?") {
        e.preventDefault();
        useEditorStore.setState({ showShortcutsHelp: true });
        return;
      }

      // Playback + editing need an idle (non-recording) editor.
      if (st.isRecording) return;

      // Space / K toggles playback — but a focused button already
      // activates on Space, so let the native click win there.
      if (key === " " || lower === "k") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
        e.preventDefault();
        if (st.playing) pauseAudio();
        else playAudio();
        return;
      }

      if (key === "Delete" || key === "Backspace") {
        const id = st.selectedClipId;
        if (!id || id === "lyrics") return;
        if (!st.clips.some((c) => c.id === id)) return;
        e.preventDefault();
        st.removeClip(id);
        return;
      }

      if (key === "ArrowLeft" || key === "ArrowRight") {
        const step = e.shiftKey ? 5 : 1;
        e.preventDefault();
        seekTo(st.currentTime + (key === "ArrowLeft" ? -step : step));
        return;
      }

      if (key === "Home") {
        e.preventDefault();
        seekTo(0);
        return;
      }

      if (key === "End") {
        e.preventDefault();
        seekTo(getTotalDuration(st.clips));
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
