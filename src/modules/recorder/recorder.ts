// Canvas+audio recorder — adapted from src_old/lib/recorder.ts.
// No canvasSnaps/bumpClips. "clip" mode: start from the beginning of the active music
// clip under the playhead and auto-stop at the end of that clip.
import { getDesignSize, recordSize } from "../../shared/lib/canvas-space";
import { formatTime } from "../../shared/lib/format";
import { runtime } from "../../shared/lib/runtime";
import {
  activeMusicClipIn,
  clipsForAudio,
  initAudioEngine,
  pauseAudio,
  playAudio,
} from "../audio/audio-engine";
import { useEditorStore } from "../../store/editor-store";

export const startRecording = (mode?: "timeline" | "clip") => {
  initAudioEngine();
  if (runtime.audioCtx && runtime.audioCtx.state === "suspended") {
    void runtime.audioCtx.resume().catch(() => {});
  }
  const st = useEditorStore.getState();
  const recordMode = mode ?? st.pendingRecordMode;
  // Clip mode (mirrors src_old/lib/recorder.ts): start from the beginning of the active
  // music clip under the playhead and stop automatically at the end of that clip.
  let startAt = 0;
  let targetEnd: number | null = null;
  if (recordMode === "clip") {
    const active = activeMusicClipIn(clipsForAudio(), st.currentTime);
    if (!active) {
      alert("Place the playhead over a music clip first to record it.");
      return;
    }
    startAt = active.start;
    targetEnd = active.start + active.duration;
  }
  st.setTime(startAt);
  useEditorStore.setState({ recordingTargetEnd: targetEnd });
  runtime.recordedChunks = [];

  const target = recordSize(st.aspectRatio || "16:9", st.recordResolution);
  if (runtime.canvas) {
    runtime.canvas.width = target.w;
    runtime.canvas.height = target.h;
  }
  if (!runtime.canvas || !runtime.dest) return;

  const fps = st.recordFps || 30;
  const canvasStream = runtime.canvas.captureStream(fps);
  const combined = new MediaStream([
    ...canvasStream.getTracks(),
    ...runtime.dest.stream.getTracks(),
  ]);

  let mimeType = "video/webm; codecs=vp9,opus";
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "video/webm";
  if (!MediaRecorder.isTypeSupported(mimeType) && MediaRecorder.isTypeSupported("video/mp4")) {
    mimeType = "video/mp4";
  }

  try {
    runtime.mediaRecorder = new MediaRecorder(combined, { mimeType });
  } catch {
    alert("Recording is not supported in your browser.");
    return;
  }

  runtime.mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) runtime.recordedChunks.push(e.data);
  };
  runtime.mediaRecorder.onstop = () => {
    if (runtime.recordedChunks.length === 0) return;
    const blob = new Blob(runtime.recordedChunks, { type: mimeType.split(";")[0] });
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const elapsed = Date.now() - useEditorStore.getState().recordStartTime;
    const finish = (finalBlob: Blob) => {
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `MusicVideo_${recordMode === "clip" ? "Track" : "FullTimeline"}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
    };
    if (ext === "webm") {
      import("fix-webm-duration")
        .then(({ default: fixWebmDuration }) => {
          fixWebmDuration(blob, elapsed, finish);
        })
        .catch(() => finish(blob));
    } else {
      finish(blob);
    }
  };

  runtime.mediaRecorder.start(100);
  st.setRecording(true, Date.now());
  const tick = () => {
    const live = useEditorStore.getState();
    if (!live.isRecording) return;
    live.setRecordingTime(formatTime(Math.floor((Date.now() - live.recordStartTime) / 1000)));
    setTimeout(tick, 1000);
  };
  tick();
  if (!st.playing) playAudio();
};

export const stopRecording = () => {
  if (runtime.mediaRecorder && runtime.mediaRecorder.state !== "inactive") {
    runtime.mediaRecorder.stop();
  }
  useEditorStore.setState({ recordingTargetEnd: null });
  useEditorStore.getState().setRecording(false);
  pauseAudio();
  if (runtime.canvas) {
    const preview = getDesignSize();
    runtime.canvas.width = preview.w;
    runtime.canvas.height = preview.h;
  }
};
