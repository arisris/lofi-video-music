import { useEffect, useState } from "react";
import { designSize, recordSize, toDesignPos } from "../../shared/lib/canvas-space";
import { runtime, bindAudioElement } from "../../shared/lib/runtime";
import { renderFrame } from "../../engine/render-loop";
import {
  findClipAtPos,
  findHandleAtPos,
  getEventPos,
  getSelectedCanvasClip,
  handleCanvasDragStart,
  type DragPointerEvent,
} from "./canvas-drag";
import {
  applyAudioSettings,
  clipsForAudio,
} from "../audio/audio-engine";
import { getTotalDuration, useEditorStore } from "../../store/editor-store";
import { stopRecording } from "../recorder/recorder";
import { ClipContextMenu } from "./ClipContextMenu";

let isHoveringClip = false;

const toAbsoluteUrl = (url: string): string => {
  if (!url) return "";
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

/** Canvas preview area: render target + interaksi drag/transform clip. */
export function VideoPreview() {
  const canvasCursor = useEditorStore((s) => s.canvasCursor);
  const interactionMode = useEditorStore((s) => s.interactionMode);
  const isDraggingCanvas = useEditorStore((s) => s.isDragging);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recordingTime = useEditorStore((s) => s.recordingTime);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const recordResolution = useEditorStore((s) => s.recordResolution);
  const [menu, setMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

  // Close the menu once its clip is gone (e.g. deleted via shortcut/undo).
  useEffect(() => {
    if (!menu) return;
    const st = useEditorStore.getState();
    if (!st.clips.some((c) => c.id === menu.clipId)) setMenu(null);
  });

  // Backing store follows orientation + resolution while recording, same
  // as the legacy app. Outside
  // recording the backing store is the preview design space.
  const { w: width, h: height } = isRecording
    ? recordSize(aspectRatio, recordResolution)
    : designSize(aspectRatio);

  const cursorStyle =
    canvasCursor ||
    (interactionMode === "pan"
      ? isDraggingCanvas
        ? "grabbing"
        : "grab"
      : isHoveringClip
        ? "move"
        : "default");

  const handleMouseMove = (e: React.MouseEvent) => {
    const state = useEditorStore.getState();
    if (state.interactionMode !== "select" || state.isDragging) return;

    const canvas = runtime.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pos = toDesignPos(
      ((e.clientX - rect.left) * canvas.width) / (rect.width || 1),
      ((e.clientY - rect.top) * canvas.height) / (rect.height || 1),
    );

    const selectedInfo = getSelectedCanvasClip();
    let hoverCursor: string | null = null;
    if (selectedInfo) {
      const handle = findHandleAtPos(pos, selectedInfo.bbox, selectedInfo.settings);
      if (handle === "rotate") hoverCursor = "crosshair";
      else if (handle === "resize-tl" || handle === "resize-br") hoverCursor = "nwse-resize";
      else if (handle === "resize-tr" || handle === "resize-bl") hoverCursor = "nesw-resize";
    }

    if (hoverCursor) {
      if (canvasCursor !== hoverCursor) useEditorStore.setState({ canvasCursor: hoverCursor });
      isHoveringClip = false;
    } else {
      const hit = findClipAtPos(pos);
      const next = hit ? "move" : null;
      if (canvasCursor !== next) useEditorStore.setState({ canvasCursor: next });
      isHoveringClip = !!hit;
    }
  };

  useEffect(() => {
    const canvas = document.getElementById(
      "renderCanvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    runtime.canvas = canvas;
    runtime.ctx = ctx;
    // Bind hidden audio element for the audio engine (re-wires the graph
    // if the engine already created a source for a different element).
    const domAudio = document.getElementById(
      "audioElement",
    ) as HTMLAudioElement | null;
    if (domAudio) bindAudioElement(domAudio);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st = useEditorStore.getState();
      const dt = (now - last) / 1000;
      if (st.playing) {
        // Audio is the master clock when the
        // active clip matches; otherwise advance with dt; stop at the total.
        const list = clipsForAudio();
        const activeClip = list.find(
          (c) =>
            c.type === "music" &&
            (c.settings.enabled as boolean | undefined) !== false &&
            st.currentTime >= c.start &&
            st.currentTime <= c.start + c.duration,
        );
        const audioEl = runtime.audioEl;
        if (activeClip && audioEl) {
          const targetSrc = activeClip.settings.audioUrl as string | undefined;
          if (targetSrc && toAbsoluteUrl(audioEl.src) !== toAbsoluteUrl(targetSrc)) {
            audioEl.src = targetSrc;
            applyAudioSettings(activeClip);
            const onLoaded = () => {
              const t =
                useEditorStore.getState().currentTime -
                activeClip.start +
                ((activeClip.settings.startOffset as number) || 0);
              if (t < ((activeClip.settings.audioDuration as number) || activeClip.duration)) {
                try {
                  audioEl.currentTime = t;
                } catch { /* noop */ }
                applyAudioSettings(activeClip);
                if (st.playing) void audioEl.play().catch(() => {});
              }
            };
            audioEl.addEventListener("loadedmetadata", onLoaded, { once: true });
            st.setTime(st.currentTime + dt);
          } else if (!audioEl.paused) {
            const localTime =
              audioEl.currentTime - ((activeClip.settings.startOffset as number) || 0);
            st.setTime(activeClip.start + localTime);
          } else {
            st.setTime(st.currentTime + dt);
          }
        } else {
          if (audioEl && !audioEl.paused) audioEl.pause();
          st.setTime(st.currentTime + dt);
        }

        const live = useEditorStore.getState();
        const totalDur = getTotalDuration(live.clips);
        const stopAt = live.recordingTargetEnd ?? totalDur;
        if (live.currentTime >= stopAt) {
          live.setTime(stopAt);
          live.setPlaying(false);
          if (runtime.audioEl) runtime.audioEl.pause();
          if (live.isRecording) stopRecording();
        }
      }
      last = now;
      renderFrame(ctx, useEditorStore.getState().currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="canvas-container relative flex-1"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleCanvasDragStart as unknown as React.MouseEventHandler}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = getEventPos({ clientX: e.clientX, clientY: e.clientY });
        const hit = findClipAtPos(pos);
        const st = useEditorStore.getState();
        let clipId: string | null = null;
        if (hit && !hit.isGlobalLyrics && hit.clip) {
          clipId = hit.clip.id;
          useEditorStore.setState({
            selectedClipId: hit.clip.id,
            selectedTransitionClipId: null,
          });
        } else if (
          st.selectedClipId &&
          st.selectedClipId !== "lyrics" &&
          st.clips.some((c) => c.id === st.selectedClipId)
        ) {
          clipId = st.selectedClipId;
        }
        if (!clipId) return;
        setMenu({ x: e.clientX, y: e.clientY, clipId });
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        handleCanvasDragStart(e as unknown as DragPointerEvent);
      }}
    >
      <canvas
        id="renderCanvas"
        width={width}
        height={height}
        style={{
          aspectRatio: aspectRatio === "16:9" ? "16 / 9" : "9 / 16",
          maxHeight: "100%",
          maxWidth: "100%",
          width: "auto",
          height: "100%",
          objectFit: "contain",
        }}
      />

      {/* Recording Indicator */}
      <div
        className={`pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full border border-red-500/30 bg-black/60 px-3 py-1.5 text-sm font-medium text-red-500 backdrop-blur-sm ${isRecording ? "" : "hidden"}`}
      >
        <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
        Recording...{" "}
        <span className="ml-1 font-mono text-white">{recordingTime}</span>
      </div>

      {menu && (
        <ClipContextMenu x={menu.x} y={menu.y} clipId={menu.clipId} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
