import m from "mithril";
import { State } from "../lib/state";

/**
 * UI-specific helpers that depend on State/mithril.
 */
export const showDragHint = () => {
  State.dragHintVisible = true;
  m.redraw();
  setTimeout(() => {
    State.dragHintVisible = false;
    m.redraw();
  }, 4000);
};
