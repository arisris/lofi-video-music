import m from "mithril";
import { State } from "../lib/state";

export const SettingsPanel = {
  view() {
    const titleSettings = State.clipSettings["title"];
    const isTitleEnabled = titleSettings ? titleSettings.enabled !== false : false;
    const playlistSettings = State.clipSettings["playlist"];
    const isPlaylistEnabled = playlistSettings ? playlistSettings.enabled !== false : false;

    const toggleGlobalLayer = (e, id, settings) => {
      e.stopPropagation();
      if (settings) {
        settings.enabled = settings.enabled === false ? true : false;
      }
      m.redraw();
    };

    return m(
      "div",
      {
        class:
          "bg-slate-900 p-5 flex flex-col h-full w-full overflow-hidden",
      },
      [
        m("div", { class: "flex-1 overflow-y-auto pr-1 custom-scrollbar" }, [
          // Transition Settings
          m("div", { class: "mb-4" }, [
            m("label", { class: "block text-xs text-slate-400 mb-2" }, "Transition Style"),
            m("div", { class: "flex gap-2" }, [
              ["fade", "Fade"],
              ["slide", "Slide"],
              ["zoom", "Zoom"],
            ].map(([style, label]) =>
              m(
                "button",
                {
                  class: `flex-1 py-1.5 rounded text-xs transition ${State.bgTransitionStyle === style ? "bg-blue-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"}`,
                  onclick: () => (State.bgTransitionStyle = style),
                },
                label,
              )
            )),
          ]),

          // Global Overlays Settings
          m("div", { class: "mb-6" }, [
            m("h3", { class: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3" }, "Global Overlays"),
            m("div", { class: "space-y-2" }, [
              // Track Title Layer
              m("div", {
                class: `flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${State.selectedClipId === "title" ? "bg-blue-600/20 border-blue-500/50" : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60"}`,
                onclick: () => { State.selectedClipId = "title"; State.activeClipTab = "title"; }
              }, [
                m("div", { class: "flex items-center gap-3" }, [
                  m("i", { class: "icon-[ri--heading] w-4 h-4 text-slate-400" }),
                  m("span", { class: "text-xs font-bold text-slate-200" }, "Track Title overlay"),
                ]),
                m("button", {
                  class: `p-1 rounded-md transition-colors ${isTitleEnabled ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-500"}`,
                  onclick: (e) => toggleGlobalLayer(e, "title", titleSettings)
                }, m("i", { class: isTitleEnabled ? "icon-[ri--eye-line] w-4 h-4" : "icon-[ri--eye-off-line] w-4 h-4" }))
              ]),
              // Playlist Overlay Layer
              m("div", {
                class: `flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${State.selectedClipId === "playlist" ? "bg-blue-600/20 border-blue-500/50" : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60"}`,
                onclick: () => { State.selectedClipId = "playlist"; State.activeClipTab = "playlist"; }
              }, [
                m("div", { class: "flex items-center gap-3" }, [
                  m("i", { class: "icon-[ri--list-unordered] w-4 h-4 text-slate-400" }),
                  m("span", { class: "text-xs font-bold text-slate-200" }, "Playlist Overlay"),
                ]),
                m("button", {
                  class: `p-1 rounded-md transition-colors ${isPlaylistEnabled ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-500"}`,
                  onclick: (e) => toggleGlobalLayer(e, "playlist", playlistSettings)
                }, m("i", { class: isPlaylistEnabled ? "icon-[ri--eye-line] w-4 h-4" : "icon-[ri--eye-off-line] w-4 h-4" }))
              ])
            ])
          ]),

          m(
            "div",
            { class: "mt-6 p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg" },
            [
              m("p", { class: "text-[10px] text-blue-300 leading-relaxed italic" }, [
                m("i", { class: "icon-[ri--information-line] inline w-3 h-3 mr-1" }),
                "Tip: You can drag the image/video in the preview to adjust its composition.",
              ]),
            ],
          ),
        ])
      ],
    );
  },
};
