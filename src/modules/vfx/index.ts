import { createRegistry } from "../clips/_core/registry";
import type { VfxDefinition } from "./_core/types";
import { confettiVfx } from "./confetti/definition";
import { filmGrainVfx } from "./film-grain/definition";
import { firefliesVfx } from "./fireflies/definition";
import { fireworksVfx } from "./fireworks/definition";
import { flashVfx } from "./flash/definition";
import { rainGpuVfx } from "./rain-gpu/definition";
import { rainVfx } from "./rain/definition";
import { smokeVfx } from "./smoke/definition";
import { snowVfx } from "./snow/definition";
import { vignetteVfx } from "./vignette/definition";

// rain-gpu is the WebGL-shader variant of the canvas-2D rain effect.
export const vfxRegistry = createRegistry<VfxDefinition>((e) => e.type);

for (const def of [
  rainVfx,
  rainGpuVfx,
  snowVfx,
  smokeVfx,
  firefliesVfx,
  flashVfx,
  filmGrainVfx,
  vignetteVfx,
  confettiVfx,
  fireworksVfx,
]) {
  vfxRegistry.register(def);
}
