import m from "mithril";
import { State } from "../state";
import { SharedTransformSettings, SharedAnimationSettings } from "../../components/shared-clip-settings";
import { getRandomKenBurnsEffect, generateThumbnail, getClipsToSearch, getMediaUrls, revokeUrlIfUnused } from "../../utils/helpers";
import { showDragHint } from "../../utils/ui-helpers";

export const triggerFilePicker = (onSelect) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onSelect(file);
    }
  };
  input.click();
};

export const processBgClipUpload = (file, clip, onComplete) => {
  const oldUrls = getMediaUrls(clip);
  const url = URL.createObjectURL(file);

  // Clean up previous video elements if any
  if (clip.settings.bgType === "video" && clip.settings.bgElements) {
    clip.settings.bgElements.forEach((v) => {
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
          m.redraw();
        });

        m.redraw();
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
        m.redraw();
      });

      m.redraw();
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

  getItemBoundingBox(ctx, w, h, settings) {
    return {
      x: 0,
      y: 0,
      width: w,
      height: h,
    };
  },

  drawItem(ctx, w, h, settings) {},

  onSettings(clip) {
    const clipsToSearch = getClipsToSearch(State);
    const selectedClip = clip || clipsToSearch.find(c => c.id === State.selectedClipId && c.type === 'background');
    if (!selectedClip) {
      return m(
        "div",
        { class: "text-slate-500 text-xs italic text-center py-8" },
        "Select a background clip from the list to change settings",
      );
    }


    return m("div", { class: "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300" }, [
      // Ken Burns Effect selector
      !State.isThumbnailMode && m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3" }, "Motion / Ken Burns Effect"),
        m("div", { class: "relative" }, [
          m("select", {
            class: "w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-slate-700/50 transition-colors",
            onchange: (e) => {
              selectedClip.settings.currentEffect = e.target.value;
              m.redraw();
            },
            value: selectedClip.settings.currentEffect || "none"
          }, [
            { value: "none", label: "None" },
            { value: "random", label: "Random Motion (Wander)" },
            { value: "zoomIn", label: "Zoom In" },
            { value: "zoomOut", label: "Zoom Out" },
            { value: "panRight", label: "Pan Right" },
            { value: "panLeft", label: "Pan Left" },
            { value: "panUp", label: "Pan Up" },
            { value: "panDown", label: "Pan Down" },
          ].map(opt => m("option", { value: opt.value }, opt.label))),
          m("i", { class: "icon-[ri--arrow-down-s-line] absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" })
        ]),
      ]),

      State.isThumbnailMode && selectedClip.settings.bgType === "image" && m("div", { class: "bg-amber-950/20 border border-amber-800/40 p-3 rounded-lg text-amber-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" }, [
        m("i", { class: "icon-[ri--alert-line] w-4 h-4 shrink-0" }),
        "Motion / Ken Burns is disabled in Thumbnail Mode"
      ]),

      // Video speed control (only if video)
      selectedClip.settings.bgType === "video" && m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between" }, [
          m("span", "Video Speed"),
          m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${(selectedClip.settings.speed || 1.0).toFixed(2)}x`)
        ]),
        m("div", { class: "flex items-center gap-3" }, [
          m("input", {
            type: "range",
            min: 0.25,
            max: 4.0,
            step: 0.05,
            value: selectedClip.settings.speed || 1.0,
            class: "flex-1 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500",
            oninput: (e) => {
              const val = parseFloat(e.target.value);
              selectedClip.settings.speed = val;
              if (selectedClip.settings.bgElements) {
                selectedClip.settings.bgElements.forEach(v => {
                  v.playbackRate = val;
                });
              }
              m.redraw();
            }
          }),
          m("button", {
            class: "px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded hover:text-white transition-colors text-[10px]",
            onclick: () => {
              selectedClip.settings.speed = 1.0;
              if (selectedClip.settings.bgElements) {
                selectedClip.settings.bgElements.forEach(v => {
                  v.playbackRate = 1.0;
                });
              }
              m.redraw();
            }
          }, "Reset")
        ])
      ]),

      SharedTransformSettings(null, -1, selectedClip.settings),
      !State.isThumbnailMode && SharedAnimationSettings(null, -1, selectedClip.settings),
    ]);
  }
};

export { drawBackground } from "./draw-bg";
