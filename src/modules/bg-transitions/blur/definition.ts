/** Blur dissolve: focus pull through a soft full-frame blur. */
import { easeInCubic, easeOutCubic } from "../../../shared/lib/transitions";
import type { BgTransitionDefinition } from "../_core/types";
import { baseOpacity, scaleSettings } from "../_core/types";

const BLUR_MAX = 16;

export const blurTransition: BgTransitionDefinition = {
  type: "blur",
  paint({ ctx, clip, base, phase, kind, paint }) {
    const eased = kind === "head" ? easeOutCubic(phase) : phase;
    const blur = (1 - eased) * BLUR_MAX;
    const settings = scaleSettings(base, baseOpacity(base) * phase, 1);
    // Filter lives inside the caller's save/restore scope so it cannot leak
    // into the next layer; skip the pass entirely once we're sharp.
    if (blur > 0.05) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    try {
      paint(clip, settings);
    } finally {
      if (blur > 0.05) ctx.filter = "none";
    }
  },
  outgoing(phase) {
    return { blur: easeInCubic(phase) * BLUR_MAX };
  },
};
