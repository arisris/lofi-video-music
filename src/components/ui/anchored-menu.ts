import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Where the pointer was when the menu opened. */
export interface MenuAnchor {
  x: number;
  y: number;
}

/** Size of the rendered menu. */
export interface MenuSize {
  width: number;
  height: number;
}

/**
 * Where a menu of this size fits, given the pointer position.
 *
 * A menu that does not fit below the pointer opens upwards instead, with the
 * pointer on its bottom edge, and a menu that does not fit to the right
 * slides back inside the screen.
 */
export const placeMenu = (
  anchor: MenuAnchor,
  size: MenuSize,
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } => {
  const top =
    anchor.y + size.height > viewport.height - margin
      ? Math.max(margin, anchor.y - size.height)
      : anchor.y;

  const left = Math.max(
    margin,
    anchor.x + size.width > viewport.width - margin
      ? viewport.width - margin - size.width
      : anchor.x,
  );

  return { left, top };
};

/**
 * Keeps a pointer-anchored menu inside the viewport.
 *
 * The menu is measured after it renders, then moved so it never leaves the
 * screen: it opens upwards when there is no room below the pointer, and it
 * slides back from the edges of the screen. The first paint stays hidden, so
 * the menu never appears in the wrong place before it has been measured.
 */
export const useAnchoredMenu = (
  anchor: MenuAnchor | null,
  margin = 8,
): { ref: React.RefObject<HTMLDivElement | null>; style: CSSProperties } => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) {
      setStyle(null);
      return;
    }

    const place = () => {
      const { width, height } = el.getBoundingClientRect();
      const { left, top } = placeMenu(
        anchor,
        { width, height },
        { width: window.innerWidth, height: window.innerHeight },
        margin,
      );

      setStyle({ left, top, visibility: "visible" });
    };

    place();

    // The menu can grow (or shrink) after it opened: re-place it then.
    const observer = new ResizeObserver(place);
    observer.observe(el);
    window.addEventListener("resize", place);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [anchor?.x, anchor?.y, margin]);

  // Before the measurement the menu is hidden, at the pointer, so the first
  // paint cannot show it in the wrong place.
  const fallback: CSSProperties = anchor
    ? { left: anchor.x, top: anchor.y, visibility: "hidden" }
    : { visibility: "hidden" };

  return { ref, style: style ?? fallback };
};
