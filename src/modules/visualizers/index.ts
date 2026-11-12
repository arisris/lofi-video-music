import { registerVisualizer } from "./_core/registry";
import { AuraVisualizer } from "./defs/aura";
import { BarsVisualizer } from "./defs/bars";
import { CircleVisualizer } from "./defs/circle";
import { KaleidoscopeVisualizer } from "./defs/kaleidoscope";
import { LiquidWavesVisualizer } from "./defs/liquid-waves";
import { LissajousVisualizer } from "./defs/lissajous";
import { OrbVisualizer } from "./defs/orb";
import { TunnelVisualizer } from "./defs/tunnel";
import { VinylVisualizer } from "./defs/vinyl";
import { WaveformVisualizer } from "./defs/waveform";

for (const def of [
  AuraVisualizer,
  BarsVisualizer,
  CircleVisualizer,
  KaleidoscopeVisualizer,
  LiquidWavesVisualizer,
  LissajousVisualizer,
  OrbVisualizer,
  TunnelVisualizer,
  VinylVisualizer,
  WaveformVisualizer,
]) {
  registerVisualizer(def);
}

export * from "./_core/types";
export * from "./_core/registry";
export { drawVisualizer, resolveBBox } from "./_core/engine";
