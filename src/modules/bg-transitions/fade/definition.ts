/** Fade: opacity ramp only. Used for both head and (gap) tail. */
import type { BgTransitionDefinition } from "../_core/types";
import { baseOpacity, scaleSettings } from "../_core/types";

export const fadeTransition: BgTransitionDefinition = {
  type: "fade",
  paint({ clip, base, phase, paint }) {
    paint(clip, scaleSettings(base, baseOpacity(base) * phase, 1));
  },
};
