import { editorStore } from "../store/editor-store";

/**
 * UI-specific helpers that depend on the editor store.
 */
export const showDragHint = () => {
  editorStore.setState({ dragHintVisible: true });
  setTimeout(() => {
    editorStore.setState({ dragHintVisible: false });
  }, 4000);
};