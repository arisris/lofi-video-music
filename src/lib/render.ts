import { editorStore } from "../store/editor-store";
import { runtime } from "./runtime";
import { ClipRegistry } from "./clips/index";
import { applyClipAnimations } from "./animations";
import { drawBackground } from "./clips/draw-bg";
import {
  getGlobalTime,
  getTotalDuration,
  getClipsToSearch,
  transformPoint,
  getSelectedClipInfo,
} from "../utils/helpers";
import { manageVideoPlayback } from "./video-playback";
import { applyAudioSettings } from "./audio";
import { stopRecording } from "./recorder";

let lastTime = 0;

const drawWithTransform = (
  ctx: CanvasRenderingContext2D,
  settings: Record<string, any>,
  bbox: { x: number; y: number; width: number; height: number },
  drawFn: () => void,
  localTime = 0,
  duration = Infinity,
  clipType: string | null = null,
) => {
  const { x, y, scaleX, scaleY, rotation, originX, originY } = settings;
  ctx.save();

  const cx = bbox.x + bbox.width * (originX ?? 0.5);
  const cy = bbox.y + bbox.height * (originY ?? 0.5);

  ctx.translate(cx + (x || 0), cy + (y || 0));
  ctx.rotate(((rotation || 0) * Math.PI) / 180);
  ctx.scale(scaleX ?? 1, scaleY ?? 1);

  // Apply Animations
  applyClipAnimations(ctx, settings, localTime, duration, clipType);

  ctx.translate(-cx, -cy);

  drawFn();

  ctx.restore();
};

export const renderLoop = () => {
  if (!runtime.canvas) return;
  requestAnimationFrame(renderLoop);

  const now = performance.now();
  if (lastTime === 0) lastTime = now;
  let dt = (now - lastTime) / 1000;
  dt = Math.min(dt, 0.1);
  lastTime = now;

  const state = editorStore.getState();
  const clipsToSearch = getClipsToSearch(state);
  const bgClipsToSearch = clipsToSearch.filter(
    (c: any) => c.type === "background",
  );
  const musicClipsToSearch = clipsToSearch.filter(
    (c: any) => c.type === "music",
  );

  // Increment currentTime if playing
  if (state.isPlaying) {
    const activeClip = musicClipsToSearch.find(
      (c: any) =>
        c.type === "music" &&
        c.settings?.enabled !== false &&
        state.currentTime >= c.start &&
        state.currentTime <= c.start + c.duration,
    );

    if (activeClip && runtime.audioEl) {
      const audioEl = runtime.audioEl!;
      const getAbsoluteUrl = (url: string) => {
        if (!url) return "";
        try {
          return new URL(url, window.location.href).href;
        } catch (e) {
          return url;
        }
      };

      const currentAudioSrc = getAbsoluteUrl(audioEl.src);
      const targetAudioSrc = getAbsoluteUrl(activeClip.settings.audioUrl);

      if (currentAudioSrc !== targetAudioSrc) {
        // Change audio track to match the current active clip on timeline
        audioEl.src = activeClip.settings.audioUrl;
        applyAudioSettings(activeClip);

        const onLoaded = () => {
          const currentLocalTime =
            editorStore.getState().currentTime - activeClip.start;
          const currentPlayheadTime =
            currentLocalTime + (activeClip.settings.startOffset || 0);
          if (
            currentPlayheadTime <
            (activeClip.settings.audioDuration || activeClip.duration)
          ) {
            audioEl.currentTime = currentPlayheadTime;
            applyAudioSettings(activeClip);
            if (state.isPlaying) {
              audioEl.play().catch((e) => console.warn("Auto-play failed:", e));
            }
          }
          audioEl.removeEventListener("loadedmetadata", onLoaded);
        };
        audioEl.addEventListener("loadedmetadata", onLoaded);

        editorStore.setState({ currentTime: (state.currentTime || 0) + dt });
      } else {
        if (!audioEl.paused) {
          // Sync timeline currentTime to active audio clip elapsed time to avoid drift
          const localTime =
            audioEl.currentTime - (activeClip.settings.startOffset || 0);
          editorStore.setState({ currentTime: activeClip.start + localTime });
        } else {
          editorStore.setState({ currentTime: (state.currentTime || 0) + dt });
        }
      }
    } else {
      if (runtime.audioEl && !runtime.audioEl.paused) {
        runtime.audioEl.pause();
      }
      editorStore.setState({ currentTime: (state.currentTime || 0) + dt });
    }

    let shouldStop = false;
    const totalDur = getTotalDuration(clipsToSearch);

    const liveState = editorStore.getState();
    if (liveState.isRecording && liveState.recordingMode === "clip") {
      if (liveState.currentTime >= liveState.recordingTargetClipEnd) {
        editorStore.setState({ currentTime: liveState.recordingTargetClipEnd });
        shouldStop = true;
      }
    } else {
      if (liveState.currentTime >= totalDur) {
        editorStore.setState({ currentTime: totalDur });
        shouldStop = true;
      }
    }

    if (shouldStop) {
      editorStore.setState({ isPlaying: false });
      if (runtime.audioEl) runtime.audioEl.pause();
      if (editorStore.getState().isRecording) {
        stopRecording();
      }
    }
  }

  const ctx = runtime.ctx;
  if (!ctx) return;
  const w = runtime.canvas.width;
  const h = runtime.canvas.height;

  // Master timeline time
  const globalTime = getGlobalTime(state);

  // Manage video playback of all timeline clips

  clipsToSearch.forEach((clip: any) => {
    if (clip.type === "background") {
      manageVideoPlayback(clip, globalTime, {
        elementsKey: "bgElements",
        typeKey: "bgType",
        activeMargin: 0.5,
      });
    } else if (clip.type === "overlay") {
      manageVideoPlayback(clip, globalTime, {
        elementsKey: "mediaElements",
        typeKey: "mediaType",
        alwaysLoop: false,
      });
    }
  });

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  // Check active timeline background clips (with loaded media)
  const activeBgClips = bgClipsToSearch.filter(
    (clip: any) =>
      clip.type === "background" &&
      clip.settings.enabled !== false &&
      globalTime >= clip.start - 0.5 &&
      globalTime <= clip.start + clip.duration + 0.5 &&
      ((clip.settings.bgType === "image" && clip.settings.bgElement) ||
        (clip.settings.bgType === "video" && clip.settings.bgElements)),
  );

  // Sort background clips by start time so the newer clip is drawn on top during crossfades
  const activeBgClipsSorted = [...activeBgClips].sort(
    (a, b) => a.start - b.start,
  );

  const hasTimelineBgNow = activeBgClipsSorted.length > 0;
  let hasMediaNow = hasTimelineBgNow;

  if (!hasMediaNow) {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    const time = Date.now() * 0.001;
    gradient.addColorStop(0, `hsl(${(time * 10) % 360}, 50%, 15%)`);
    gradient.addColorStop(1, `hsl(${(time * 10 + 60) % 360}, 50%, 10%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  // Draw backgrounds (Timeline overrides default playlist track background)
  if (hasTimelineBgNow) {
    activeBgClipsSorted.forEach((clip: any) => {
      const localTime = globalTime - clip.start;
      let opacity = 1.0;

      // Calculate fade-in opacity if there is an adjacent preceding clip
      if (localTime >= -0.5 && localTime < 0.5) {
        const prevClip = bgClipsToSearch.find(
          (c: any) =>
            c.id !== clip.id &&
            c.type === "background" &&
            Math.abs(c.start + c.duration - clip.start) < 0.2,
        );
        if (prevClip) {
          opacity = Math.max(0, Math.min(1.0, (localTime + 0.5) / 1.0));
        }
      }

      const drawClipBg = (
        mediaEl: HTMLImageElement | HTMLVideoElement,
        clipOpacity = 1.0,
      ) => {
        drawBackground(
          mediaEl,
          w,
          h,
          Math.max(0, localTime),
          clipOpacity,
          0,
          1.0,
          clip.settings,
        );
      };

      const bbox = { x: 0, y: 0, width: w, height: h };

      drawWithTransform(
        ctx,
        clip.settings,
        bbox,
        () => {
          if (clip.settings.bgType === "video" && clip.settings.bgElements) {
            const vids = clip.settings.bgElements;
            const duration = clip.settings.videoDuration;

            if (duration) {
              const speed = clip.settings.speed || 1.0;
              const virtualTime = Math.max(0, localTime * speed);
              const crossfadeDur = Math.min(1.5, duration / 4);
              const period = duration - crossfadeDur;
              const loopIndex = Math.floor(virtualTime / period);
              const loopTime = virtualTime % period;

              const primaryIdx = loopIndex % 2;
              const secondaryIdx = (primaryIdx + 1) % 2;

              const primaryVid = vids[primaryIdx];
              const secondaryVid = vids[secondaryIdx];

              const inCrossfade = loopTime < crossfadeDur && loopIndex > 0;

              if (inCrossfade) {
                const loopFadeAlpha = loopTime / crossfadeDur;
                drawClipBg(secondaryVid, opacity);
                drawClipBg(primaryVid, opacity * loopFadeAlpha);
              } else {
                drawClipBg(primaryVid, opacity);
              }
            } else {
              drawClipBg(vids[0], opacity);
            }
          } else if (
            clip.settings.bgType === "image" &&
            clip.settings.bgElement
          ) {
            drawClipBg(clip.settings.bgElement, opacity);
          }
        },
        localTime,
        clip.duration,
        clip.type,
      );
    });
  }

  if (hasMediaNow) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, w, h);
  }

  // Update Visualizer Data
  if (runtime.analyser && state.isPlaying) {
    runtime.analyser.getByteFrequencyData(runtime.dataArray);
  } else if (runtime.analyser) {
    for (let i = 0; i < runtime.dataArray.length; i++) {
      runtime.dataArray[i] = Math.max(0, runtime.dataArray[i] - 5);
    }
  }

  // Draw All Registered Clips (Global ones like Visualizer)
  ClipRegistry.getAll().forEach((clip) => {
    // Timeline clips draw in the pass below; only true global clips render here.
    if (typeof clip.drawItem === "function") return;

    try {
      if (!clip || typeof clip.draw !== "function") return;

      const settings = state.clipSettings[clip.id];
      if (!settings) return;
      if (settings.enabled === false) return;

      const bbox = clip.getBoundingBox
        ? clip.getBoundingBox(ctx, w, h)
        : { x: 0, y: 0, width: w, height: h };
      const time = performance.now() / 1000;
      drawWithTransform(
        ctx,
        settings,
        bbox,
        () => clip.draw(ctx, w, h),
        time,
        Infinity,
        clip.id,
      );
    } catch (err) {
      console.error(`Error drawing global clip ${clip.id}:`, err);
    }
  });

  // Draw Timeline Clips
  state.timelineClips.forEach((clip: any) => {
    if (globalTime < clip.start || globalTime > clip.start + clip.duration)
      return;
    if (clip.settings && clip.settings.enabled === false) return;

    // Check if this clip type is disabled globally via ClipRegistry settings
    const globalSettings = state.clipSettings[clip.type];
    if (globalSettings && globalSettings.enabled === false) return;

    const renderer = ClipRegistry.get(clip.type);
    if (!renderer) return;

    const localTime = globalTime - clip.start;

    try {
      if (clip.type !== "background") {
        const bbox = renderer.getItemBoundingBox
          ? renderer.getItemBoundingBox(ctx, w, h, clip.settings)
          : { x: 0, y: 0, width: w, height: h };
        if (bbox) {
          drawWithTransform(
            ctx,
            clip.settings,
            bbox,
            () => renderer.drawItem(ctx, w, h, clip.settings, localTime, clip),
            localTime,
            clip.duration,
            clip.type,
          );
        }
      }
    } catch (err) {
      console.error(`Error drawing timeline clip ${clip.id}:`, err);
    }
  });

  // Draw Canvas Snap Guides
  if (state.canvasSnaps && state.canvasSnaps.length > 0) {
    ctx.save();
    ctx.strokeStyle = "#f43f5e"; // Rose-500 red alignment line
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    state.canvasSnaps.forEach((snap: any) => {
      ctx.beginPath();
      if (snap.type === "x") {
        ctx.moveTo(snap.value, 0);
        ctx.lineTo(snap.value, h);
      } else {
        ctx.moveTo(0, snap.value);
        ctx.lineTo(w, snap.value);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  // Draw selected clip's transform handles
  const selectedInfo = getSelectedClipInfo(state);
  if (selectedInfo && state.interactionMode === "select") {
    const { settings, renderer } = selectedInfo;
    const bbox = renderer.getItemBoundingBox
      ? renderer.getItemBoundingBox(ctx, w, h, settings)
      : null;
    if (bbox) {
      const scaleY = settings.scaleY ?? 1;
      const ptTL = transformPoint(bbox.x, bbox.y, bbox, settings);
      const ptTR = transformPoint(bbox.x + bbox.width, bbox.y, bbox, settings);
      const ptBR = transformPoint(
        bbox.x + bbox.width,
        bbox.y + bbox.height,
        bbox,
        settings,
      );
      const ptBL = transformPoint(bbox.x, bbox.y + bbox.height, bbox, settings);
      const ptTC = transformPoint(
        bbox.x + bbox.width * 0.5,
        bbox.y,
        bbox,
        settings,
      );
      const ptRot = transformPoint(
        bbox.x + bbox.width * 0.5,
        bbox.y - 30 / (scaleY || 0.001),
        bbox,
        settings,
      );

      ctx.save();

      // Draw Bounding Box Outline
      ctx.strokeStyle = "#3b82f6"; // Premium blue color
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ptTL.x, ptTL.y);
      ctx.lineTo(ptTR.x, ptTR.y);
      ctx.lineTo(ptBR.x, ptBR.y);
      ctx.lineTo(ptBL.x, ptBL.y);
      ctx.closePath();
      ctx.stroke();

      // Draw Rotation Line
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ptTC.x, ptTC.y);
      ctx.lineTo(ptRot.x, ptRot.y);
      ctx.stroke();

      // Draw Corner Handles & Rotation Handle
      const drawHandle = (pt: { x: number; y: number }, isCircle = false) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (isCircle) {
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.rect(pt.x - 5, pt.y - 5, 10, 10);
          ctx.fill();
          ctx.stroke();
        }
      };

      drawHandle(ptTL);
      drawHandle(ptTR);
      drawHandle(ptBR);
      drawHandle(ptBL);
      drawHandle(ptRot, true); // Rotation handle is circular

      ctx.restore();
    }
  }
};
