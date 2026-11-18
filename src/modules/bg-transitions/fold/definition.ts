/**
 * Page fold: a real paper fold, not a wipe.
 *
 * The OUTGOING clip is the sheet being folded. A crease sweeps right→left;
 * the flap beyond it rotates through edge-on and lands mirrored on the fixed
 * half, exposing its backside. The incoming clip is the page underneath.
 * Both sides arrive as paint callbacks, so this definition owns the order.
 */
import type { BgTransitionDefinition } from "../_core/types";
import { baseOpacity, scaleSettings } from "../_core/types";

export const foldTransition: BgTransitionDefinition = {
  type: "fold",
  // No predecessor: there is no sheet to fold, so blend in with a fade.
  paint({ clip, base, phase, paint }) {
    paint(clip, scaleSettings(base, baseOpacity(base) * phase, 1));
  },
  pair(ctx, w, h, progress, paintIncoming, paintOutgoing) {
    paintIncoming();

    const crease = w * (1 - progress);
    const cos = Math.cos(progress * Math.PI);

    // Fixed half of the sheet: everything left of the crease stays put.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, crease, h);
    ctx.clip();
    paintOutgoing();
    ctx.restore();

    // Shadow cast by the flap onto the fixed half, just inside the crease.
    const SHADOW_W = Math.max(20, w * 0.055);
    const sg = ctx.createLinearGradient(crease - SHADOW_W, 0, crease, 0);
    sg.addColorStop(0, "rgba(0,0,0,0)");
    sg.addColorStop(
      1,
      `rgba(0,0,0,${(0.32 * Math.min(1, Math.abs(cos) + 0.4)).toFixed(3)})`,
    );
    ctx.fillStyle = sg;
    ctx.fillRect(crease - SHADOW_W, 0, SHADOW_W, h);

    // Edge-on: the flap has no visible area.
    if (Math.abs(cos) < 0.002) {
      paintCrease(ctx, h, crease, 0.65);
      return;
    }

    // Flip the right-hand flap about the crease. cos>0: still on the right,
    // front face up. cos<0: it has crossed over — we see the backside.
    ctx.save();
    ctx.translate(crease, 0);
    ctx.scale(cos, 1);
    ctx.translate(-crease, 0);
    ctx.beginPath();
    ctx.rect(crease, 0, w - crease, h);
    ctx.clip();
    paintOutgoing();
    if (cos < 0) {
      // Paper backside: warm, slightly translucent, darker toward the tip.
      const bg = ctx.createLinearGradient(crease, 0, w, 0);
      bg.addColorStop(0, "rgba(255,250,235,0.14)");
      bg.addColorStop(0.45, "rgba(146,132,112,0.36)");
      bg.addColorStop(1, "rgba(38,32,26,0.58)");
      ctx.fillStyle = bg;
      ctx.fillRect(crease, 0, w - crease, h);
    } else {
      // Front face darkens toward the crease as it lifts.
      const fg = ctx.createLinearGradient(crease, 0, w, 0);
      fg.addColorStop(0, "rgba(0,0,0,0.34)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(crease, 0, w - crease, h);
    }
    ctx.restore();

    paintCrease(ctx, h, crease, 0.45 + 0.25 * Math.abs(cos));
  },
};

/** Thin bright highlight along the fold. */
function paintCrease(
  ctx: CanvasRenderingContext2D,
  h: number,
  x: number,
  alpha: number,
): void {
  const g = ctx.createLinearGradient(x - 2.5, 0, x + 2.5, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, `rgba(255,255,255,${alpha.toFixed(3)})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 2.5, 0, 5, h);
}
