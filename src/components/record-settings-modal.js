import m from "mithril";
import { State } from "../lib/state";
import { startRecording } from "../lib/recorder";
import { getClipsToSearch, getTotalDuration, formatTime } from "../utils/helpers";

export const RecordSettingsModal = {
  view() {
    const clipsToSearch = getClipsToSearch(State);
    const durationVal = getTotalDuration(clipsToSearch);
    const formattedDur = formatTime(Math.floor(durationVal));

    const resolutions = [
      {
        id: "720p",
        label: "720p HD",
        dimensions: State.aspectRatio === "16:9" ? "1280 × 720" : "720 × 1280",
        desc: "Standard quality, fast rendering",
        recommended: false,
      },
      {
        id: "1080p",
        label: "1080p Full HD",
        dimensions: State.aspectRatio === "16:9" ? "1920 × 1080" : "1080 × 1920",
        desc: "High quality, standard choice",
        recommended: true,
      },
      {
        id: "1440p",
        label: "1440p 2K QHD",
        dimensions: State.aspectRatio === "16:9" ? "2560 × 1440" : "1440 × 2560",
        desc: "Ultra high quality, heavy load",
        recommended: false,
      },
    ];

    const fpsOptions = [
      { value: 30, label: "30 FPS", desc: "Standard smoothness" },
      { value: 60, label: "60 FPS", desc: "Ultra smooth motion" },
    ];

    return m(
      "div",
      {
        class: "fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200",
        onclick: () => {
          State.showRecordSettingsModal = false;
        },
      },
      [
        m(
          "div",
          {
            class: "w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200",
            onclick: (e) => e.stopPropagation(),
          },
          [
            // Header
            m(
              "div",
              {
                class: "px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60",
              },
              [
                m("div", [
                  m("h3", { class: "text-lg font-bold text-white flex items-center gap-2" }, [
                    m("i", { class: "icon-[ri--settings-4-line] text-blue-500 w-5 h-5" }),
                    "Export Video Settings",
                  ]),
                  m("p", { class: "text-xs text-slate-400 mt-1" }, "Configure quality and performance for rendering"),
                ]),
                m(
                  "button",
                  {
                    class: "w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer",
                    onclick: () => {
                      State.showRecordSettingsModal = false;
                    },
                  },
                  [m("i", { class: "icon-[ri--close-line] w-5 h-5" })]
                ),
              ]
            ),

            // Modal Body
            m("div", { class: "p-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]" }, [
              // Info Banner
              m(
                "div",
                {
                  class: "bg-blue-500/10 border border-blue-500/25 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-300",
                },
                [
                  m("i", { class: "icon-[ri--information-line] text-blue-400 w-5 h-5 shrink-0 mt-0.5" }),
                  m("div", [
                    m("span", { class: "font-semibold text-slate-200" }, "Recording Mode: "),
                    State.pendingRecordMode === "clip" ? "Single Music Clip" : "Full Timeline",
                    m("br"),
                    m("span", { class: "font-semibold text-slate-200" }, "Estimated Duration: "),
                    State.pendingRecordMode === "clip" ? "Depends on active track duration" : formattedDur,
                  ]),
                ]
              ),

              // Resolution Selectors
              m("div", [
                m("label", { class: "block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3" }, "Select Resolution"),
                m(
                  "div",
                  { class: "flex flex-col gap-2.5" },
                  resolutions.map((res) => {
                    const isSelected = State.recordResolution === res.id;
                    return m(
                      "button",
                      {
                        class: `w-full p-4 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-600/15 border-blue-500 text-white"
                            : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`,
                        onclick: () => {
                          State.recordResolution = res.id;
                        },
                      },
                      [
                        m("div", { class: "flex flex-col gap-1 pr-4" }, [
                          m("div", { class: "flex items-center gap-2" }, [
                            m("span", { class: "font-bold text-sm" }, res.label),
                            res.recommended &&
                              m(
                                "span",
                                {
                                  class: "text-[9px] font-extrabold uppercase tracking-wide bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30",
                                },
                                "Recommended"
                              ),
                          ]),
                          m("span", { class: "text-[11px] text-slate-400" }, res.desc),
                        ]),
                        m("div", { class: "text-right shrink-0" }, [
                          m("span", { class: "text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 px-2 py-1 rounded" }, res.dimensions),
                        ]),
                      ]
                    );
                  })
                ),
              ]),

              // Frame Rate Selector
              m("div", [
                m("label", { class: "block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3" }, "Frame Rate (FPS)"),
                m(
                  "div",
                  { class: "grid grid-cols-2 gap-3" },
                  fpsOptions.map((fps) => {
                    const isSelected = State.recordFps === fps.value;
                    return m(
                      "button",
                      {
                        class: `p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-600/15 border-blue-500 text-white"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`,
                        onclick: () => {
                          State.recordFps = fps.value;
                        },
                      },
                      [
                        m("span", { class: "font-bold text-sm" }, fps.label),
                        m("span", { class: "text-[10px] text-slate-500" }, fps.desc),
                      ]
                    );
                  })
                ),
              ]),

              // Warning / Notice
              m(
                "div",
                {
                  class: "bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex gap-3 text-[11px] text-slate-400 leading-relaxed",
                },
                [
                  m("i", { class: "icon-[ri--alert-line] text-amber-500 w-5 h-5 shrink-0 mt-0.5" }),
                  m("p", [
                    m("strong", { class: "text-amber-400" }, "Peringatan Performa: "),
                    "Perekaman dilakukan secara real-time langsung di browser. Memilih kualitas tinggi (seperti 1080p/1440p) dan 60 FPS membutuhkan spesifikasi komputer yang mumpuni. Pastikan tab browser tetap aktif selama proses perekaman untuk menghindari lag atau sinkronisasi audio-video yang rusak.",
                  ]),
                ]
              ),
            ]),

            // Footer
            m(
              "div",
              {
                class: "px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/60",
              },
              [
                m(
                  "button",
                  {
                    class: "px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer",
                    onclick: () => {
                      State.showRecordSettingsModal = false;
                    },
                  },
                  "Batal"
                ),
                m(
                  "button",
                  {
                    class: "px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-2 shadow-lg border border-blue-500/35 transition cursor-pointer",
                    onclick: () => {
                      State.showRecordSettingsModal = false;
                      startRecording(State.pendingRecordMode);
                    },
                  },
                  [
                    m("i", { class: "icon-[ri--movie-2-line] w-4 h-4" }),
                    "Mulai Rekam Video",
                  ]
                ),
              ]
            ),
          ]
        ),
      ]
    );
  },
};
