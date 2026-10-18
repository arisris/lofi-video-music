import { State } from "../lib/state";

/**
 * UI-specific helpers that depend on the editor store.
 */
export const showDragHint = () => {
  State.dragHintVisible = true;
  setTimeout(() => {
    State.dragHintVisible = false;
  }, 4000);
};