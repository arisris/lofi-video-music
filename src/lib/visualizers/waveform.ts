import { runtime } from "../runtime";
import { hexToHSL } from "../../utils/helpers";

export const WaveformVisualizer = {
  id: "waveform",
  name: "Waveform",
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    settings: Record<string, any>,
  ) {
    const { color, intensity, density, rainbow } = settings;
    const centerY = h / 2;
    runtime.analyser.getByteTimeDomainData(runtime.dataArray);

    const step = Math.max(1, Math.floor(density));
    const sliceWidth = (w * step) / runtime.analyser.frequencyBinCount;
    let x = 0;

    ctx.shadowBlur = 10;

    if (rainbow) {
      const baseHsl = hexToHSL(color || "#3b82f6");
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        const hue = (baseHsl.h + ratio * 360) % 360;
        const sat = Math.max(70, baseHsl.s);
        const lig = Math.max(45, Math.min(65, baseHsl.l));
        grad.addColorStop(ratio, `hsl(${hue}, ${sat}%, ${lig}%)`);
      }
      ctx.strokeStyle = grad;
      ctx.shadowColor = `hsl(${baseHsl.h}, 80%, 55%)`;
    } else {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
    }

    ctx.beginPath();
    for (let i = 0; i < runtime.analyser.frequencyBinCount; i += step) {
      const v = runtime.dataArray[i] / 128.0;
      const dy = (v - 1) * intensity;
      const y = centerY + (dy * h) / 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(w, centerY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    runtime.analyser.getByteFrequencyData(runtime.dataArray);
  },
};
