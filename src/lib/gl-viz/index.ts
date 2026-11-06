// Entry point for the glviz shader visualizer system.
//
// Importing this module registers every definition. Adding a visualizer is one
// file in defs/ plus one line here; nothing else in the codebase needs to know
// it exists.

import { registerVisualizer } from "./registry";
import { AuraVisualizer } from "./defs/aura";
import { BarsVisualizer } from "./defs/bars";
import { KaleidoscopeVisualizer } from "./defs/kaleidoscope";
import { CircleVisualizer } from "./defs/circle";
import { WaveformVisualizer } from "./defs/waveform";
import { LiquidWavesVisualizer } from "./defs/liquid-waves";
import { NebulaVisualizer } from "./defs/nebula";
import { VinylVisualizer } from "./defs/vinyl";
import { OrbVisualizer } from "./defs/orb";
import { TunnelVisualizer } from "./defs/tunnel";
import { LissajousVisualizer } from "./defs/lissajous";

registerVisualizer(AuraVisualizer);
registerVisualizer(BarsVisualizer);
registerVisualizer(KaleidoscopeVisualizer);
registerVisualizer(CircleVisualizer);
registerVisualizer(WaveformVisualizer);
registerVisualizer(LiquidWavesVisualizer);
registerVisualizer(NebulaVisualizer);
registerVisualizer(VinylVisualizer);
registerVisualizer(OrbVisualizer);
registerVisualizer(TunnelVisualizer);
registerVisualizer(LissajousVisualizer);

export * from "./types";
export * from "./registry";
export { drawVisualizer, resolveBBox } from "./engine";
