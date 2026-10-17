import { State } from "../state";

export const LiquidWavesVisualizer = {
  id: "liquid_waves",
  name: "Liquid Wave",
  draw(ctx, w, h, settings) {
    const { color, intensity, rainbow, opacity } = settings;
    const time = performance.now() * 0.0015;
    const baseCenterY = h * 0.72;
    
    let bass = 0;
    for (let i = 0; i < 8; i++) bass += State.dataArray[i] || 0;
    bass = (bass / 8) / 255;
    
    let mids = 0;
    const midStart = Math.floor(State.dataArray.length * 0.15);
    for (let i = 0; i < 16; i++) mids += State.dataArray[midStart + i] || 0;
    mids = (mids / 16) / 255;
    
    let highs = 0;
    const highStart = Math.floor(State.dataArray.length * 0.5);
    for (let i = 0; i < 24; i++) highs += State.dataArray[highStart + i] || 0;
    highs = (highs / 24) / 255;
    
    const waveSpecs = [
      { amp: 65 * intensity, freq: 0.003, speed: time * 0.8, val: bass, opacity: 0.35, colorShift: 0 },
      { amp: 45 * intensity, freq: 0.007, speed: -time * 1.2, val: mids, opacity: 0.45, colorShift: 60 },
      { amp: 22 * intensity, freq: 0.015, speed: time * 1.8, val: highs, opacity: 0.55, colorShift: 120 }
    ];
    
    waveSpecs.forEach((spec) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, h);
      
      for (let x = 0; x <= w; x += 12) {
        const displacement = Math.sin(x * spec.freq + spec.speed) * (spec.amp * (0.3 + spec.val * 1.7));
        const y = baseCenterY + displacement;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      
      const grad = ctx.createLinearGradient(0, baseCenterY - 100, 0, h);
      if (rainbow) {
        const hue1 = (time * 12 + spec.colorShift) % 360;
        const hue2 = (hue1 + 100) % 360;
        grad.addColorStop(0, `hsla(${hue1}, 80%, 60%, ${spec.opacity * opacity})`);
        grad.addColorStop(1, `hsla(${hue2}, 80%, 40%, 0.05)`);
        ctx.strokeStyle = `hsl(${hue1}, 95%, 72%)`;
      } else {
        grad.addColorStop(0, color + Math.floor(spec.opacity * opacity * 255).toString(16).padStart(2, '0'));
        grad.addColorStop(1, color + "05");
        ctx.strokeStyle = color;
      }
      
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  }
};
