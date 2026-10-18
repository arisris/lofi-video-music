// Shader visualizers: the gl-viz system, its engine and the three definitions.

import { describe, test, expect, afterAll } from "bun:test";
import { withApp, shutdown, TIMEOUT, type TestPage } from "./harness";

/** test() plus the harness wrapper, so every case carries the real budget. */
const e2e = (name: string, body: (page: TestPage) => Promise<void>) =>
  test(name, () => withApp(body), TIMEOUT);

afterAll(shutdown);

describe("gl-viz shared WebGL canvas", () => {
  e2e("two visualizers each land in their own rectangle", async () => {
    // The canvas is shared, so the isolation comes from the viewport and a
    // scissored clear. Without the scissor the second visualizer's clear wipes
    // the first one's pixels and the strip renders blank.
    await withApp(async (t) => {
      const r = await t.eval<{
        inA: number;
        inB: number;
        leaked: number;
      }>(`(async () => {
        const e = window.__e2e;
        const S = 1280, H = 720;
        const off = document.createElement("canvas");
        off.width = S; off.height = H;
        const octx = off.getContext("2d");
        const boxA = { x: 0, y: 360, width: 1280, height: 360 };
        const boxB = { x: 345, y: 65, width: 590, height: 590 };

        await e.addMusic(5);
        (await e.audio()).playAudio();
        await e.wait(800);

        for (const box of [boxA, boxB]) await e.drawDef("bars", {}, octx, box, true);

        const d = octx.getImageData(0, 0, S, H).data;
        const hit = (x, y) => { const i = (y * S + x) * 4; return d[i] + d[i+1] + d[i+2] > 60; };
        const count = (bx, by, bw, bh) => {
          let c = 0;
          for (let y = Math.max(0, by); y < Math.min(H, by + bh); y += 2)
            for (let x = Math.max(0, bx); x < Math.min(S, bx + bw); x += 2) if (hit(x, y)) c++;
          return c;
        };
        return {
          inA: count(boxA.x, boxA.y, boxA.width, boxA.height),
          inB: count(boxB.x, boxB.y, boxB.width, boxB.height),
          leaked: count(0, 0, S, boxA.y - 4) - count(boxB.x, 0, boxB.width, boxA.y - 4),
        };
      })()`);

      expect(r.inA).toBeGreaterThan(500);
      expect(r.inB).toBeGreaterThan(500);
      expect(r.leaked).toBeLessThanOrEqual(0);
    });
  });

  e2e(
    "the canvas is sized to the destination, not resized per draw",
    async () => {
      await withApp(async (t) => {
        const r = await t.eval<{
          sizes: string[];
          matches: boolean;
        }>(`(async () => {
        const e = window.__e2e;
        // Only a draw sizes the shared canvas, so there has to be something to
        // draw before its dimensions mean anything.
        await e.addClip("glviz", { style: "bars" });
        await e.wait(600);
        const gl = await e.webgl().then(m => m.WebGLRenderer.getCanvas());
        const sizes = [];
        for (let i = 0; i < 4; i++) { sizes.push(gl.width + "x" + gl.height); await e.wait(120); }
        const c = e.canvas();
        return { sizes, matches: gl.width === c.width && gl.height === c.height };
      })()`);
        expect(new Set(r.sizes).size).toBe(1);
        expect(r.matches).toBe(true);
      });
    },
  );
});

describe("kaleidoscope", () => {
  e2e("renders after the audio texture grew a second row", async () => {
    // The texture is two rows now. Sampling the midpoint by accident blends the
    // live reading with the decaying peak and the style quietly goes dull.
    await withApp(async (t) => {
      await t.eval(`(async () => {
        const e = window.__e2e;
        await e.addClip("glviz", { style: "kaleidoscope" });
        await e.select(null);
        await e.wait(900);
      })()`);

      // Counted in the page: a whole pixel buffer cannot survive the trip over
      // the devtools protocol, and a silently empty result looks like a
      // rendering failure rather than a transport one.
      const lit = await t.eval<number>(`(async () => {
        const e = window.__e2e;
        const img = await e.renderDef("kaleidoscope", {}, 256, 256, true);
        let n = 0;
        for (let i = 0; i < img.pixels.length; i += 4) if (img.pixels[i + 3] > 12) n++;
        return n;
      })()`);
      expect(lit).toBeGreaterThan(3000);
    });
  });

  e2e("stays round instead of showing square corners", async () => {
    await withApp(async (t) => {
      // An unmistakable background colour behind the pattern: anything not
      // lime outside the circle is the square leaking through again.
      const r = await t.eval<{
        outside: number;
        total: number;
        centre: number[];
      }>(`(async () => {
        const e = window.__e2e;
        const S = 300;
        const img = await e.renderDef("kaleidoscope", { background: "#00ff00ff" }, S, S, false);
        const isBg = p => p[1] > 190 && p[0] < 90 && p[2] < 90;
        let outside = 0, total = 0;
        for (let y = 2; y < S - 2; y += 2) for (let x = 2; x < S - 2; x += 2) {
          if (Math.hypot((x - 150) / 298, (y - 150) / 298) <= 0.5) continue;
          total++;
          if (!isBg(e.pixelAt(img, x, y))) outside++;
        }
        return { outside, total, centre: e.pixelAt(img, 150, 150) };
      })()`);

      expect(r.outside).toBe(0);
      expect(r.total).toBeGreaterThan(1000);
      expect(r.centre[0]).toBeGreaterThan(90);
    });
  });
});

describe("bars", () => {
  e2e("puts the bass in the middle and stays inside the quad", async () => {
    await withApp(async (t) => {
      await t.eval(`(async () => {
        const e = window.__e2e;
        await e.addMusic(5);
        (await e.audio()).playAudio();
        await e.addClip("glviz", { style: "bars" });
        await e.select(null);
        await e.wait(1600);
      })()`);

      const r = await t.eval<{
        baseRow: number;
        tallest: number;
        asymmetry: number;
        left: number;
        right: number;
      }>(`(async () => {
        const e = window.__e2e;
        const def = (await e.glviz()).resolveVisualizerDef("bars");
        const W = 1280, H = 360, baseRow = Math.round(H * 0.32);
        const img = await e.renderDef("bars", {}, W, H, true);

        // Measure downward from the top of the strip. Measuring upward from the
        // baseline reports 0 for a bar that reaches full height, which is how a
        // saturated display reports itself as empty.
        const hs = [];
        for (let b = 0; b < def.settings.bars; b++) {
          const x = Math.round((b + 0.5) * W / def.settings.bars);
          let first = -1;
          for (let y = 0; y < baseRow; y++) {
            const p = e.pixelAt(img, x, y);
            if (p[0] + p[1] + p[2] > 90) { first = y; break; }
          }
          hs.push(first < 0 ? 0 : baseRow - first);
        }
        let asymmetry = 0;
        for (let i = 0; i < hs.length; i++) {
          asymmetry = Math.max(asymmetry, Math.abs(hs[i] - hs[hs.length - 1 - i]));
        }
        const half = Math.floor(hs.length / 2);
        const sum = a => a.reduce((x, y) => x + y, 0);
        return { baseRow, tallest: Math.max(...hs), asymmetry,
                 left: sum(hs.slice(0, half)), right: sum(hs.slice(half)) };
      })()`);

      expect(r.tallest).toBeLessThanOrEqual(r.baseRow);
      expect(r.asymmetry).toBeLessThanOrEqual(r.baseRow * 0.35);
      // Balanced: neither half may dominate the strip.
      expect(
        Math.abs(r.left - r.right) / Math.max(1, r.left + r.right),
      ).toBeLessThan(0.35);
    });
  });

  e2e("the spectrum is not clipped flat", async () => {
    await withApp(async (t) => {
      await t.eval(`(async () => {
        const e = window.__e2e;
        await e.addMusic(5);
        (await e.audio()).playAudio();
        await e.addClip("glviz", { style: "bars" });
        await e.wait(1600);
      })()`);

      const r = await t.eval<{
        baseRow: number;
        visible: number;
        clipped: number;
        spread: number;
      }>(
        `(async () => {
          const e = window.__e2e;
          const def = (await e.glviz()).resolveVisualizerDef("bars");
          const W = 1280, H = 360, baseRow = Math.round(H * 0.32);
          const img = await e.renderDef("bars", {}, W, H, true);
          const hs = [];
          for (let b = 0; b < def.settings.bars; b++) {
            const x = Math.round((b + 0.5) * W / def.settings.bars);
            let first = -1;
            for (let y = 0; y < baseRow; y++) {
              const p = e.pixelAt(img, x, y);
              if (p[0] + p[1] + p[2] > 90) { first = y; break; }
            }
            hs.push(first < 0 ? 0 : baseRow - first);
          }
          const tall = hs.filter(h => h > 3);
          return {
            baseRow, visible: tall.length,
            clipped: hs.filter(h => h >= baseRow - 2).length,
            spread: tall.length ? Math.max(...tall) - Math.min(...tall) : 0,
          };
        })()`,
      );

      // Every audible band arriving near full scale is the byte-array decibel
      // window pinning the whole spectrum to the ceiling.
      expect(r.clipped).toBe(0);
      expect(r.visible).toBeGreaterThan(10);
      expect(r.spread).toBeGreaterThan(r.baseRow * 0.3);
    });
  });
});

describe("inspector fields", () => {
  e2e("an alpha colour field can be returned to transparent", async () => {
    // The native colour picker has no alpha channel in the HTML spec and hands
    // back six digits, which silently drops the alpha byte.
    await withApp(async (t) => {
      await t.eval(`(async () => {
        const e = window.__e2e;
        const id = await e.addClip("glviz", { style: "kaleidoscope" });
        await e.select(id);
        await e.wait(700);
      })()`);

      const r = await t.eval<{
        missing?: boolean;
        trail?: string[];
      }>(`(async () => {
        const e = window.__e2e;
        const label = [...document.querySelectorAll("label")]
          .find(l => l.textContent?.trim().startsWith("Background"));
        const group = label?.closest("div");
        const swatch = group?.querySelector('input[type="color"]');
        const sliders = group?.querySelectorAll('input[type="range"]');
        if (!swatch || !sliders?.length) return { missing: true };

        const setValue = (el, v) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const read = async () => (await e.clipsOfType("glviz")).pop().settings.background;

        const trail = [String(await read())];
        // Opacity first, so the colour change below starts from a known state.
        setValue(sliders[sliders.length - 1], 1); await e.wait(300); trail.push(String(await read()));
        setValue(swatch, "#00ff00"); await e.wait(300); trail.push(String(await read()));
        setValue(sliders[sliders.length - 1], 0); await e.wait(300); trail.push(String(await read()));
        return { trail };
      })()`);

      expect(r.missing).toBeUndefined();
      // Transparent by default, opaque once asked, colour change keeps that
      // opacity, and zero puts it back.
      expect(r.trail?.[0]).toBe("#00000000");
      expect(r.trail?.[1]).toBe("#000000ff");
      expect(r.trail?.[2]).toBe("#00ff00ff");
      expect(r.trail?.[3]).toBe("#00ff0000");
    });
  });
});
describe("gl-viz Aura", () => {
  // Aura shows its picture instead of folding it. These pin the two properties
  // that make it a different thing from the kaleidoscope: the silhouette is a
  // bounded shape rather than a full-frame pattern, and the picture reaches the
  // screen at its own proportions.

  e2e("draws a bounded silhouette, not a full-frame wash", async () => {
    await withApp(async (t) => {
      const r = await t.eval<{
        centre: number;
        corner: number;
        edge: number;
      }>(`(async () => {
        const e = window.__e2e;
        const N = 200;
        // Opaque fill and no glow, so the alpha channel alone says where the
        // shape is and nothing else can colour it in.
        const img = await e.renderDef("aura",
          { glow: 0, fill: "#ffffff", background: "#00000000" }, N, N);
        const a = (x, y) => img.pixels[(y * N + x) * 4 + 3];
        return { centre: a(100, 100), corner: a(2, 2), edge: a(100, 6) };
      })()`);

      expect(r.centre).toBe(255);
      expect(r.edge).toBe(0);
      expect(r.corner).toBe(0);
    });
  });

  e2e("shows the picture at its own proportions", async () => {
    await withApp(async (t) => {
      const r = await t.eval<{
        w: number;
        h: number;
        ratio: number;
        lit: number;
      }>(`(async () => {
        const e = window.__e2e;
        const N = 200;

        // A 2:1 picture, generated in-page so the test carries no binary.
        const c = document.createElement("canvas");
        c.width = 200; c.height = 100;
        const g = c.getContext("2d");
        g.fillStyle = "#00ff00";
        g.fillRect(0, 0, 200, 100);
        const url = c.toDataURL("image/png");

        const settings = {
          image: url, markSize: 0.5, glow: 0, fill: "#ffffff", background: "#00000000",
        };
        // The texture loads asynchronously; without a wait the 1x1 fallback is
        // still bound and the measurement is of nothing.
        await e.renderDef("aura", settings, N, N);
        await e.wait(700);
        const img = await e.renderDef("aura", settings, N, N);

        let minX = N, maxX = -1, minY = N, maxY = -1, lit = 0;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const i = (y * N + x) * 4;
            if (img.pixels[i + 1] > 200 && img.pixels[i] < 60) {
              lit++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        const w = maxX - minX + 1, h = maxY - minY + 1;
        return { w, h, ratio: w / h, lit };
      })()`);

      expect(r.lit).toBeGreaterThan(1000);
      expect(r.w).toBeGreaterThan(50);
      // Stretched to the square quad this would read 1.0.
      expect(r.ratio).toBeGreaterThan(1.8);
      expect(r.ratio).toBeLessThan(2.2);
    });
  });

  e2e("stands the picture the right way up", async () => {
    // An uploaded texture is read top-down from its first row, while
    // v_texCoord.y runs bottom-up from the quad geometry. Sampling the picture
    // straight off that coordinate shows it upside down.
    await withApp(async (t) => {
      const r = await t.eval<{ dx: number; dy: number }>(`(async () => {
        const e = window.__e2e;
        const N = 200;

        // Painted in one corner only, so a flip has somewhere to show.
        const c = document.createElement("canvas");
        c.width = 200; c.height = 200;
        const g = c.getContext("2d");
        g.fillStyle = "#ff0000";
        g.fillRect(0, 0, 100, 100);
        const url = c.toDataURL("image/png");

        const settings = {
          image: url, markSize: 0.6, glow: 0,
          fill: "#000000", background: "#000000ff",
        };
        await e.renderDef("aura", settings, N, N);
        await e.wait(700);
        const img = await e.renderDef("aura", settings, N, N);

        let minX = N, maxX = -1, minY = N, maxY = -1;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const i = (y * N + x) * 4;
            if (img.pixels[i] > 150 && img.pixels[i + 1] < 80) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        // Where the red landed, relative to the centre of the frame.
        return { dx: (minX + maxX) / 2 - N / 2, dy: (minY + maxY) / 2 - N / 2 };
      })()`);

      // The marker was painted in the image's top-left. Canvas y grows downward,
      // so it has to land ABOVE the centre: a negative dy.
      expect(r.dx).toBeLessThan(0);
      expect(r.dy).toBeLessThan(0);
    });
  });

  e2e("the halo tracks the bass", async () => {
    await withApp(async (t) => {
      const r = await t.eval<{
        still: number;
        reactive: number;
        db: number;
      }>(`(async () => {
        const e = window.__e2e;
        const N = 200;
        const energy = (img) => {
          let sum = 0;
          for (let y = 0; y < N; y += 2)
            for (let x = 0; x < N; x += 2) {
              const i = (y * N + x) * 4;
              sum += img.pixels[i] + img.pixels[i + 1] + img.pixels[i + 2];
            }
          return sum;
        };

        await e.addMusic(5);
        (await e.audio()).playAudio();

        // Audio has to be genuinely running before anything is measured. The
        // analyser is filled asynchronously, and measured too early it reports
        // silence - at which point Bass response has nothing to react to and
        // both frames come out identical for reasons that have nothing to do
        // with the shader.
        const { runtime } = await import("/src/lib/runtime.ts");
        let db = -Infinity;
        for (let i = 0; i < 60 && db < -70; i++) {
          const buf = new Float32Array(runtime.analyser.frequencyBinCount);
          runtime.analyser.getFloatFrequencyData(buf);
          db = buf[1];
          if (db < -70) await e.wait(100);
        }

        // Sampled over a few frames rather than one: the analyser holds
        // whatever the track is doing at that instant, and a single frame can
        // land on a quiet beat and see no difference at all.
        const take = async (settings) => {
          let sum = 0;
          for (let i = 0; i < 3; i++) {
            sum += energy(await e.renderDef("aura", settings, N, N, true));
            await e.wait(40);
          }
          return sum;
        };

        const base = { glow: 1, spread: 1.2, background: "#00000000" };
        const still = await take({ ...base, breath: 0 });
        const reactive = await take({ ...base, breath: 0.8 });

        return { still, reactive, db };
      })()`);

      expect(r.db).toBeGreaterThan(-70);
      expect(r.still).toBeGreaterThan(0);
      // Raising Bass response swells the silhouette and brightens the halo, so
      // the frame is substantially brighter than the same settings at zero.
      expect(r.reactive).toBeGreaterThan(r.still * 1.3);
    });
  });
});
