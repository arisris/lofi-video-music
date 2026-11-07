import { useState } from "react";
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    onDragStateChange?.(true);
    const startX = e.clientX;
    const state = useEditorStore.getState();
    const startWidth =
      side === "left" ? state.mediaPoolWidth : state.inspectorWidth;
    const maxWidth = Math.max(
      MIN_WIDTH + 40,
      Math.min(MAX_WIDTH, Math.floor(window.innerWidth * MAX_VIEWPORT_SHARE)),
    );

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const newWidth = side === "left" ? startWidth + dx : startWidth - dx;
      onResize(Math.max(MIN_WIDTH, Math.min(maxWidth, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      onDragStateChange?.(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  };

  return (
    <div
      className={`group z-100 hidden w-2 flex-none cursor-col-resize touch-none items-stretch justify-center bg-transparent select-none md:flex ${order}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onResize(defaultPanelWidth(side))}
      title="Drag to resize • Double-click to reset"
    >
      <div
        className={`w-px transition-colors group-hover:bg-blue-500/40 ${isResizing ? "bg-blue-500/60" : "bg-transparent"}`}
      />
    </div>
  );
};
