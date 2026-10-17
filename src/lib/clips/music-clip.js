import m from "mithril";
import { State } from "../state";
import { applyAudioSettings } from "../audio";
import { getClipsToSearch } from "../../utils/helpers";

export const MusicClip = {
  id: "music",
  name: "Music",
  icon: "icon-[ri--music-2-line]",

  settings: {
    name: "Music",
    audioUrl: "",
    audioDuration: 0,
    volume: 1.0,
    playbackRate: 1.0,
    pan: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    startOffset: 0,
    enabled: true
  },

  drawItem(ctx, w, h, item, localTime = 0, clip = null) {
    // Music clips are audio-only and do not render on the preview canvas
  },

  onSettings(clip) {
    if (!clip) return null;
    const settings = clip.settings;

    return m("div", { class: "space-y-4 animate-in fade-in slide-in-from-top-2 duration-300" }, [
      m("div", { class: "bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 space-y-4" }, [
        m("div", [
          m("label", { class: "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2" }, "Clip Name"),
          m("input", {
            type: "text",
            class: "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors",
            value: settings.name || "",
            oninput: (e) => {
              settings.name = e.target.value;
            }
          })
        ]),
        m("div", [
          m("label", { class: "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between" }, [
            m("span", "Volume"),
            m("span", { class: "text-blue-400 font-mono" }, `${Math.round((settings.volume ?? 1.0) * 100)}%`)
          ]),
          m("input", {
            type: "range",
            min: 0,
            max: 2,
            step: 0.01,
            value: settings.volume ?? 1.0,
            class: "w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer",
            oninput: (e) => {
              settings.volume = parseFloat(e.target.value);
              applyAudioSettings(clip);
              m.redraw();
            }
          })
        ]),
        m("div", [
          m("label", { class: "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between" }, [
            m("span", "Playback Speed"),
            m("span", { class: "text-blue-400 font-mono" }, `${(settings.playbackRate ?? 1.0).toFixed(2)}x`)
          ]),
          m("input", {
            type: "range",
            min: 0.5,
            max: 1.5,
            step: 0.05,
            value: settings.playbackRate ?? 1.0,
            class: "w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer",
            oninput: (e) => {
              settings.playbackRate = parseFloat(e.target.value);
              applyAudioSettings(clip);
              m.redraw();
            }
          })
        ]),
        m("div", [
          m("label", { class: "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between" }, [
            m("span", "Stereo Panning"),
            m("span", { class: "text-blue-400 font-mono" }, 
              settings.pan === 0 ? "Center" : settings.pan < 0 ? `L ${Math.round(Math.abs(settings.pan) * 100)}%` : `R ${Math.round(settings.pan * 100)}%`
            )
          ]),
          m("input", {
            type: "range",
            min: -1,
            max: 1,
            step: 0.1,
            value: settings.pan ?? 0,
            class: "w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer",
            oninput: (e) => {
              settings.pan = parseFloat(e.target.value);
              applyAudioSettings(clip);
              m.redraw();
            }
          })
        ]),
        // EQ Section
        m("div", { class: "space-y-3 pt-2 border-t border-slate-700/30" }, [
          m("label", { class: "block text-xs font-bold text-slate-400 uppercase tracking-wider" }, "Equalizer (3-Band)"),
          m("div", { class: "space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50 text-xs" }, [
            // Bass
            m("div", { class: "flex items-center justify-between" }, [
              m("span", { class: "w-12 text-slate-400 text-[10px] font-semibold" }, "Bass"),
              m("input", {
                type: "range",
                min: -12,
                max: 12,
                step: 1,
                value: settings.eqLow ?? 0,
                class: "flex-1 mx-3 h-1 accent-emerald-500 cursor-pointer bg-slate-800 rounded-lg appearance-none",
                oninput: (e) => {
                  settings.eqLow = parseInt(e.target.value);
                  applyAudioSettings(clip);
                  m.redraw();
                }
              }),
              m("span", { class: "w-12 text-right text-emerald-400 font-mono text-[10px]" }, `${settings.eqLow > 0 ? "+" : ""}${settings.eqLow} dB`)
            ]),
            // Mids
            m("div", { class: "flex items-center justify-between" }, [
              m("span", { class: "w-12 text-slate-400 text-[10px] font-semibold" }, "Mids"),
              m("input", {
                type: "range",
                min: -12,
                max: 12,
                step: 1,
                value: settings.eqMid ?? 0,
                class: "flex-1 mx-3 h-1 accent-emerald-500 cursor-pointer bg-slate-800 rounded-lg appearance-none",
                oninput: (e) => {
                  settings.eqMid = parseInt(e.target.value);
                  applyAudioSettings(clip);
                  m.redraw();
                }
              }),
              m("span", { class: "w-12 text-right text-emerald-400 font-mono text-[10px]" }, `${settings.eqMid > 0 ? "+" : ""}${settings.eqMid} dB`)
            ]),
            // Treble
            m("div", { class: "flex items-center justify-between" }, [
              m("span", { class: "w-12 text-slate-400 text-[10px] font-semibold" }, "Treble"),
              m("input", {
                type: "range",
                min: -12,
                max: 12,
                step: 1,
                value: settings.eqHigh ?? 0,
                class: "flex-1 mx-3 h-1 accent-emerald-500 cursor-pointer bg-slate-800 rounded-lg appearance-none",
                oninput: (e) => {
                  settings.eqHigh = parseInt(e.target.value);
                  applyAudioSettings(clip);
                  m.redraw();
                }
              }),
              m("span", { class: "w-12 text-right text-emerald-400 font-mono text-[10px]" }, `${settings.eqHigh > 0 ? "+" : ""}${settings.eqHigh} dB`)
            ])
          ])
        ]),
        // Apply To All Button
        m("button", {
          class: "w-full py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider hover:bg-blue-500 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2",
          onclick: () => {
            const clipsToSearch = getClipsToSearch(State);
            const clips = clipsToSearch.filter(c => c.type === "music");
            clips.forEach(c => {
              if (c.id !== clip.id) {
                c.settings.volume = settings.volume;
                c.settings.playbackRate = settings.playbackRate;
                c.settings.pan = settings.pan;
                c.settings.eqLow = settings.eqLow;
                c.settings.eqMid = settings.eqMid;
                c.settings.eqHigh = settings.eqHigh;
              }
            });
            // Update currently active audio element settings
            const activeClip = clipsToSearch.find(c => 
              c.type === 'music' && 
              c.settings?.enabled !== false &&
              State.currentTime >= c.start && 
              State.currentTime <= c.start + c.duration
            );
            if (activeClip) {
              applyAudioSettings(activeClip);
            }
            
            clip._appliedFeedback = true;
            setTimeout(() => {
              clip._appliedFeedback = false;
              m.redraw();
            }, 2000);
            m.redraw();
          }
        }, [
          m("i", { class: clip._appliedFeedback ? "icon-[ri--check-line] w-4 h-4 text-emerald-400 animate-bounce" : "icon-[ri--checkbox-multiple-line] w-4 h-4" }),
          clip._appliedFeedback ? "Applied Successfully!" : "Apply to All Clips"
        ]),
        m("div", { class: "text-[10px] text-slate-500 space-y-1 bg-slate-950/40 p-2.5 rounded-lg font-mono border border-slate-800/50" }, [
          m("div", [m("span", { class: "text-slate-400 font-bold" }, "File Duration: "), `${settings.audioDuration ? settings.audioDuration.toFixed(2) : 0}s`]),
          m("div", [m("span", { class: "text-slate-400 font-bold" }, "Clip Duration: "), `${clip.duration.toFixed(2)}s`]),
          m("div", [m("span", { class: "text-slate-400 font-bold" }, "Start Offset (Trim): "), `${(settings.startOffset || 0).toFixed(2)}s`]),
          m("div", [m("span", { class: "text-slate-400 font-bold" }, "Timeline Start: "), `${clip.start.toFixed(2)}s`]),
        ])
      ])
    ]);
  }
};
