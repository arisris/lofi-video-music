import { editorStore } from "../store/editor-store";
import { runtime } from "./runtime";
import { formatTime } from "../utils/helpers";
import { bumpClips } from "../store/actions/timeline-actions";
import { initAudioEngine, playAudio, pauseAudio } from "./audio";
import { getDesignSize, recordSize } from "./canvas-space";
import type { RecordResolution } from "../store/slices/recording";

export const startRecording = (mode: "timeline" | "clip" = "timeline") => {
  initAudioEngine();
  if (runtime.audioCtx.state === "suspended") {
    runtime.audioCtx.resume().catch((e) => console.warn(e));
  }

  const state = editorStore.getState();
  const oldSnaps = state.canvasSnaps || [];

  let activeClip = null;
  if (mode === "clip") {
    activeClip = state.timelineClips.find(
      (c: any) =>
        c.type === "music" &&
        c.settings?.enabled !== false &&
        state.currentTime >= c.start &&
        state.currentTime <= c.start + c.duration,
    ) as any;
    if (!activeClip) {
      alert("Please place the playhead over a music clip first to record it.");
      return;
    }

    editorStore.setState({
      recordingTargetClipEnd: activeClip.start + activeClip.duration,
      currentTime: activeClip.start,
    });
  } else {
    editorStore.setState({ currentTime: 0 });
  }

  editorStore.setState({ recordingMode: mode });
  runtime.recordedChunks = [];

  // Grow the backing store to the selected resolution before capture. The
  // render loop keeps laying clips out in design space and scales the frame up
  // to fill this size, so the recording matches the preview instead of
  // shrinking every clip into a bigger canvas.
  const resolution = state.recordResolution || "720p";
  const target = recordSize(
    state.aspectRatio || "16:9",
    resolution as RecordResolution,
  );
  if (runtime.canvas) {
    runtime.canvas.width = target.w;
    runtime.canvas.height = target.h;
  }

  const fps = state.recordFps || 30;
  const canvasStream = runtime.canvas!.captureStream(fps);
  const audioStream = runtime.dest.stream;
  const tracks = [...canvasStream.getTracks(), ...audioStream.getTracks()];
  const combinedStream = new MediaStream(tracks);

  let options = { mimeType: "video/webm; codecs=vp9,opus" };
  if (!MediaRecorder.isTypeSupported(options.mimeType))
    options = { mimeType: "video/webm" };
  if (
    !MediaRecorder.isTypeSupported(options.mimeType) &&
    MediaRecorder.isTypeSupported("video/mp4")
  )
    options = { mimeType: "video/mp4" };

  try {
    runtime.mediaRecorder = new MediaRecorder(combinedStream, options);
  } catch (e) {
    alert("Recording is not supported in your browser.");
    return;
  }

  runtime.mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      runtime.recordedChunks.push(e.data);
    }
  };

  runtime.mediaRecorder.onstop = () => {
    if (runtime.recordedChunks.length === 0) {
      console.warn("No data recorded.");
      return;
    }

    const blob = new Blob(runtime.recordedChunks, {
      type: options.mimeType.split(";")[0],
    });

    const ext = options.mimeType.includes("mp4") ? "mp4" : "webm";
    const duration = Date.now() - editorStore.getState().recordStartTime;

    const processDownload = (finalBlob: Blob) => {
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      const timestamp = new Date().getTime();

      let fileName = "";
      if (mode === "clip" && activeClip) {
        const trackName = activeClip.settings?.name || "lofi";
        fileName = `MusicVideo_${trackName.replace(/\s+/g, "_")}_${timestamp}.${ext}`;
      } else {
        fileName = `MusicVideo_FullTimeline_${timestamp}.${ext}`;
      }

      a.download = fileName;

      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        editorStore.setState({ canvasSnaps: oldSnaps });
        bumpClips();
      }, 200);
    };

    if (ext === "webm") {
      import("fix-webm-duration")
        .then(({ default: fixWebmDuration }) => {
          fixWebmDuration(blob, duration, (fixedBlob) => {
            processDownload(fixedBlob);
          });
        })
        .catch((err) => {
          console.warn(
            "Failed to load fix-webm-duration, downloading raw file:",
            err,
          );
          processDownload(blob);
        });
    } else {
      processDownload(blob);
    }
  };

  runtime.mediaRecorder.start(100); // Record in 100ms chunks to prevent loss on stop
  const now = Date.now();
  editorStore.setState({ isRecording: true, recordStartTime: now });
  const updateTimer = () => {
    const live = editorStore.getState();
    if (!live.isRecording) return;
    const diff = Math.floor((Date.now() - live.recordStartTime) / 1000);
    editorStore.setState({ recordingTime: formatTime(diff) });
    bumpClips();
    setTimeout(updateTimer, 1000);
  };
  updateTimer();
  if (!editorStore.getState().isPlaying) playAudio();
  bumpClips();
};

export const stopRecording = () => {
  if (runtime.mediaRecorder && runtime.mediaRecorder.state !== "inactive") {
    runtime.mediaRecorder.stop();
  }
  editorStore.setState({ isRecording: false });
  pauseAudio();

  // Restore canvas dimensions to standard preview resolution
  if (runtime.canvas) {
    const preview = getDesignSize();
    runtime.canvas.width = preview.w;
    runtime.canvas.height = preview.h;
  }

  bumpClips();
};
