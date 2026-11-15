/// <reference types="bun" />
import { beforeEach, describe, expect, test } from "bun:test";
import { navigateRoute, parseHashRoute, writeHashRoute } from "./route-hash";
import { useEditorStore } from "./editor-store";

// Minimal window stub: route-hash only touches window.location.hash.
let backingHash = "";
let hashWrites = 0;

(globalThis as unknown as { window: unknown }).window = {
  location: {
    get hash() {
      return backingHash;
    },
    set hash(value: string) {
      hashWrites += 1;
      backingHash = value;
    },
  },
};

beforeEach(() => {
  backingHash = "";
  hashWrites = 0;
});

describe("parseHashRoute", () => {
  test("empty hash boots to the video route", () => {
    backingHash = "";
    expect(parseHashRoute()).toBe("/");
  });

  test('"#/" boots to the video route', () => {
    backingHash = "#/";
    expect(parseHashRoute()).toBe("/");
  });

  test('"#/image" boots to the thumbnail route', () => {
    backingHash = "#/image";
    expect(parseHashRoute()).toBe("/image");
  });

  test("unknown hash normalizes safely to the video route", () => {
    backingHash = "#/unknown";
    expect(parseHashRoute()).toBe("/");
  });
});

describe("writeHashRoute", () => {
  test("writes the hash when it differs", () => {
    writeHashRoute("/image");
    expect(backingHash).toBe("/image");
    expect(hashWrites).toBe(1);
  });

  test("same-route write does not touch the hash (no loop)", () => {
    backingHash = "#/";
    writeHashRoute("/");
    expect(hashWrites).toBe(0);
    expect(backingHash).toBe("#/");
  });
});

describe("navigateRoute", () => {
  test("navigates to /image and mirrors the hash", () => {
    navigateRoute("/");
    hashWrites = 0;
    navigateRoute("/image");
    expect(useEditorStore.getState().route).toBe("/image");
    expect(backingHash).toBe("/image");
  });

  test("navigates back to / and mirrors the hash", () => {
    navigateRoute("/image");
    navigateRoute("/");
    expect(useEditorStore.getState().route).toBe("/");
    expect(backingHash).toBe("/");
  });

  test("same-route navigation is a no-op (no duplicate write)", () => {
    navigateRoute("/");
    hashWrites = 0;
    backingHash = "#/";
    navigateRoute("/");
    expect(useEditorStore.getState().route).toBe("/");
    expect(hashWrites).toBe(0);
  });
});
