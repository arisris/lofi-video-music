// Editor shell: booting, React reactivity through the store, and the canvas
// contract the recorder depends on.

import { describe, test, expect, afterAll } from "bun:test";
import { withApp, shutdown, TIMEOUT, type TestPage } from "./harness";

/** test() plus the harness wrapper, so every case carries the real budget. */
const e2e = (name: string, body: (page: TestPage) => Promise<void>) =>
  test(name, () => withApp(body), TIMEOUT);

afterAll(shutdown);

describe("editor shell", () => {
  e2e("boots with a 1280x720 canvas", async () => {
    await withApp(async (t) => {
      const size = await t.eval<{ w: number; h: number }>(`(() => {
        const c = window.__e2e.canvas();
        return { w: c.width, h: c.height };
      })()`);
      expect(size).toEqual({ w: 1280, h: 720 });
    });
  });

  e2e("clip settings update immutably", async () => {
    // React only re-renders when the store hands back new objects, so an
    // in-place edit is a silent failure: the canvas draws it, the panel does
    // not.
    await withApp(async (t) => {
      const result = await t.eval<{ sameObject: boolean; text: string }>(`(async () => {
        const e = window.__e2e;
        const actions = await import("/src/store/actions/timeline-actions.ts");
        const id = await e.addClip("text", { text: "hello" });
        const read = () => e.store().then(s =>
          s.editorStore.getState().timelineClips.find(c => c.id === id).settings);
        const before = await read();
        actions.updateTimelineClipSettings(id, { text: "changed" });
        const after = await read();
        return { sameObject: before === after, text: after.text };
      })()`);
      expect(result.sameObject).toBe(false);
      expect(result.text).toBe("changed");
    });
  });

  e2e("a text clip paints onto the canvas", async () => {
    await withApp(async (t) => {
      const lit = await t.eval<number>(`(async () => {
        const e = window.__e2e;
        await e.addClip("text", { text: "REGRESSION", x: -200, y: -40 });
        await e.select(null);
        await e.wait(700);
        return e.litIn(340, 260, 520, 180);
      })()`);
      expect(lit).toBeGreaterThan(100);
    });
  });

  e2e("aspect ratio switch resizes the canvas", async () => {
    await withApp(async (t) => {
      const sizes = await t.eval<{ portrait: [number, number]; landscape: [number, number] }>(
        `(async () => {
          const e = window.__e2e;
          await e.setState({ aspectRatio: "9:16" });
          await e.wait(800);
          const portrait = [e.canvas().width, e.canvas().height];
          await e.setState({ aspectRatio: "16:9" });
          await e.wait(800);
          return { portrait, landscape: [e.canvas().width, e.canvas().height] };
        })()`,
      );
      expect(sizes.portrait[1]).toBeGreaterThan(sizes.portrait[0]);
      expect(sizes.landscape[0]).toBeGreaterThan(sizes.landscape[1]);
    });
  });

  e2e("canvas still exposes captureStream for the recorder", async () => {
    // The WebGL work deliberately composites back into this 2D canvas rather
    // than replacing it, so recording still works. Losing this method would
    // break export while everything looked fine on screen.
    await withApp(async (t) => {
      const hasCapture = await t.eval<boolean>(
        `typeof window.__e2e.canvas().captureStream === "function"`,
      );
      expect(hasCapture).toBe(true);
    });
  });
});

describe("boot hygiene", () => {
  e2e("the editor loads without console errors", async () => {
    await withApp(async (t) => {
      // Give the render loop a few frames to log anything it logs per frame.
      await t.eval(`window.__e2e.wait(1200)`);
      const errors = await t.errors();
      expect(errors).toEqual([]);
    });
  });
});