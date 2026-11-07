import { useEffect } from "react";
import { designSize, recordSize, toDesignPos } from "../../shared/lib/canvas-space";
import { runtime } from "../../shared/lib/runtime";
import { renderFrame } from "../../engine/render-loop";
import {
  findClipAtPos,
  findHandleAtPos,
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

let isHoveringClip = false;

/** Canvas preview area: render target + interaksi drag/transform clip. */
export function VideoPreview() {
  const canvasCursor = useEditorStore((s) => s.canvasCursor);
  const interactionMode = useEditorStore((s) => s.interactionMode);
  const isDraggingCanvas = useEditorStore((s) => s.isDragging);
  const isRecording = useEditorStore((s) => s.isRecording);
  const recordingTime = useEditorStore((s) => s.recordingTime);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const recordResolution = useEditorStore((s) => s.recordResolution);

  // Backing store follows orientation + resolution while recording, same
  // as the legacy app (src_old/components/video-preview.tsx). Outside
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
      useEditorStore.setState({ canvasCursor: hoverCursor });
      isHoveringClip = false;
    } else {
      const hit = findClipAtPos(pos);
      useEditorStore.setState({ canvasCursor: hit ? "move" : null });
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
    // Bind hidden audio element for the audio engine.
    runtime.audioEl = document.getElementById(
      "audioElement",
    ) as HTMLAudioElement | null;
    let raf = 0;
    let last = performance.now();
    const toAbsoluteUrl = (url: string): string => {
      if (!url) return "";
      try {
        return new URL(url, window.location.href).href;
      } catch {
        return url;
      }
    };
    const tick = (now: number) => {
      const st = useEditorStore.getState();
      const dt = (now - last) / 1000;
      if (st.playing) {
        // Mirror src_old/lib/render.ts: audio is the master clock when the
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
              audioEl.removeEventListener("loadedmetadata", onLoaded);
            };
            audioEl.addEventListener("loadedmetadata", onLoaded);
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
    </div>
  );
}
