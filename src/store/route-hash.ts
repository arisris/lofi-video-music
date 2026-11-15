import { useEffect } from "react";
import { useEditorStore } from "./editor-store";

export type EditorRoute = "/" | "/image";

export const EDITOR_ROUTES: readonly EditorRoute[] = ["/", "/image"];

const HASH_FOR_ROUTE: Record<EditorRoute, string> = {
  "/": "#/",
  "/image": "#/image",
};

/** Read the current hash (#/ or #/image). Unknown or empty hashes normalize to "/". */
export const parseHashRoute = (): EditorRoute => {
  const path = window.location.hash.replace(/^#/, "");
  return path.startsWith("/image") ? "/image" : "/";
};

/** Write the hash only when it differs, so store/hash sync never loops. */
export const writeHashRoute = (route: EditorRoute): void => {
  if (window.location.hash !== HASH_FOR_ROUTE[route]) {
    window.location.hash = route;
  }
};

/** Store-driven navigation: swap clips/selection, then mirror to the hash. */
export const navigateRoute = (route: EditorRoute): void => {
  useEditorStore.getState().swapRoute(route);
  writeHashRoute(route);
};

/**
 * Bidirectional hash <-> store sync (loop-guarded both directions).
 * Mount sync covers reload/deep-link; hashchange covers back/forward;
 * the store subscription mirrors undo/redo route flips back to the URL.
 */
export const useRouteHashSync = (): void => {
  useEffect(() => {
    const current = parseHashRoute();
    if (useEditorStore.getState().route !== current) {
      useEditorStore.getState().swapRoute(current);
    }
    const onHashChange = () => {
      const next = parseHashRoute();
      if (useEditorStore.getState().route !== next) {
        useEditorStore.getState().swapRoute(next);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    const unsubscribe = useEditorStore.subscribe((s, prev) => {
      if (s.route !== prev.route) writeHashRoute(s.route);
    });
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      unsubscribe();
    };
  }, []);
};
