import { useEffect, useRef, useState } from "react";
import { defaultPanelWidth, useEditorStore } from "../../store/editor-store";

interface ResizerProps {
  side: "left" | "right";
  /** Called with the new width while dragging (clamped). */
  onResize: (width: number) => void;
  /** Extra tailwind classes for responsive ordering. */
  order?: string;
  /** Notifies parent when a drag starts/ends (to freeze width transitions). */
  onDragStateChange?: (dragging: boolean) => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 800;
/** A panel must not take more than 38% of the viewport so the center fits. */
const MAX_VIEWPORT_SHARE = 0.38;

/** Draggable handle that resizes the media pool / inspector side panels. */
export const Resizer = ({ side, onResize, order = "", onDragStateChange }: ResizerProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number; maxWidth: number } | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

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

  const endDrag = (restoreWidth?: number) => {
    if (!drag.current) return;
    if (restoreWidth !== undefined) onResizeRef.current(restoreWidth);
    drag.current = null;
    setIsResizing(false);
    onDragStateChangeRef.current?.(false);
    document.body.style.cursor = "default";
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const state = useEditorStore.getState();
    const startWidth = side === "left" ? state.mediaPoolWidth : state.inspectorWidth;
    const maxWidth = Math.max(
      MIN_WIDTH + 40,
      Math.min(MAX_WIDTH, Math.floor(window.innerWidth * MAX_VIEWPORT_SHARE)),
    );
    drag.current = { startX: e.clientX, startWidth, maxWidth };
    setIsResizing(true);
    onDragStateChange?.(true);
    document.body.style.cursor = "col-resize";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const newWidth = side === "left" ? d.startWidth + dx : d.startWidth - dx;
    onResize(Math.max(MIN_WIDTH, Math.min(d.maxWidth, newWidth)));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape cancels the drag and restores the pre-drag width.
    if (e.key === "Escape" && drag.current) {
      endDrag(drag.current.startWidth);
    }
  };

  return (
    <div
      className={`group z-100 hidden w-2 flex-none cursor-col-resize touch-none items-stretch justify-center bg-transparent select-none md:flex ${order}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => endDrag()}
      onPointerCancel={() => endDrag()}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onResize(defaultPanelWidth(side))}
      title="Drag to resize • Double-click to reset"
    >
      <div
        className={`w-px transition-colors group-hover:bg-blue-500/40 ${isResizing ? "bg-blue-500/60" : "bg-transparent"}`}
      />
    </div>
  );
};
