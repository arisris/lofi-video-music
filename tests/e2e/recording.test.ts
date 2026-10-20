// Recording: the frame the recorder captures has to look like the preview.
//
// Before capture the recorder grows the canvas backing store to the selected
// resolution (1080p/1440p), while every clip is laid out in design space - the
// fixed 1280x720 / 720x1280 the editor works in. The render loop scales the
// frame up to fill the backing store; without that, each clip keeps its
// preview-pixel size inside a bigger canvas and comes out of the recording
// visibly shrunken.
//
// The measurements happen in the page: two million pixels round-tripped to the
// runner would dwarf the assertions they support.

import { describe, test, expect, afterAll } from "bun:test";
import { withApp, shutdown, TIMEOUT, type TestPage } from "./harness";

/** test() plus the harness wrapper, so every case carries the real budget. */
const e2e = (name: string, body: (page: TestPage) => Promise<void>) =>
  test(name, () => withApp(body), TIMEOUT);

afterAll(shutdown);

/**
 * Declares a function the eval strings embed and call.
 *
 * A shape clip paints a solid #3b82f6 rectangle (sum 435) over the dark
 * background gradient (sum <= 171), so a brightness threshold separates the
 * clip cleanly from everything else the frame may draw.
 */
const litBBox = `function litBBox() {
  const c = window.__e2e.canvas();
  const d = window.__e2e.ctx2d().getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i] + d[i + 1] + d[i + 2] <= 240) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}`;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

describe("recording resolution", () => {
  e2e("record size matches the aspect ratio at every resolution", async (t) => {
    // The landscape and portrait tables each live in one place now, but they
    // disagreed before: the preview sized a portrait 1080p canvas 1080x1080
    // while the recorder sized it 1080x1920, and whichever wrote last won.
    const sizes = await t.eval<Record<string, [number, number]>>(
      `(async () => {
        const m = await import("/src/lib/canvas-space.ts");
        const out = {};
        for (const ratio of ["16:9", "9:16"]) {
          for (const res of ["720p", "1080p", "1440p"]) {
            const s = m.recordSize(ratio, res);
            out[ratio + " " + res] = [s.w, s.h];
          }
        }
        return out;
      })()`,
    );

    expect(sizes["16:9 720p"]).toEqual([1280, 720]);
    expect(sizes["16:9 1080p"]).toEqual([1920, 1080]);
    expect(sizes["16:9 1440p"]).toEqual([2560, 1440]);
    expect(sizes["9:16 720p"]).toEqual([720, 1280]);
    expect(sizes["9:16 1080p"]).toEqual([1080, 1920]);
    expect(sizes["9:16 1440p"]).toEqual([1440, 2560]);
  });

  e2e(
    "a grown backing store keeps clips at the same share of the frame",
    async (t) => {
      // What the recorder does to the canvas, asserted without MediaRecorder:
      // the backing store is the only thing that changes size.
      const measured = await t.eval<{
        preview: Box;
        fhd: Box;
        previewCanvas: [number, number];
        fhdCanvas: [number, number];
      }>(`(async () => {
      const e = window.__e2e;
      // Clips start at the playhead and fade in over their first 0.6s of local
      // time, so pin the playhead and turn the transition off: a clip that is
      // still transparent would measure as absent rather than as the wrong size.
      await e.setState({ currentTime: 0 });
      await e.addClip("shape", {
        shapeType: "rectangle", width: 150, height: 150,
        animations: { inType: "none", outType: "none", type: "none" },
      });
      await e.select(null);
      await e.wait(500);
      ${litBBox}

      const c = e.canvas();
      const preview = litBBox();
      const previewCanvas = [c.width, c.height];

      c.width = 1920;
      c.height = 1080;
      await e.wait(500);
      const fhd = litBBox();
      const fhdCanvas = [c.width, c.height];

      c.width = 1280;
      c.height = 720;
      await e.wait(300);
      return { preview, fhd, previewCanvas, fhdCanvas };
    })()`);

      expect(measured.previewCanvas).toEqual([1280, 720]);
      expect(measured.fhdCanvas).toEqual([1920, 1080]);

      // The shape is 150 design px wide wherever it is drawn...
      expect(measured.preview.w).toBeGreaterThanOrEqual(145);
      expect(measured.preview.w).toBeLessThanOrEqual(160);

      // ...so it grows by exactly the 1.5x the backing store did, instead of
      // staying 150px wide inside a 1920px frame (the bug: 2/3 of its size).
      expect(measured.fhd.w / measured.preview.w).toBeCloseTo(1.5, 1);
      expect(measured.fhd.h / measured.preview.h).toBeCloseTo(1.5, 1);

      // And it keeps its place in the frame rather than drifting to the top-left.
      expect(measured.fhd.x / 1920).toBeCloseTo(measured.preview.x / 1280, 2);
      expect(measured.fhd.y / 1080).toBeCloseTo(measured.preview.y / 720, 2);
    },
  );

  e2e(
    "startRecording captures at FHD and restores the preview canvas",
    async (t) => {
      const result = await t.eval<{
        recorderSupported: boolean;
        preview: Box | null;
        during: Box | null;
        duringCanvas: [number, number] | null;
        afterCanvas: [number, number] | null;
        downloaded: boolean;
      }>(`(async () => {
      const e = window.__e2e;
      const supported = typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("video/webm");
      if (!supported) {
        return { recorderSupported: false, preview: null, during: null,
                 duringCanvas: null, afterCanvas: null, downloaded: false };
      }

      // stopRecording hands the finished file to an anchor click. A test has no
      // use for it, and it must not reach the browser's download machinery, so
      // downloads are counted instead of performed - and the guard stays up for
      // the rest of the page's life, because onstop fires asynchronously and
      // may land after this call returns. alert() is covered for the same
      // reason: MediaRecorder's "not supported" path shows one.
      window.__deniedDownloads = 0;
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) { window.__deniedDownloads++; return; }
        return origClick.apply(this, arguments);
      };
      window.alert = () => {};

      await e.setState({ currentTime: 0 });
      await e.addClip("shape", {
        shapeType: "rectangle", width: 150, height: 150,
        animations: { inType: "none", outType: "none", type: "none" },
      });
      await e.select(null);
      await e.wait(500);
      ${litBBox}
      const preview = litBBox();

      const recorder = await import("/src/lib/recorder.ts");
      const store = await e.store();
      store.editorStore.setState({ recordResolution: "1080p", recordFps: 30 });
      recorder.startRecording("timeline");
      await e.wait(800);

      const duringCanvas = [e.canvas().width, e.canvas().height];
      const during = litBBox();

      recorder.stopRecording();
      for (let i = 0; i < 50 && window.__deniedDownloads === 0; i++) {
        await e.wait(100);
      }
      const downloaded = window.__deniedDownloads > 0;

      await e.wait(400);
      const afterCanvas = [e.canvas().width, e.canvas().height];
      return { recorderSupported: true, preview, during, duringCanvas, afterCanvas, downloaded };
    })()`);

      if (!result.recorderSupported) return;

      // The capture surface is the selected resolution...
      expect(result.duringCanvas).toEqual([1920, 1080]);
      // ...with the layout scaled to fill it, not left at preview size.
      expect(result.during!.w / result.preview!.w).toBeCloseTo(1.5, 1);
      // The recorder produced a file, i.e. the whole path ran.
      expect(result.downloaded).toBe(true);
      // And the preview canvas comes back to its normal size afterwards.
      expect(result.afterCanvas).toEqual([1280, 720]);
    },
  );
});
