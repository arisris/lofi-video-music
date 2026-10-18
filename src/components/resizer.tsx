import { useState } from "react";
import { editorStore } from "../store/editor-store";

interface ResizerProps {
  side: "left" | "right";
  /** Called with the new width while dragging (clamped 200–800). */
  onResize: (width: number) => void;
  /** Extra tailwind classes for responsive ordering. */
  order?: string;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 800;

/** Draggable handle that resizes the media pool / inspector side panels. */
export const Resizer = ({ side, onResize, order = "" }: ResizerProps) => {
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const state = editorStore.getState();
    const startWidth =
      side === "left" ? state.mediaPoolWidth : state.inspectorWidth;

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const newWidth = side === "left" ? startWidth + dx : startWidth - dx;
      onResize(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
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
      className={`z-100 hidden h-full w-1 flex-none cursor-col-resize items-center justify-center bg-transparent transition-all hover:bg-blue-500/30 md:flex ${order} ${isResizing ? "w-1.5 bg-blue-500/50" : ""}`}
      onMouseDown={handleMouseDown}
    />
  );
};
