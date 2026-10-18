import { handleDragStart, getEventPos, findClipAtPos, findHandleAtPos, DragPointerEvent } from "../lib/drag";
import { getSelectedClipInfo } from "../utils/helpers";
import { runtime } from "../lib/runtime";
import { editorStore, useEditorStore } from "../store/editor-store";

let isHoveringClip = false;

const resolutionWidth = (aspectRatio: string, res: string): number => {
  if (aspectRatio === "16:9") return res === "1080p" ? 1920 : res === "1440p" ? 2560 : 1280;
  return res === "1080p" ? 1080 : res === "1440p" ? 1440 : 720;
};

const resolutionHeight = (aspectRatio: string, res: string): number => {
  if (aspectRatio === "16:9") return res === "1080p" ? 1080 : res === "1440p" ? 1440 : 720;
  return res === "1080p" ? 1080 : res === "1440p" ? 1440 : 1280;
};

/** Canvas preview area: render target + clip interaction surface. */
export const VideoPreview = () => {
  const canvasCursor = useEditorStore((s) => s.canvasCursor);
  const interactionMode = useEditorStore((s) => s.interactionMode);
  const isDragging = useEditorStore((s) => s.isDragging);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recordResolution = useEditorStore((s) => s.recordResolution);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const recordingTime = useEditorStore((s) => s.recordingTime);
  const dragHintVisible = useEditorStore((s) => s.dragHintVisible);

  const cursorStyle =
    canvasCursor ||
    (interactionMode === "pan"
      ? isDragging
        ? "grabbing"
        : "grab"
      : isHoveringClip
        ? "move"
        : "default");

  const width = isRecording ? resolutionWidth(aspectRatio, recordResolution || "720p") : aspectRatio === "16:9" ? 1280 : 720;
  const height = isRecording ? resolutionHeight(aspectRatio, recordResolution || "720p") : aspectRatio === "16:9" ? 720 : 1280;

  const handleMouseMove = (e: React.MouseEvent) => {
    const state = editorStore.getState();
    if (state.interactionMode !== "select" || state.isDragging) return;

    const pos = getEventPos(e);

    // Check if there is a selected clip and we are hovering over its handles
    const selectedInfo = getSelectedClipInfo(state) as any;
    let hoverCursor: string | null = null;
    if (selectedInfo) {
      const { settings, renderer } = selectedInfo;
      const w = runtime.canvas?.width;
      const h = runtime.canvas?.height;
      const bbox = renderer.getItemBoundingBox ? renderer.getItemBoundingBox(runtime.ctx, w, h, settings) : null;
      if (bbox) {
        const handle = findHandleAtPos(pos, bbox, settings);
        if (handle === "rotate") hoverCursor = "crosshair";
        else if (handle === "resize-tl" || handle === "resize-br") hoverCursor = "nwse-resize";
        else if (handle === "resize-tr" || handle === "resize-bl") hoverCursor = "nesw-resize";
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
      className="canvas-container flex-1 relative"
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
        className={`absolute top-4 left-4 flex items-center gap-2 bg-black/60 text-red-500 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm border border-red-500/30 pointer-events-none ${isRecording ? "" : "hidden"}`}
      >
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        Recording... <span className="text-white ml-1 font-mono">{recordingTime}</span>
      </div>

      {/* Interaction Tooltip Hint */}
      <div
        className={`absolute bottom-4 right-4 bg-black/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs backdrop-blur-sm border border-slate-600/50 pointer-events-none transition-opacity duration-1000 ${dragHintVisible ? "opacity-100" : "opacity-0"}`}
      >
        <i
          className={`${interactionMode === "pan" ? "icon-[ri--drag-move-line]" : "icon-[ri--cursor-fill]"} inline w-3 h-3 mr-1`}
        />
        {interactionMode === "pan" ? "Drag background" : "Click clips to edit"}
      </div>
    </div>
  );
};
