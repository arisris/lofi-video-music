import m from "mithril";
import { State } from "../lib/state";
import { runtime } from "../lib/runtime";
import { handleDragStart, getEventPos, findClipAtPos, findHandleAtPos } from "../lib/drag";
import { getSelectedClipInfo } from "../utils/helpers";

let isHoveringClip = false;

export const VideoPreview = {
  view() {
    const cursorStyle = State.canvasCursor || (
      State.interactionMode === "pan" 
        ? (State.isDragging ? "grabbing" : "grab") 
        : (isHoveringClip ? "move" : "default")
    );
    return m(
      "div",
      {
        class: "canvas-container flex-1 relative",
        style: { cursor: cursorStyle },
        onmousedown: handleDragStart,
        onmousemove: (e) => {
          if (State.interactionMode === 'select' && !State.isDragging) {
            const pos = getEventPos(e);
            
            // Check if there is a selected clip and we are hovering over its handles
            const selectedInfo = getSelectedClipInfo(State);
            let hoverCursor = null;
            if (selectedInfo) {
              const { settings, renderer } = selectedInfo;
              const w = runtime.canvas?.width;
              const h = runtime.canvas?.height;
              const bbox = renderer.getItemBoundingBox ? renderer.getItemBoundingBox(runtime.ctx, w, h, settings) : null;
              if (bbox) {
                const handle = findHandleAtPos(pos, bbox, settings);
                if (handle) {
                  if (handle === 'rotate') {
                    hoverCursor = 'crosshair';
                  } else if (handle === 'resize-tl' || handle === 'resize-br') {
                    hoverCursor = 'nwse-resize';
                  } else if (handle === 'resize-tr' || handle === 'resize-bl') {
                    hoverCursor = 'nesw-resize';
                  }
                }
              }
            }

            if (hoverCursor) {
              State.canvasCursor = hoverCursor;
              isHoveringClip = false;
            } else {
              const hit = findClipAtPos(pos);
              if (hit) {
                State.canvasCursor = 'move';
                isHoveringClip = true;
              } else {
                State.canvasCursor = null;
                isHoveringClip = false;
              }
            }
            m.redraw();
          }
        },
        ontouchstart: (e) => {
          e.preventDefault();
          handleDragStart(e);
        },
      },
      [
        m("canvas", {
          id: "renderCanvas",
          width: (() => {
            if (State.isRecording) {
              const res = State.recordResolution || "720p";
              if (State.aspectRatio === "16:9") {
                return res === "1080p" ? 1920 : (res === "1440p" ? 2560 : 1280);
              } else {
                return res === "1080p" ? 1080 : (res === "1440p" ? 1440 : 720);
              }
            } else {
              return State.aspectRatio === "16:9" ? 1280 : 720;
            }
          })(),
          height: (() => {
            if (State.isRecording) {
              const res = State.recordResolution || "720p";
              if (State.aspectRatio === "16:9") {
                return res === "1080p" ? 1080 : (res === "1440p" ? 1440 : 720);
              } else {
                return res === "1080p" ? 1920 : (res === "1440p" ? 2560 : 1280);
              }
            } else {
              return State.aspectRatio === "16:9" ? 720 : 1280;
            }
          })(),
        }),

        // Recording Indicator
        m(
          "div",
          {
            class: `absolute top-4 left-4 flex items-center gap-2 bg-black/60 text-red-500 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm border border-red-500/30 pointer-events-none ${State.isRecording ? "" : "hidden"}`,
          },
          [
            m("div", {
              class: "w-3 h-3 rounded-full bg-red-500 animate-pulse",
            }),
            "Recording... ",
            m(
              "span",
              { class: "text-white ml-1 font-mono" },
              State.recordingTime,
            ),
          ],
        ),

        // Interaction Tooltip Hint
        m(
          "div",
          {
            class: `absolute bottom-4 right-4 bg-black/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs backdrop-blur-sm border border-slate-600/50 pointer-events-none transition-opacity duration-1000 ${State.dragHintVisible ? "opacity-100" : "opacity-0"}`,
          },
          [
            m("i", {
              class: `${State.interactionMode === 'pan' ? 'icon-[ri--drag-move-line]' : 'icon-[ri--cursor-fill]'} inline w-3 h-3 mr-1`,
            }),
            State.interactionMode === 'pan' ? "Drag background" : "Click clips to edit",
          ],
        ),
      ],
    );
  },
};
