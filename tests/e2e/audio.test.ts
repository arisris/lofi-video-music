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
      const r = await t.eval<{
        present: boolean;
        max?: number;
        min?: number;
        loud?: number;
      }>(`(async () => {
          const e = window.__e2e;
          await e.addMusic(4);
          (await e.audio()).playAudio();
          await e.wait(1200);
          const { runtime } = await import("/src/lib/runtime.ts");
          const an = runtime.analyser;
          if (!an) return { present: false };
          const buf = new Float32Array(an.frequencyBinCount);
          an.getFloatFrequencyData(buf);
          let max = -Infinity, min = Infinity, loud = 0;
          for (const v of buf) {
            if (v > max) max = v;
            if (v < min) min = v;
            if (v > -110) loud++;
          }
          return { present: true, max, min, loud };
        })()`);

      expect(r.present).toBe(true);
      expect(r.max!).toBeGreaterThan(-60);
      // The top of the spectrum is still empty, so the reading spans a real
      // dynamic range instead of every bin landing on the same number.
      expect(r.min!).toBeLessThan(-90);
      // And it is a spread rather than a uniform wall of signal.
      expect(r.loud!).toBeGreaterThan(20);
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
        await e.addMusic(8);
        (await e.audio()).playAudio();
        await e.addClip("glviz", { style: "bars" });
        await e.wait(2600);
      })()`);

      const r = await t.eval<{
        caps: number;
        frames: number;
        bars: number;
      }>(`(async () => {
        const e = window.__e2e;
        const def = (await e.glviz()).resolveVisualizerDef("bars");
        const W = 1280, H = 360, baseRow = Math.round(H * 0.32);
        const lit = (img, x, y) => { const p = e.pixelAt(img, x, y); return p[0] + p[1] + p[2] > 90; };

        const capsIn = (img) => {
          let caps = 0;
          for (let b = 0; b < def.settings.bars; b++) {
            const x = Math.round((b + 0.5) * W / def.settings.bars);
            const runs = [];
            let cur = null;
            for (let y = 0; y < baseRow; y++) {
              if (lit(img, x, y)) { if (!cur) cur = { from: y, to: y }; else cur.to = y; }
              else if (cur) { runs.push(cur); cur = null; }
            }
            if (cur) runs.push(cur);

            const solid = runs.filter((r) => r.to - r.from > 4);
            const thin = runs.filter((r) => r.to - r.from <= 4);
            if (!solid.length) continue;
            const barTop = solid[0].from;
            // A cap is a thin run floating above the bar, separated by a gap.
            if (thin.some((r) => r.to < barTop - 1)) caps++;
          }
          return caps;
        };

        // Real music rises and falls, so one frame can easily land on a passage
        // where nothing has dropped yet and no bar has a cap. Sweep a window
        // and count across it: the peak has to be visible somewhere.
        let caps = 0, frames = 0;
        for (let i = 0; i < 8; i++) {
          caps += capsIn(await e.renderDef("bars", {}, W, H, true));
          frames++;
          await e.wait(150);
        }
        return { caps, frames, bars: def.settings.bars };
      })()`);

      expect(r.caps).toBeGreaterThan(0);
      // Not every bar is capped at once - the hold marks a fall, not the level.
      expect(r.caps).toBeLessThan(r.bars * r.frames);
    });
  });
});
