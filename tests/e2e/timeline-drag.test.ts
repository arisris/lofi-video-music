// Timeline drag responsiveness. Two regressions guarded here, both of which
// made dragging feel broken rather than merely slow:
//
//   - the clip element transitioned `left`/`width`, so the painted edge eased
//     toward every new position and trailed the cursor by roughly 40% of the
//     drag distance;
//   - the ruler and grid were rebuilt on every pointer event, costing ~70ms a
//     frame on a long timeline.

import { describe, test, expect, afterAll } from "bun:test";
import { withApp, shutdown, TIMEOUT } from "./harness";

/** test() plus the harness wrapper, so every case carries the real budget. */
const e2e = (name: string, body: Parameters<typeof withApp>[0]) =>
  test(name, () => withApp(body), TIMEOUT);

afterAll(shutdown);

describe("timeline drag", () => {
  e2e("clip geometry is not transitioned, so the edge tracks the cursor", async () => {
    await withApp(async (t) => {
      const res = await t.eval<{
        animatesGeometry: boolean;
        behindByPx: number;
      }>(`(async () => {
        const e = window.__e2e;
        const id = await e.addClip("shape", {});
        const { editorStore } = await e.store();

        const area = () => document.getElementById("timeline-content-area");
        const el = () => area().querySelector("div.absolute.top-2.bottom-2.rounded.border");

        // The invariant itself: a transitioned width or left makes the clip
        // ease toward each new position instead of landing on it.
        const property = getComputedStyle(el()).transitionProperty;
        const animatesGeometry =
          property.includes("all") ||
          property.includes("left") ||
          property.includes("width") ||
          property.includes("transform");

        const r = el().getBoundingClientRect();
        const y = r.top + 10;
        const x0 = r.left + 10;
        el().dispatchEvent(
          new MouseEvent("mousedown", { clientX: x0, clientY: y, bubbles: true, cancelable: true })
        );
        await new Promise((res) => requestAnimationFrame(res));

        window.dispatchEvent(
          new MouseEvent("mousemove", { clientX: x0 + 120, clientY: y, bubbles: true })
        );
        // Two frames: the drag pokes the store from a plain window listener, so
        // React's commit is scheduled rather than synchronous and lands on the
        // next one.
        await new Promise((res) => requestAnimationFrame(res));
        await new Promise((res) => requestAnimationFrame(res));

        const state = editorStore.getState();
        const clip = state.timelineClips.find((c) => c.id === id);
        const modelLeft =
          area().getBoundingClientRect().left +
          clip.start * state.timelineZoom -
          state.timelineScrollLeft;
        const paintedLeft = el().getBoundingClientRect().left;
        window.dispatchEvent(
          new MouseEvent("mouseup", { clientX: x0 + 120, clientY: y, bubbles: true })
        );

        return { animatesGeometry, behindByPx: Math.round(paintedLeft - modelLeft) };
      })()`);

      expect(res.animatesGeometry).toBe(false);
      // A 150ms ease leaves the edge tens of pixels short. Committed geometry
      // lands on the model within a pixel.
      expect(Math.abs(res.behindByPx)).toBeLessThanOrEqual(1);
    });
  });

  e2e("dragging stays within a frame on a long timeline", async () => {
    // Guards the memo split. With the ruler and grid rebuilt per event this
    // measured 88ms a frame on 120 clips spread over 2 hours; memoised it sits
    // at the 16.7ms rAF floor. The bound is set well above the floor so a busy
    // machine cannot turn this into a coin flip, and well below the regression.
    await withApp(async (t) => {
      const res = await t.eval<{ medianMs: number; over: number }>(`(async () => {
        const e = window.__e2e;
        const { editorStore } = await e.store();

        const clips = [];
        for (let i = 0; i < 120; i++) {
          clips.push({
            id: "perf-" + i,
            type: "shape",
            trackId: "track-2",
            start: 10 + i * 100,
            duration: 2,
            settings: { text: "perf-" + i },
          });
        }
        // A two-hour timeline: the ruler is one element per 2s, so this is
        // where rebuilding it per event used to dominate.
        editorStore.setState({ timelineClips: clips, timelineZoom: 10, selectedClipId: null });
        await new Promise((res) => requestAnimationFrame(res));

        const el = [...document.querySelectorAll(
          "#timeline-content-area div.absolute.top-2.bottom-2.rounded.border"
        )].find((d) => d.style.left === "100px");
        const rect = el.getBoundingClientRect();
        const y = rect.top + 10;
        const x0 = rect.left + 10;
        el.dispatchEvent(new MouseEvent("mousedown", {
          clientX: x0, clientY: y, bubbles: true, cancelable: true }));
        await new Promise((res) => requestAnimationFrame(res));

        const gaps = [];
        let last = performance.now();
        for (let i = 1; i <= 30; i++) {
          window.dispatchEvent(new MouseEvent("mousemove", {
            clientX: x0 + i * 3, clientY: y, bubbles: true }));
          await new Promise((res) => requestAnimationFrame(res));
          const now = performance.now();
          gaps.push(now - last);
          last = now;
        }
        window.dispatchEvent(new MouseEvent("mouseup", {
          clientX: x0 + 90, clientY: y, bubbles: true }));

        gaps.sort((a, b) => a - b);
        return {
          medianMs: gaps[Math.floor(gaps.length / 2)],
          over: gaps.filter((g) => g > 40).length,
        };
      })()`);

      expect(res.medianMs).toBeLessThan(40);
      // One slow frame in thirty is tolerable; thirty would mean nothing was
      // memoised at all.
      expect(res.over).toBeLessThan(10);
    });
  });
});