import m from "mithril";
import { State } from "../state";
import { getAudioReactivity } from "../../utils/helpers";

export const FilmGrainVFX = {
  id: "filmgrain",
  name: "Film Grain & VHS",
  icon: "icon-[ri--tv-line]",

  settings: {
    grainIntensity: 0.15,
    scanlinesOpacity: 0.08,
    glitchFrequency: 0.3,
    audioReactive: false
  },

  drawItem(ctx, w, h, settings, localTime, clip) {
    // 1. Initialize Offscreen Noise Canvas (once)
    if (!clip.noiseCanvas) {
      const nSize = 128;
      clip.noiseCanvas = document.createElement("canvas");
      clip.noiseCanvas.width = nSize;
      clip.noiseCanvas.height = nSize;
      const nCtx = clip.noiseCanvas.getContext("2d");
      const imgData = nCtx.createImageData(nSize, nSize);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = 40;  // Alpha (intensity of noise)
      }
      nCtx.putImageData(imgData, 0, 0);
    }

    // 2. Draw VHS Scanlines
    const scanlinesOpacity = settings.scanlinesOpacity !== undefined ? settings.scanlinesOpacity : 0.08;
    if (scanlinesOpacity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${scanlinesOpacity})`;
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1.5);
      }
      ctx.restore();
    }

    // 3. Draw Film Grain Overlay
    const grainIntensity = settings.grainIntensity !== undefined ? settings.grainIntensity : 0.15;
    if (grainIntensity > 0) {
      ctx.save();
      ctx.globalAlpha = grainIntensity;
      const nSize = 128;
      // Tile noise canvas with random offset per frame for dynamic grain
      const offsetX = Math.floor(Math.random() * nSize);
      const offsetY = Math.floor(Math.random() * nSize);
      for (let x = -offsetX; x < w; x += nSize) {
        for (let y = -offsetY; y < h; y += nSize) {
          ctx.drawImage(clip.noiseCanvas, x, y);
        }
      }
      ctx.restore();
    }

    // 4. VHS Tape Glitch Logic
    if (clip.glitchActiveFrames === undefined) clip.glitchActiveFrames = 0;
    if (clip.glitchCooldown === undefined) clip.glitchCooldown = 0;

    if (clip.glitchCooldown > 0) clip.glitchCooldown--;
    if (clip.glitchActiveFrames > 0) clip.glitchActiveFrames--;

    let triggerGlitch = false;
    let glitchIntensity = settings.glitchFrequency || 0.3;

    if (settings.audioReactive) {
      const bassLevel = getAudioReactivity(State, "bass");
      if (bassLevel > 0.68 && clip.glitchActiveFrames === 0 && clip.glitchCooldown === 0) {
        clip.glitchActiveFrames = 3 + Math.floor(Math.random() * 5); // glitch for 3-7 frames
        clip.glitchCooldown = 12; // short cooldown for fast triggers
        glitchIntensity = 0.4 + bassLevel * 0.6; // scale glitch with beat strength
      }
      if (clip.glitchActiveFrames > 0) {
        triggerGlitch = true;
      }
    } else {
      const frequency = settings.glitchFrequency !== undefined ? settings.glitchFrequency : 0.3;
      if (Math.random() < 0.015 * frequency && clip.glitchActiveFrames === 0 && clip.glitchCooldown === 0) {
        clip.glitchActiveFrames = 4 + Math.floor(Math.random() * 6);
        clip.glitchCooldown = 25;
      }
      if (clip.glitchActiveFrames > 0) {
        triggerGlitch = true;
      }
    }

    // 5. Draw VHS tape glitch (slice shearing and color tint band)
    if (triggerGlitch) {
      ctx.save();
      const sliceCount = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < sliceCount; i++) {
        const sy = Math.random() * h;
        const sh = 5 + Math.random() * 50;
        const offset = (Math.random() - 0.5) * 25 * glitchIntensity;
        ctx.drawImage(ctx.canvas, 0, sy, w, sh, offset, sy, w, sh);
      }

      // Add dynamic color distortion bar
      if (Math.random() < 0.4) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.06)";
        ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 15);
      }
      ctx.restore();
    }
  },

  onSettings(clip) {
    const selectedClip = clip || State.timelineClips.find(c => c.id === State.selectedClipId && c.type === 'filmgrain');
    if (!selectedClip) return null;

    // Ensure defaults exist
    if (selectedClip.settings.grainIntensity === undefined) selectedClip.settings.grainIntensity = 0.15;
    if (selectedClip.settings.scanlinesOpacity === undefined) selectedClip.settings.scanlinesOpacity = 0.08;
    if (selectedClip.settings.glitchFrequency === undefined) selectedClip.settings.glitchFrequency = 0.3;
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
          m("span", { class: "text-xs font-bold text-slate-300" }, "Audio Reactive Glitch"),
        ]),
        m("p", { class: "text-[10px] text-slate-500 mt-1" }, "VHS screen glitches will trigger instantly in sync with music bass drops")
      ]),

      // Grain Slider
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider" }, `Film Grain: ${Math.round(selectedClip.settings.grainIntensity * 100)}%`),
        m("input", {
          type: "range",
          min: 0.0,
          max: 0.6,
          step: 0.02,
          class: "w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500",
          value: selectedClip.settings.grainIntensity,
          oninput: (e) => {
            selectedClip.settings.grainIntensity = parseFloat(e.target.value);
          }
        }),
        m("div", { class: "flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono" }, [
          m("span", "None"),
          m("span", "Heavy")
        ])
      ]),

      // Scanline Slider
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider" }, `Scanlines: ${Math.round(selectedClip.settings.scanlinesOpacity * 100)}%`),
        m("input", {
          type: "range",
          min: 0.0,
          max: 0.4,
          step: 0.02,
          class: "w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500",
          value: selectedClip.settings.scanlinesOpacity,
          oninput: (e) => {
            selectedClip.settings.scanlinesOpacity = parseFloat(e.target.value);
          }
        }),
        m("div", { class: "flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono" }, [
          m("span", "None"),
          m("span", "Visible")
        ])
      ]),

      // Glitch Frequency Slider
      m("div", { class: "bg-slate-800/40 p-3 rounded-lg border border-slate-700/50" }, [
        m("label", { class: "block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider" }, `Glitch Frequency / Size: ${Math.round(selectedClip.settings.glitchFrequency * 100)}%`),
        m("input", {
          type: "range",
          min: 0.0,
          max: 1.0,
          step: 0.05,
          class: "w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500",
          value: selectedClip.settings.glitchFrequency,
          oninput: (e) => {
            selectedClip.settings.glitchFrequency = parseFloat(e.target.value);
          }
        }),
        m("div", { class: "flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono" }, [
          m("span", "Off"),
          m("span", "Extreme")
        ])
      ])
    ]);
  }
};
