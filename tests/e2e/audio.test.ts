// Audio path: the shared analyser, the legacy visualizer that must not
// regress, and the peak-hold state the bars depend on.

import { describe, test, expect, afterAll } from "bun:test";
import { withApp, shutdown, TIMEOUT, type TestPage } from "./harness";

/** test() plus the harness wrapper, so every case carries the real budget. */
const e2e = (name: string, body: (page: TestPage) => Promise<void>) =>
  test(name, () => withApp(body), TIMEOUT);

afterAll(shutdown);

describe("analyser", () => {
  e2e("reports real spectrum data while playing", async () => {
    // Everything audio-reactive downstream is checked against this. A silent
    // analyser makes every visualizer look identically broken, which hides
    // which layer actually failed.
    await withApp(async (t) => {
      const r = await t.eval<{ present: boolean; bins?: number; max?: number; quiet?: number }>(
        `(async () => {
          const e = window.__e2e;
          await e.addMusic("sweep");
          (await e.audio()).playAudio();
          await e.wait(1200);
          const { runtime } = await import("/src/lib/runtime.ts");
          const an = runtime.analyser;
          if (!an) return { present: false };
          const buf = new Float32Array(an.frequencyBinCount);
          an.getFloatFrequencyData(buf);
          let max = -Infinity, quiet = 0;
          for (const v of buf) { if (v > max) max = v; if (v < -110) quiet++; }
          return { present: true, bins: buf.length, max, quiet };
        })()`,
      );

      expect(r.present).toBe(true);
      expect(r.max!).toBeGreaterThan(-60);
      // Most of the spectrum is genuinely silent, so the decibel window has to
      // span the audible range rather than assume everything is loud.
      expect(r.quiet!).toBeGreaterThan(r.bins! / 4);
    });
  });
});

describe("legacy visualizer", () => {
  e2e("still renders off the same analyser", async () => {
    // gl-viz reads getFloatFrequencyData and applies its own decibel window;
    // the legacy clip reads the byte array. Neither may disturb the other.
    await withApp(async (t) => {
      const lit = await t.eval<number>(`(async () => {
        const e = window.__e2e;
        await e.addMusic("chord");
        await e.addClip("visualizer", {});
        (await e.audio()).playAudio();
        await e.select(null);
        await e.wait(1400);
        const c = e.canvas(), g = e.ctx2d();
        const d = g.getImageData(0, Math.round(c.height * 0.55), c.width,
                                 Math.round(c.height * 0.35)).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 120) n++;
        return n;
      })()`);
      expect(lit).toBeGreaterThan(50);
    });
  });
});

describe("peak hold", () => {
  e2e("draws a cap above bars that have fallen back", async () => {
    // The hold lives in a second texture row because a peak has to survive
    // across frames. It should appear on falling bars and stay away during a
    // sustained passage.
    await withApp(async (t) => {
      await t.eval(`(async () => {
        const e = window.__e2e;
        await e.addMusic("drums");
        (await e.audio()).playAudio();
        await e.addClip("glviz", { style: "bars" });
        await e.wait(2600);
      })()`);

      const r = await t.eval<{ caps: number; bars: number }>(`(async () => {
        const e = window.__e2e;
        const def = (await e.glviz()).resolveVisualizerDef("bars");
        const W = 1280, H = 360, baseRow = Math.round(H * 0.32);
        const img = await e.renderDef("bars", {}, W, H, true);
        const lit = (x, y) => { const p = e.pixelAt(img, x, y); return p[0] + p[1] + p[2] > 90; };

        let caps = 0;
        for (let b = 0; b < def.settings.bars; b++) {
          const x = Math.round((b + 0.5) * W / def.settings.bars);
          const runs = [];
          let cur = null;
          for (let y = 0; y < baseRow; y++) {
            if (lit(x, y)) { if (!cur) cur = { from: y, to: y }; else cur.to = y; }
            else if (cur) { runs.push(cur); cur = null; }
          }
          if (cur) runs.push(cur);

          const solid = runs.filter(r => r.to - r.from > 4);
          const thin = runs.filter(r => r.to - r.from <= 4);
          if (!solid.length) continue;
          const barTop = solid[0].from;
          // A cap is a thin run floating above the bar, separated by a gap.
          if (thin.some(r => r.to < barTop - 1)) caps++;
        }
        return { caps, bars: def.settings.bars };
      })()`);

      expect(r.caps).toBeGreaterThan(0);
      expect(r.caps).toBeLessThan(r.bars);
    });
  });
});