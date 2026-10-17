// Legacy compatibility bridge.
//
// During the migration to Zustand, the store (src/store/editor-store.ts) is the
// single source of truth. `State` stays importable under the same path and shape
// so legacy Mithril components and lib modules keep working unchanged: the Proxy
// forwards every property read/write into the store.
//
// In-place mutations of nested objects (e.g. State.clipSettings[x].y = 1) mutate
// the same object referenced by the store, keeping legacy behavior. Proper
// immutable updates land component-by-component from Phase 3 onwards.
import { editorStore } from "../store/editor-store";

export const State = new Proxy(Object.create(null), {
  get(_target, prop) {
    if (prop === "isThumbnailMode") {
      return editorStore.getState().currentRoute === "/image";
    }
    return editorStore.getState()[prop];
  },

  set(_target, prop, value) {
    editorStore.setState({ [prop]: value });
    return true;
  },

  has(_target, prop) {
    if (prop === "isThumbnailMode") return true;
    return prop in editorStore.getState();
  },

  ownKeys(_target) {
    return Reflect.ownKeys(editorStore.getState());
  },

  getOwnPropertyDescriptor(_target, prop) {
    const state = editorStore.getState();
    if (prop in state || prop === "isThumbnailMode") {
      return {
        configurable: true,
        enumerable: true,
        value: undefined, // value is resolved via the get trap
      };
    }
    return undefined;
  },
});
