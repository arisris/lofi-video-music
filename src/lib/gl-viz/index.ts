// Entry point for the glviz shader visualizer system.
//
// Importing this module registers every definition. Adding a visualizer is one
// file in defs/ plus one line here; nothing else in the codebase needs to know
// it exists.

import { registerVisualizer } from "./registry";
import { AuraVisualizer } from "./defs/aura";
import { BarsVisualizer } from "./defs/bars";
import { KaleidoscopeVisualizer } from "./defs/kaleidoscope";

registerVisualizer(AuraVisualizer);
registerVisualizer(BarsVisualizer);
registerVisualizer(KaleidoscopeVisualizer);

export * from "./types";
export * from "./registry";
export { drawVisualizer, resolveBBox } from "./engine";