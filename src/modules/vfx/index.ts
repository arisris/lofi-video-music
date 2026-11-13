import { createRegistry } from "../clips/_core/registry";
import type { VfxDefinition } from "./_core/types";
import { filmGrainVfx } from "./film-grain/definition";
import { firefliesVfx } from "./fireflies/definition";
import { flashVfx } from "./flash/definition";
import { rainGpuVfx } from "./rain-gpu/definition";
import { rainVfx } from "./rain/definition";
import { smokeVfx } from "./smoke/definition";
import { snowVfx } from "./snow/definition";
import { vignetteVfx } from "./vignette/definition";

// rain-gpu is the WebGL-shader variant of the canvas-2D rain effect.
export const vfxRegistry = createRegistry<VfxDefinition>();

for (const def of [rainVfx, rainGpuVfx, snowVfx, smokeVfx, firefliesVfx, flashVfx, filmGrainVfx, vignetteVfx]) {
  vfxRegistry.register(def);
}

/** Per-effect tab/palette icon (used by VfxPanel + timeline blocks). */
export const VFX_ICONS: Record<string, string> = {
  rain: "icon-[ri--rainy-line]",
  rain_gpu: "icon-[ri--rainy-line]",
  snow: "icon-[ri--snowy-line]",
  smoke: "icon-[ri--mist-line]",
  fireflies: "icon-[ri--bug-line]",
  flash: "icon-[ri--flashlight-line]",
  filmgrain: "icon-[ri--film-line]",
  vignette: "icon-[ri--circle-line]",
};
