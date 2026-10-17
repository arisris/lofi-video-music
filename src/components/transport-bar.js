import m from "mithril";
import { State } from "../lib/state";
import { formatTime, getTotalDuration, getClipsToSearch } from "../utils/helpers";
import { playAudio, pauseAudio, skipToNextTrack, skipToPrevTrack } from "../lib/audio";
import { startRecording, stopRecording } from "../lib/recorder";
import { runtime } from "../lib/runtime";

let hoverTime = "";
let hoverX = 0;
let isHovering = false;

export const PlaybackControls = {
  _closeMenu(e) {
    if (State.showRecordMenu) {
      State.showRecordMenu = false;
      m.redraw();
    }
  },
  oncreate() {
    window.addEventListener("click", PlaybackControls._closeMenu);
  },
  onremove() {
    window.removeEventListener("click", PlaybackControls._closeMenu);
  },
  view() {
    const clipsToSearch = getClipsToSearch(State);
    const musicClips = clipsToSearch.filter(c => c.type === 'music');

    return m(
      "div",
      {
        class: "flex items-center justify-between gap-2 md:gap-4 w-full",
      },
      [
        // Left: Aspect Ratio Switcher
        m("div", { class: "flex items-center gap-3 w-auto md:w-1/3" }, [
          // Aspect Ratio Switcher
          m("div", { class: "flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800" }, 
            [
              { ratio: "16:9", icon: "icon-[mdi--crop-landscape]", label: "16:9" },
              { ratio: "9:16", icon: "icon-[mdi--crop-portrait]", label: "9:16" },
            ].map((item) =>
              m(
                "button",
                {
                  title: item.label,
                  class: `h-7 px-2.5 flex items-center justify-center gap-1 rounded transition text-[10px] font-bold cursor-pointer ${State.aspectRatio === item.ratio ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`,
                  onclick: () => {
                    State.aspectRatio = item.ratio;
                    if (item.ratio === "16:9") {
                      runtime.canvas.width = 1280;
                      runtime.canvas.height = 720;
                    } else {
                      runtime.canvas.width = 720;
                      runtime.canvas.height = 1280;
                    }
                  },
                },
                [
                  m("i", { class: `${item.icon} w-3.5 h-3.5` }),
                  m("span", { class: "hidden lg:inline" }, item.ratio)
                ]
              )
            )
          )
        ]),

        // Center: Transport Buttons
        m("div", { class: "flex items-center justify-center gap-4 flex-1" }, [
          // Skip Prev
          m(
            "button",
            {
              class: "text-slate-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed",
              disabled: State.isRecording || musicClips.length === 0,
              onclick: () => skipToPrevTrack(),
            },
            [m("i", { class: "icon-[ri--skip-back-fill] w-5 h-5" })],
          ),

          // Play / Pause
          m(
            "button",
            {
              class: `w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer shadow-md ${State.isRecording ? "opacity-30 cursor-not-allowed bg-slate-800 text-slate-500" : State.isPlaying ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"}`,
              disabled: State.isRecording,
              onclick: () => (State.isPlaying ? pauseAudio() : playAudio()),
            },
            [
              m("i", {
                class: `${State.isPlaying ? "icon-[ri--pause-fill]" : "icon-[ri--play-fill]"} w-5 h-5`,
              }),
            ]
          ),

          // Skip Next
          m(
            "button",
            {
              class: "text-slate-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed",
              disabled: State.isRecording || musicClips.length === 0,
              onclick: () => skipToNextTrack(),
            },
            [m("i", { class: "icon-[ri--skip-forward-fill] w-5 h-5" })],
          ),
        ]),

        // Right: Recording
        m("div", { class: "flex items-center justify-end gap-1.5 md:gap-2 w-auto md:w-1/3 relative" }, [
          (() => {
            const showDropdown = State.showRecordMenu && !State.isRecording && musicClips.length >= 2;

            if (!showDropdown) return null;

            return m("div", {
              class: "absolute bottom-10 right-0 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200"
            }, [
              // Option 1: Record Current Clip
              (() => {
                const activeClip = clipsToSearch.find(c => 
                  c.type === 'music' && 
                  c.settings?.enabled !== false &&
                  State.currentTime >= c.start && 
                  State.currentTime <= c.start + c.duration
                );
                const hasActiveClip = !!activeClip;
                const clipName = activeClip?.settings?.name || "";
                
                return m("button", {
                  class: `w-full text-left px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide flex items-center justify-between transition cursor-pointer ${hasActiveClip ? "text-slate-200 hover:bg-slate-800 hover:text-white" : "text-slate-600 cursor-not-allowed"}`,
                  disabled: !hasActiveClip,
                  onclick: () => {
                    State.showRecordMenu = false;
                    State.pendingRecordMode = "clip";
                    State.showRecordSettingsModal = true;
                  }
                }, [
                  m("div", { class: "flex flex-col truncate pr-2" }, [
                    m("span", { class: "font-bold text-slate-300" }, "Record Current Clip"),
                    m("span", { class: "text-[9px] text-slate-500 truncate" }, hasActiveClip ? `"${clipName}"` : "No active clip under playhead")
                  ]),
                  m("i", { class: "icon-[ri--music-2-line] w-4 h-4 shrink-0 text-emerald-400" })
                ]);
              })(),
              
              // Option 2: Record Full Timeline
              (() => {
                const durationVal = getTotalDuration(clipsToSearch);
                const formattedDur = formatTime(Math.floor(durationVal));
                return m("button", {
                  class: "w-full text-left px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wide flex items-center justify-between text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer",
                  onclick: () => {
                    State.showRecordMenu = false;
                    State.pendingRecordMode = "timeline";
                    State.showRecordSettingsModal = true;
                  }
                }, [
                  m("div", { class: "flex flex-col" }, [
                    m("span", { class: "font-bold text-slate-300" }, "Record Full Video"),
                    m("span", { class: "text-[9px] text-slate-500" }, `Duration: ${formattedDur}`)
                  ]),
                  m("i", { class: "icon-[ri--movie-2-line] w-4 h-4 text-blue-400" })
                ]);
              })()
            ]);
          })(),

          (() => {
            const isThumbnailMode = State.currentRoute === "/image";
            if (isThumbnailMode) {
              return m(
                "button",
                {
                  title: "Save Thumbnail Image",
                  class: "h-8 px-3 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-md border border-blue-500/35",
                  onclick: () => {
                    const canvas = runtime.canvas;
                    if (!canvas) return;

                    // Capture current canvas rendering
                    const oldSnaps = State.canvasSnaps;
                    State.canvasSnaps = []; // temporarily hide guides

                    setTimeout(() => {
                      const dataURL = canvas.toDataURL("image/png");
                      const link = document.createElement("a");
                      link.download = `lofi-thumbnail-${Date.now()}.png`;
                      link.href = dataURL;
                      link.click();
                      State.canvasSnaps = oldSnaps;
                      m.redraw();
                    }, 50);
                  }
                },
                [
                  m("i", { class: "icon-[ri--download-line] w-3.5 h-3.5" }),
                  m("span", "Save Thumbnail")
                ]
              );
            }

            const musicClipsCount = musicClips.length;
            const hasMultipleMusic = musicClipsCount >= 2;

            return m(
              "button",
              {
                title: hasMultipleMusic ? "Record video options" : "Record video",
                class: `h-8 px-2 md:px-3 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${State.isRecording ? "bg-red-500/20 text-red-500 border border-red-500/50" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`,
                onclick: (e) => {
                  e.stopPropagation();
                  if (State.isRecording) {
                    stopRecording();
                  } else {
                    if (hasMultipleMusic) {
                      State.showRecordMenu = !State.showRecordMenu;
                    } else {
                      State.pendingRecordMode = "timeline";
                      State.showRecordSettingsModal = true;
                    }
                  }
                }
              },
              [
                m("div", { class: `w-1.5 h-1.5 rounded-full ${State.isRecording ? "bg-red-500 animate-pulse" : "bg-slate-600"}` }),
                m("span", { class: "hidden sm:inline" }, State.isRecording ? "Stop" : "Record Video"),
                !State.isRecording && hasMultipleMusic && m("i", { class: "icon-[ri--arrow-up-s-line] w-3.5 h-3.5 ml-0.5" })
              ]
            );
          })()
        ])
      ]
    );
  }
};

export const TimelineScrubber = {
  view() {
    const clipsToSearch = getClipsToSearch(State);
    const currentTime = State.currentTime || 0;
    const duration = getTotalDuration(clipsToSearch);
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return m("div", { class: "flex items-center gap-2 md:gap-3 w-full" }, [
      m("span", { class: "text-[9px] md:text-[10px] text-slate-500 font-mono w-8 md:w-10" }, formatTime(currentTime)),
      
      m("div", {
        class: "flex-1 h-1 md:h-1.5 bg-slate-800 rounded-full cursor-pointer relative group",
        onclick: (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          const targetTime = pos * duration;
          State.currentTime = targetTime;
          
          const activeClip = clipsToSearch.find(c => 
            c.type === 'music' && 
            c.settings?.enabled !== false &&
            State.currentTime >= c.start && 
            State.currentTime <= c.start + c.duration
          );
          if (activeClip && runtime.audioEl) {
            runtime.audioEl.src = activeClip.settings.audioUrl;
            runtime.audioEl.currentTime = (State.currentTime - activeClip.start) + (activeClip.settings.startOffset || 0);
            runtime.audioEl.volume = activeClip.settings.volume ?? 1.0;
            if (State.isPlaying) runtime.audioEl.play().catch(() => {});
          } else if (runtime.audioEl) {
            runtime.audioEl.pause();
          }
          m.redraw();
        },
        onmousemove: (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pos = x / rect.width;
          hoverTime = formatTime(pos * duration);
          hoverX = x;
          isHovering = true;
        },
        onmouseleave: () => (isHovering = false),
      }, [
        // Progress Fill
        m("div", {
          class: "h-full bg-blue-500 rounded-full relative",
          style: { width: `${progress}%` }
        }),
        // Thumb
        m("div", {
          class: "absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform",
          style: { left: `calc(${progress}% - 6px)` }
        }),
        // Hover Tooltip
        isHovering && m("div", {
          class: "absolute bottom-full mb-2 px-1.5 py-0.5 bg-slate-800 text-white text-[9px] rounded border border-slate-700 -translate-x-1/2 pointer-events-none",
          style: { left: `${hoverX}px` }
        }, hoverTime)
      ]),

      m("span", { class: "text-[9px] md:text-[10px] text-slate-500 font-mono w-8 md:w-10 text-right" }, formatTime(duration))
    ]);
  }
};
