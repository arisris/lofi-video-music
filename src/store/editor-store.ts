import { createStore, useStore } from "zustand";
import type { StateCreator } from "zustand";
import type { EditorStore } from "./store-types";
import { createPlaybackSlice } from "./slices/playback";
import { createRecordingSlice } from "./slices/recording";
import { createTimelineSlice } from "./slices/timeline";
import { createInteractionSlice } from "./slices/interaction";
import { createMediaPoolSlice } from "./slices/media-pool";
import { createLayoutSlice } from "./slices/layout";
import { createModeSlice } from "./slices/mode";
import { createThumbnailSlice } from "./slices/thumbnail";

const sliceCreators = [
  createPlaybackSlice,
  createRecordingSlice,
  createTimelineSlice,
  createInteractionSlice,
  createMediaPoolSlice,
  createLayoutSlice,
  createModeSlice,
  createThumbnailSlice,
] as unknown as StateCreator<EditorStore>[];

const storeMeta = (import.meta.hot?.data as { editorState?: Partial<EditorStore> } | undefined)?.editorState;

/**
 * Single source of truth for the whole editor.
 * `src/lib/state.js` (legacy global `State`) is a Proxy bridge on top of this
 * store, so every legacy read/write keeps working during the migration.
 */
export const editorStore = createStore<EditorStore>()((set, get, api) => {
  const initial: EditorStore = Object.create(null);
  for (const creator of sliceCreators) {
    const slice = creator(set, get, api);
    Object.assign(initial, slice);
  }
  if (storeMeta) {
    // Restore state persisted across HMR updates (never restore actions).
    for (const [key, value] of Object.entries(storeMeta)) {
      if (typeof value !== "function") {
        (initial as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
  return initial;
});

if (import.meta.hot) {
  // Persist the current state so hot reloads do not reset editor content.
  (import.meta.hot.data as { editorState?: EditorStore }).editorState = editorStore.getState();
}

/** React hook for the editor store (used from Phase 3 onwards). */
export const useEditorStore = <T,>(selector: (state: EditorStore) => T): T => useStore(editorStore, selector);

/** Derived selector for the active editor mode. */
export const selectIsThumbnailMode = (state: EditorStore): boolean => state.currentRoute === "/image";

/** Convenience selector for the whole store shape (avoid: re-renders on everything). */
export const selectAll = (state: EditorStore): EditorStore => state;
