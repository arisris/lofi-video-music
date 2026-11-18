/** Cross zoom: incoming settles 1.15→1.0, outgoing punches 1.0→1.08. */
import { easeInCubic, easeOutCubic } from "../../../shared/lib/transitions";
import type { BgTransitionDefinition } from "../_core/types";
import { baseOpacity, scaleSettings } from "../_core/types";

export const zoomTransition: BgTransitionDefinition = {
  type: "zoom",
  paint({ clip, base, phase, kind, paint }) {
    // Tail is a plain fade — zooming out into a black gap reads as a glitch.
    const scale = kind === "head" ? 1.15 - 0.15 * easeOutCubic(phase) : 1;
    paint(clip, scaleSettings(base, baseOpacity(base) * phase, scale));
  },
  outgoing(phase) {
    return { scale: 1 + 0.08 * easeInCubic(phase) };
  },
};
