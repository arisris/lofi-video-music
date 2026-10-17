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
    const startWidth = side === "left" ? state.mediaPoolWidth : state.inspectorWidth;

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
      className={`hidden md:flex flex-none w-1 h-full bg-transparent hover:bg-blue-500/30 cursor-col-resize transition-all z-[100] items-center justify-center ${order} ${isResizing ? "bg-blue-500/50 w-1.5" : ""}`}
      onMouseDown={handleMouseDown}
    />
  );
};
