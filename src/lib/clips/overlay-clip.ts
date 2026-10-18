import { State } from "../state";
import { bumpClips } from "../../store/actions/timeline-actions";
import { OverlaySettingsView } from "../../components/clip-settings/overlay";
import { generateThumbnail, getMediaUrls, revokeUrlIfUnused } from "../../utils/helpers";


export const processOverlayUpload = (file: File, clip: Record<string, any>, onComplete?: () => void) => {
  const oldUrls = getMediaUrls(clip);
  const url = URL.createObjectURL(file);

  // Clean up previous video elements if any
  if (clip.settings.mediaType === "video" && clip.settings.mediaElements) {
    clip.settings.mediaElements.forEach((v: HTMLVideoElement) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  }

  clip.settings.fileName = file.name;

  if (file.type.startsWith("video/")) {
    const vid1 = document.createElement("video");
    const vid2 = document.createElement("video");
    let loadedCount = 0;
    const checkLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        clip.settings.mediaElements = [vid1, vid2];
        clip.settings.mediaElement = null;
        clip.settings.mediaType = "video";
        clip.settings.activeVidIndex = 0;
        clip.settings.videoDuration = vid1.duration;
        
        // Loop video defaults to true
        if (clip.settings.loop === undefined) {
          clip.settings.loop = true;
        }

        // If loop is false, lock clip duration to video length adjusted for speed
        if (clip.settings.loop === false) {
          clip.duration = vid1.duration / (clip.settings.speed || 1.0);
        }

        generateThumbnail(vid1, true).then(thumb => {
          clip.settings.thumbnail = thumb;
          if (onComplete) onComplete();
          bumpClips();
        });

        bumpClips();

        // Revoke old URLs after replacing elements
        oldUrls.forEach(oldUrl => revokeUrlIfUnused(oldUrl, State));
      }
    };
    [vid1, vid2].forEach((vid) => {
      vid.src = url;
      vid.muted = true;
      vid.loop = false;
      vid.playsInline = true;
      vid.crossOrigin = "anonymous";
      vid.playbackRate = clip.settings.speed || 1.0;
      vid.onloadedmetadata = () => {
        vid.width = vid.videoWidth;
        vid.height = vid.videoHeight;
        checkLoad();
      };
    });
  } else {
    const img = new Image();
    img.onload = () => {
      clip.settings.mediaElement = img;
      clip.settings.mediaElements = null;
      clip.settings.mediaType = "image";
      clip.settings.videoDuration = 0;
      clip.settings.loop = undefined;

      generateThumbnail(img).then(thumb => {
        clip.settings.thumbnail = thumb;
        if (onComplete) onComplete();
        bumpClips();
      });

      bumpClips();

      // Revoke old URLs after replacing elements
      oldUrls.forEach(oldUrl => revokeUrlIfUnused(oldUrl, State));
    };
    img.src = url;
  }
};

export const OverlayClip = {
  id: "overlay",
  name: "Overlay",
  icon: "icon-[ri--image-add-line]",

  settings: {
    opacity: 1.0,
    loop: true,
  },

  getItemBoundingBox(_ctx: CanvasRenderingContext2D, _w: number, _h: number, settings: Record<string, any>) {
    if (settings.mediaType === "image" && settings.mediaElement) {
      const img = settings.mediaElement;
      return { x: 0, y: 0, width: img.naturalWidth || 300, height: img.naturalHeight || 200 };
    }
    if (settings.mediaType === "gif" && settings.gifFrames && settings.gifFrames.length > 0) {
      const frame = settings.gifFrames[0];
      return { x: 0, y: 0, width: frame.dims.width || 300, height: frame.dims.height || 200 };
    }
    if (settings.mediaType === "video" && settings.mediaElements) {
      const vid = settings.mediaElements[0];
      return { x: 0, y: 0, width: vid.videoWidth || 300, height: vid.videoHeight || 200 };
    }
    return { x: 0, y: 0, width: 300, height: 200 };
  },

  drawItem(ctx: CanvasRenderingContext2D, _w: number, _h: number, settings: Record<string, any>, localTime: number) {
    const { mediaType, mediaElement, mediaElements, loop, videoDuration } = settings;
    const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;
    ctx.globalAlpha = ctx.globalAlpha * opacity;

    if (mediaType === "image" && mediaElement) {
      ctx.drawImage(mediaElement, 0, 0);
    } else if (mediaType === "gif" && settings.gifFrames && settings.gifFrames.length > 0) {
      const frames = settings.gifFrames;
      const duration = Math.max(1, settings.gifDuration || 1000);
      
      const timeMs = Math.max(0, (localTime * 1000) % duration);
      let accumulatedTime = 0;
      let frameIdx = frames.length - 1;
      for (let i = 0; i < frames.length; i++) {
        accumulatedTime += frames[i].delay;
        if (timeMs < accumulatedTime) {
          frameIdx = i;
          break;
        }
      }
      
      const frame = frames[frameIdx];
      if (frame && frame.canvas) {
        ctx.drawImage(frame.canvas, frame.dims.left, frame.dims.top);
      }
    } else if (mediaType === "video" && mediaElements) {
      const vids = mediaElements;
      const duration = videoDuration || vids[0].duration;

      if (duration) {
        const isLooping = loop !== false;

        if (isLooping) {
          const speed = settings.speed || 1.0;
          const virtualTime = localTime * speed;
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
            ctx.drawImage(secondaryVid, 0, 0);
            ctx.save();
            ctx.globalAlpha = ctx.globalAlpha * loopFadeAlpha;
            ctx.drawImage(primaryVid, 0, 0);
            ctx.restore();
          } else {
            ctx.drawImage(primaryVid, 0, 0);
          }
        } else {
          // Non-looping video: clamp time and draw first video element
          ctx.drawImage(vids[0], 0, 0);
        }
      } else {
        ctx.drawImage(vids[0], 0, 0);
      }
    }
  },

  onSettings: OverlaySettingsView,
};
