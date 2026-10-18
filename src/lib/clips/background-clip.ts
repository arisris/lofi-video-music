import { State } from "../state";
import { bumpClips } from "../../store/actions/timeline-actions";
import { BackgroundSettingsView } from "../../components/clip-settings/background";
import { generateThumbnail, getMediaUrls, revokeUrlIfUnused } from "../../utils/helpers";
import { showDragHint } from "../../utils/ui-helpers";

export const triggerFilePicker = (onSelect: (file: File) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files![0];
    if (file) {
      onSelect(file);
    }
  };
  input.click();
};

export const processBgClipUpload = (file: File, clip: Record<string, any>, onComplete?: () => void) => {
  const oldUrls = getMediaUrls(clip);
  const url = URL.createObjectURL(file);

  // Clean up previous video elements if any
  if (clip.settings.bgType === "video" && clip.settings.bgElements) {
    clip.settings.bgElements.forEach((v: HTMLVideoElement) => {
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
        clip.settings.bgElements = [vid1, vid2];
        clip.settings.bgType = "video";
        clip.settings.activeVidIndex = 0;
        clip.settings.videoDuration = vid1.duration;
        clip.settings.bgOffsetX = 0;
        clip.settings.bgOffsetY = 0;
        
        generateThumbnail(vid1, true).then(thumb => {
          clip.settings.thumbnail = thumb;
          if (onComplete) onComplete();
          bumpClips();
        });

        bumpClips();
        showDragHint();

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
      clip.settings.bgElement = img;
      clip.settings.bgElements = null;
      clip.settings.bgType = "image";
      clip.settings.bgOffsetX = 0;
      clip.settings.bgOffsetY = 0;
      
      generateThumbnail(img).then(thumb => {
        clip.settings.thumbnail = thumb;
        if (onComplete) onComplete();
        bumpClips();
      });

      bumpClips();
      showDragHint();

      // Revoke old URLs after replacing element
      oldUrls.forEach(oldUrl => revokeUrlIfUnused(oldUrl, State));
    };
    img.src = url;
  }
};

export const BackgroundClip = {
  id: "background",
  name: "Background",
  icon: "icon-[ri--image-line]",

  settings: {},

  getItemBoundingBox(_ctx: CanvasRenderingContext2D, w: number, h: number, _settings: Record<string, any>) {
    return {
      x: 0,
      y: 0,
      width: w,
      height: h,
    };
  },

  drawItem(_ctx: CanvasRenderingContext2D, _w: number, _h: number, _settings: Record<string, any>) {},

  onSettings: BackgroundSettingsView,
};
