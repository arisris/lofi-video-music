import { useEffect, useRef, useState } from "react";
import {
  defaultPanelWidth,
  defaultTimelineHeight,
  useEditorStore,
} from "../../store/editor-store";

interface ResizerProps {
  side: "left" | "right" | "top" | "bottom";
  /** Called with the new width/height while dragging (clamped). */
  onResize: (size: number) => void;
  /** Extra tailwind classes for responsive ordering. */
  order?: string;
  /** Notifies parent when a drag starts/ends (to freeze transitions). */
  onDragStateChange?: (dragging: boolean) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 800;
/** A panel must not take more than 38% of the viewport so the center fits. */
const MAX_VIEWPORT_SHARE = 0.38;

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
/** Timeline must not take more than 50% of the viewport height. */
const MAX_VIEWPORT_SHARE_H = 0.5;

/** Draggable handle that resizes side panels (horizontal) or timeline (vertical). */
export const Resizer = ({ side, onResize, order = "", onDragStateChange }: ResizerProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const drag = useRef<{
    startX: number;
    startY: number;
    startSize: number;
    maxSize: number;
  } | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  const isVertical = side === "top" || side === "bottom";

  // Safety: if the parent unmounts (panel collapse) mid-drag, end cleanly.
  useEffect(() => {
    return () => {
      if (drag.current) {
        drag.current = null;
        document.body.style.cursor = "default";
        onDragStateChangeRef.current?.(false);
      }
    };
  }, []);

  const endDrag = (restoreSize?: number) => {
    if (!drag.current) return;
    if (restoreSize !== undefined) onResizeRef.current(restoreSize);
    drag.current = null;
    setIsResizing(false);
    onDragStateChangeRef.current?.(false);
    document.body.style.cursor = "default";
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const state = useEditorStore.getState();
    if (isVertical) {
      const startSize = state.timelineHeight;
      const maxSize = Math.max(
        MIN_HEIGHT + 40,
        Math.min(MAX_HEIGHT, Math.floor(window.innerHeight * MAX_VIEWPORT_SHARE_H)),
      );
      drag.current = { startX: e.clientX, startY: e.clientY, startSize, maxSize };
      setIsResizing(true);
      onDragStateChange?.(true);
      document.body.style.cursor = "row-resize";
    } else {
      const startSize = side === "left" ? state.mediaPoolWidth : state.inspectorWidth;
      const maxSize = Math.max(
        MIN_WIDTH + 40,
        Math.min(MAX_WIDTH, Math.floor(window.innerWidth * MAX_VIEWPORT_SHARE)),
      );
      drag.current = { startX: e.clientX, startY: e.clientY, startSize, maxSize };
      setIsResizing(true);
      onDragStateChange?.(true);
      document.body.style.cursor = "col-resize";
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (isVertical) {
      const dy = e.clientY - d.startY;
      // Handle sits on the top edge of the timeline: drag up enlarges.
      const newSize = side === "top" ? d.startSize - dy : d.startSize + dy;
      onResizeRef.current(Math.max(MIN_HEIGHT, Math.min(d.maxSize, newSize)));
    } else {
      const dx = e.clientX - d.startX;
      const newSize = side === "left" ? d.startSize + dx : d.startSize - dx;
      onResizeRef.current(Math.max(MIN_WIDTH, Math.min(d.maxSize, newSize)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape cancels the drag and restores the pre-drag size.
    if (e.key === "Escape" && drag.current) {
      endDrag(drag.current.startSize);
    }
  };

  const handleDoubleClick = () => {
    onResize(isVertical ? defaultTimelineHeight() : defaultPanelWidth(side));
  };

  if (isVertical) {
    return (
      <div
        className={`group z-100 flex h-2 w-full flex-none cursor-row-resize touch-none flex-col items-center justify-center bg-transparent select-none ${order}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => endDrag()}
        onPointerCancel={() => endDrag()}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize • Double-click to reset"
      >
        <div
          className={`h-px w-full transition-colors group-hover:bg-blue-500/40 ${isResizing ? "bg-blue-500/60" : "bg-transparent"}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`group z-100 hidden w-2 flex-none cursor-col-resize touch-none items-stretch justify-center bg-transparent select-none md:flex ${order}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => endDrag()}
      onPointerCancel={() => endDrag()}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize • Double-click to reset"
    >
      <div
        className={`w-px transition-colors group-hover:bg-blue-500/40 ${isResizing ? "bg-blue-500/60" : "bg-transparent"}`}
      />
    </div>
  );
};
