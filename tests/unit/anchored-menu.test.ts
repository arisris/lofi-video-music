// Placement of pointer-anchored menus: they follow the pointer, but never
// leave the viewport.

import { describe, expect, test } from "bun:test";
import { placeMenu } from "../../src/components/ui/anchored-menu";

const viewport = { width: 1000, height: 800 };
const size = { width: 160, height: 120 };

describe("menu placement", () => {
  test("a menu with room below opens downwards", () => {
    const { left, top } = placeMenu({ x: 100, y: 200 }, size, viewport);
    expect(top).toBe(200);
    expect(left).toBe(100);
  });

  test("a menu without room below opens upwards", () => {
    // 700 + 120 = 820, past the 800 pixel viewport.
    const { top } = placeMenu({ x: 100, y: 700 }, size, viewport);
    expect(top).toBe(580);
  });

  test("a menu too tall for the space above stays on screen", () => {
    // The menu fits neither below (100 + 120 = 220 > 192) nor above
    // (100 - 120 = -20), so it keeps the top margin.
    const { top } = placeMenu({ x: 100, y: 100 }, size, {
      width: 1000,
      height: 200,
    });
    expect(top).toBe(8);
  });

  test("a menu without room to the right slides back inside", () => {
    // 900 + 160 = 1060, past the 1000 pixel viewport.
    const { left } = placeMenu({ x: 900, y: 200 }, size, viewport);
    expect(left).toBe(832);
  });

  test("a menu at the left edge keeps the margin", () => {
    const { left } = placeMenu({ x: 2, y: 200 }, size, viewport);
    expect(left).toBe(8);
  });

  test("a menu wider than the viewport stays on screen", () => {
    const { left } = placeMenu(
      { x: 10, y: 200 },
      { width: 2000, height: 120 },
      viewport,
    );
    expect(left).toBe(8);
  });
});
