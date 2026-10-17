import m from "mithril";
import { State } from "../state";
import { SharedTransformSettings, SharedAnimationSettings } from "../../components/shared-clip-settings";
import { generateThumbnail, getClipsToSearch, getMediaUrls, revokeUrlIfUnused } from "../../utils/helpers";

const triggerFilePicker = (onSelect) => {
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

export const processOverlayUpload = (file, clip, onComplete) => {
  const oldUrls = getMediaUrls(clip);
  const url = URL.createObjectURL(file);

  // Clean up previous video elements if any
  if (clip.settings.mediaType === "video" && clip.settings.mediaElements) {
    clip.settings.mediaElements.forEach((v) => {
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
          m.redraw();
        });

        m.redraw();

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
        m.redraw();
      });

      m.redraw();

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

  getItemBoundingBox(ctx, w, h, settings) {
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

  drawItem(ctx, w, h, settings, localTime) {
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

  onSettings(clip) {
    const clipsToSearch = getClipsToSearch(State);
    const selectedClip = clip || clipsToSearch.find(c => c.id === State.selectedClipId && c.type === 'overlay');
    if (!selectedClip) return null;

    return m("div", { class: "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300" }, [
      // Change File Button
      m("div", { class: "bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-3" }, [
        m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest" }, "Media Settings"),
        
        m("button", {
          class: "w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 flex items-center justify-center gap-2 transition-all",
          onclick: () => {
            triggerFilePicker((file) => {
              processOverlayUpload(file, selectedClip, () => {
                m.redraw();
              });
            });
          }
        }, [
          m("i", { class: "icon-[ri--folder-open-line]" }),
          "Replace Media Source"
        ]),

        // Loop Video Option (Only for Video overlays)
        selectedClip.settings.mediaType === "video" && m("div", {
          class: "flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg mt-2"
        }, [
          m("div", { class: "flex flex-col" }, [
            m("span", { class: "text-[10px] font-bold text-slate-300" }, "Loop Video"),
            m("span", { class: "text-[9px] text-slate-500" }, selectedClip.settings.loop ? "Loops continuously" : "Locks timeline clip to video length"),
          ]),
          m("button", {
            class: `w-8 h-4 rounded-full relative transition-colors ${selectedClip.settings.loop !== false ? "bg-blue-600" : "bg-slate-700"}`,
            onclick: () => {
              selectedClip.settings.loop = selectedClip.settings.loop === false ? true : false;
              // Enforce duration locking
              if (selectedClip.settings.loop === false && selectedClip.settings.videoDuration) {
                selectedClip.duration = selectedClip.settings.videoDuration / (selectedClip.settings.speed || 1.0);
              }
              m.redraw();
            }
          }, [
            m("div", { 
              class: `absolute top-0.5 bottom-0.5 w-3 bg-white rounded-full transition-all ${selectedClip.settings.loop !== false ? "right-0.5" : "left-0.5"}` 
            })
          ]),
        ]),

        // Video speed control (only if video overlay)
        selectedClip.settings.mediaType === "video" && m("div", { class: "mt-4" }, [
          m("label", { class: "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between" }, [
            m("span", "Video Speed"),
            m("span", { class: "text-blue-400 font-mono text-[10px]" }, `${(selectedClip.settings.speed || 1.0).toFixed(2)}x`),
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
                if (selectedClip.settings.mediaElements) {
                  selectedClip.settings.mediaElements.forEach(v => {
                    v.playbackRate = val;
                  });
                }
                // Adjust duration if loop is disabled
                if (selectedClip.settings.loop === false && selectedClip.settings.videoDuration) {
                  selectedClip.duration = selectedClip.settings.videoDuration / val;
                }
                m.redraw();
              },
            }),
            m("button", {
              class: "px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded hover:text-white transition-colors text-[10px]",
              onclick: () => {
                selectedClip.settings.speed = 1.0;
                if (selectedClip.settings.mediaElements) {
                  selectedClip.settings.mediaElements.forEach(v => {
                    v.playbackRate = 1.0;
                  });
                }
                if (selectedClip.settings.loop === false && selectedClip.settings.videoDuration) {
                  selectedClip.duration = selectedClip.settings.videoDuration;
                }
                m.redraw();
              }
            }, "Reset")
          ])
        ]),

        // Opacity slider
        m("div", { class: "mt-4" }, [
          m("label", { class: "block text-xs text-slate-400 mb-2 flex justify-between" }, [
            m("span", "Opacity"),
            m("span", { class: "text-slate-500" }, `${Math.round((selectedClip.settings.opacity !== undefined ? selectedClip.settings.opacity : 1.0) * 100)}%`),
          ]),
          m("input", {
            type: "range",
            min: 0,
            max: 1,
            step: 0.05,
            value: selectedClip.settings.opacity !== undefined ? selectedClip.settings.opacity : 1.0,
            class: "w-full accent-blue-500",
            oninput: (e) => {
              selectedClip.settings.opacity = parseFloat(e.target.value);
              m.redraw();
            },
          }),
        ]),
      ]),

      SharedTransformSettings(null, -1, selectedClip.settings),
      SharedAnimationSettings(null, -1, selectedClip.settings),
    ]);
  }
};
