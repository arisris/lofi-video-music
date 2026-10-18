import { State } from "../state";
import { FilmGrainSettingsView } from "../../components/clip-settings/vfx/filmgrain";
import { getAudioReactivity } from "../../utils/helpers";

export const FilmGrainVFX = {
  id: "filmgrain",
  name: "Film Grain & VHS",
  icon: "icon-[ri--tv-line]",

  settings: {
    grainIntensity: 0.15,
    scanlinesOpacity: 0.08,
    glitchFrequency: 0.3,
    audioReactive: false,
  },

  drawItem(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
    _localTime: number,
    clip: Record<string, any>,
  ) {
    // 1. Initialize Offscreen Noise Canvas (once)
    if (!clip.noiseCanvas) {
      const nSize = 128;
      clip.noiseCanvas = document.createElement("canvas");
      clip.noiseCanvas.width = nSize;
      clip.noiseCanvas.height = nSize;
      const nCtx = clip.noiseCanvas.getContext("2d") as CanvasRenderingContext2D;
      const imgData = nCtx.createImageData(nSize, nSize);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val; // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = 40; // Alpha (intensity of noise)
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

  onSettings: FilmGrainSettingsView,
};
