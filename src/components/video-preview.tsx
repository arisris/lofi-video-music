import {
  handleDragStart,
  getEventPos,
  findClipAtPos,
  findHandleAtPos,
  DragPointerEvent,
} from "../lib/drag";
import { designSize, getDesignSize, recordSize } from "../lib/canvas-space";
import type { RecordResolution } from "../store/slices/recording";
import { getSelectedClipInfo } from "../utils/helpers";
import { runtime } from "../lib/runtime";
import { editorStore, useEditorStore } from "../store/editor-store";

let isHoveringClip = false;

/** Canvas preview area: render target + clip interaction surface. */
export const VideoPreview = () => {
  const canvasCursor = useEditorStore((s) => s.canvasCursor);
  const interactionMode = useEditorStore((s) => s.interactionMode);
  const isDragging = useEditorStore((s) => s.isDragging);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recordResolution = useEditorStore((s) => s.recordResolution);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const recordingTime = useEditorStore((s) => s.recordingTime);

  const cursorStyle =
    canvasCursor ||
    (interactionMode === "pan"
      ? isDragging
        ? "grabbing"
        : "grab"
      : isHoveringClip
        ? "move"
        : "default");

  // The backing store only grows while recording; the frame itself is drawn in
  // design space, so the visible layout never changes with the record size.
  const { w: width, h: height } = isRecording
    ? recordSize(aspectRatio, (recordResolution || "720p") as RecordResolution)
    : designSize(aspectRatio);

  const handleMouseMove = (e: React.MouseEvent) => {
    const state = editorStore.getState();
    if (state.interactionMode !== "select" || state.isDragging) return;

    const pos = getEventPos(e);

    // Check if there is a selected clip and we are hovering over its handles
    const selectedInfo = getSelectedClipInfo(state) as any;
    let hoverCursor: string | null = null;
    if (selectedInfo) {
      const { settings, renderer } = selectedInfo;
      const { w, h } = getDesignSize();
      const bbox = renderer.getItemBoundingBox
        ? renderer.getItemBoundingBox(runtime.ctx, w, h, settings)
        : null;
      if (bbox) {
        const handle = findHandleAtPos(pos, bbox, settings);
        if (handle === "rotate") hoverCursor = "crosshair";
        else if (handle === "resize-tl" || handle === "resize-br")
          hoverCursor = "nwse-resize";
        else if (handle === "resize-tr" || handle === "resize-bl")
          hoverCursor = "nesw-resize";
      }
    }

    if (hoverCursor) {
      editorStore.setState({ canvasCursor: hoverCursor });
      isHoveringClip = false;
    } else {
      const hit = findClipAtPos(pos);
      editorStore.setState({ canvasCursor: hit ? "move" : null });
      isHoveringClip = !!hit;
    }
  };

  return (
    <div
      className="canvas-container relative flex-1"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleDragStart as unknown as React.MouseEventHandler}
      onMouseMove={handleMouseMove}
      onTouchStart={(e) => {
        e.preventDefault();
        handleDragStart(e as unknown as DragPointerEvent);
      }}
    >
      <canvas id="renderCanvas" width={width} height={height} />

      {/* Recording Indicator */}
      <div
        className={`pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full border border-red-500/30 bg-black/60 px-3 py-1.5 text-sm font-medium text-red-500 backdrop-blur-sm ${isRecording ? "" : "hidden"}`}
      >
        <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
        Recording...{" "}
        <span className="ml-1 font-mono text-white">{recordingTime}</span>
      </div>
    </div>
  );
};
