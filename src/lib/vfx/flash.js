import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";

export const FlashVFX = {
  id: "flash",
  name: "Lightning Flash",
  icon: "icon-[ri--flashlight-line]",
  
  settings: {
    frequency: 0.5,
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    if (clip.flashOpacity === undefined) {
      clip.flashOpacity = 0;
    }
    if (clip.flashCooldown === undefined) {
      clip.flashCooldown = 0;
    }

    if (clip.flashCooldown > 0) {
      clip.flashCooldown--;
    }

    if (settings.audioReactive) {
      const bassLevel = getAudioReactivity(State, "bass");
      const threshold = 0.85 - (settings.frequency || 0.5) * 0.35;
      
      if (bassLevel > threshold && clip.flashOpacity <= 0 && clip.flashCooldown === 0) {
        clip.flashOpacity = 0.2 + Math.random() * 0.3; // opacity of flash
        clip.flashCooldown = 30; // ~0.5s cooldown at 60fps
      }
    } else {
      // Trigger lightning flash randomly; frequency scales the probability
      const baseProbability = 0.002;
      const probability = baseProbability * (settings.frequency || 0.5) * 5;

      if (Math.random() < probability && clip.flashOpacity <= 0) {
        clip.flashOpacity = 0.2 + Math.random() * 0.3; // opacity of flash
      }
    }

    if (clip.flashOpacity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${clip.flashOpacity})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      clip.flashOpacity -= 0.04; // Fade out quickly
    }
  },

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'flash');
    if (!selectedClip) return null;

    if (selectedClip.settings.audioReactive === undefined) selectedClip.settings.audioReactive = false;

    return m("div", { class: "space-y-4 animate-in fade-in duration-300" }, [
      // Audio Reactive Toggle
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "flex items-center gap-2 cursor-pointer" }, [
          m("input", {
            type: "checkbox",
            checked: selectedClip.settings.audioReactive || false,
            class: "w-4 h-4 accent-blue-600 rounded",
            onchange: (e) => {
              selectedClip.settings.audioReactive = e.target.checked;
              m.redraw();
            },
          }),
          m("span", { class: "text-xs font-bold text-slate-300" }, "Audio Reactive"),
        ]),
        m("p", { class: "text-[10px] text-slate-500 mt-1" }, "Lightning will flash in sync with the song's bass beats")
      ]),

      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider" }, `Flash Frequency: ${Math.round((selectedClip.settings.frequency || 0.5) * 100)}%`),
        m("input", {
          type: "range",
          min: 0.1,
          max: 1.0,
          step: 0.05,
          class: "w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500",
          value: selectedClip.settings.frequency || 0.5,
          oninput: (e) => {
            selectedClip.settings.frequency = parseFloat(e.target.value);
          }
        }),
        m("div", { class: "flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono" }, [
          m("span", "Rare"),
          m("span", "Frequent")
        ])
      ])
    ]);
  }
};
