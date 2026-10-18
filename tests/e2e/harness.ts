// Shared harness for the end-to-end suite.
//
// Two things the suite cannot do for itself: start a dev server, and open a
// browser. Both are handled here so each test file is only about its subject.
//
// Everything runs against the dev server rather than a built preview, because
// several assertions reach into the live store through a dynamic import of
// /src/store/editor-store.ts. That specifier only resolves when Vite is
// serving unbundled modules.

/**
 * Per-test budget. Starting the dev server and booting the editor takes longer
 * than Bun's 5s default, which expires during startup and then reports itself
 * as a connection failure. Passed per test because a module-level
 * setDefaultTimeout does not reach tests already registered by then.
 */
export const TIMEOUT = 60_000;

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

/**
 * Dev server port for the suite.
 *
 * Deliberately not 5173: that belongs to the development server, and a test
 * run that hijacks it leaves `bun run dev` talking to a store it no longer
 * controls. Overridable, but 5173 is never the default.
 */
export const PORT = Number(process.env.E2E_PORT ?? 5174);
export const BASE = `http://localhost:${PORT}/`;

/** Where each browser cache keeps its executable. */
const BINARY = {
  playwright: "chrome-linux64/chrome",
  puppeteer: "chrome-linux64/chrome",
};

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * Newest build first.
 *
 * Version directories sort descending as strings well enough for these
 * prefixes, and the newest build is the one most likely to know any protocol
 * method the runner uses.
 */
const scanCache = (root: string, relative: string): string | null => {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }
  for (const dir of entries.sort().reverse()) {
    const candidate = join(root, dir, relative);
    if (isFile(candidate)) return candidate;
  }
  return null;
};

/** The first of these names that resolves on PATH. */
const fromPath = (names: string[]): string | null => {
  const dirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const name of names) {
    for (const dir of dirs) {
      const candidate = join(dir, name);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
};

/**
 * Locates a browser for Bun.WebView to drive.
 *
 * WebView drives an installed browser rather than downloading one, so this
 * walks where one is likely to already be, in the order of how likely: an
 * explicit override, the Playwright cache, the Puppeteer cache, then whatever
 * Chrome or Chromium the system has on PATH.
 *
 * Browsers also land outside PATH - a .deb install or a Homebrew cask with no
 * symlink, most often - so each family is checked in its cache before its PATH
 * name is tried. Brave is deliberately absent: Chromium underneath, but it
 * brings its own profile layout and nothing here needs it.
 *
 * Linux only. The cache layouts below are Linux ones, and the project targets
 * Linux, so there is no point carrying paths for platforms never used.
 */
const findBrowser = (): string => {
  if (process.platform !== "linux") {
    throw new Error(
      `the e2e browser lookup is Linux-only, running on ${process.platform}`,
    );
  }

  const override = process.env.CHROME_PATH;
  if (override) {
    if (isFile(override)) return override;
    throw new Error(`CHROME_PATH points at "${override}", which is not a file`);
  }

  // $HOME rather than os.homedir(): the caches being searched belong to the
  // user, and reading the variable also keeps this testable against a fake
  // home - Bun caches homedir() and would ignore a changed $HOME.
  const home = process.env.HOME ?? homedir();
  const tried: string[] = [];

  const playwrightRoot = join(home, ".cache/ms-playwright");
  const fromPlaywright = scanCache(playwrightRoot, BINARY.playwright);
  if (fromPlaywright) return fromPlaywright;
  tried.push(playwrightRoot);

  const puppeteerRoot = join(home, ".cache/puppeteer/chrome");
  const fromPuppeteer = scanCache(puppeteerRoot, BINARY.puppeteer);
  if (fromPuppeteer) return fromPuppeteer;
  tried.push(puppeteerRoot);

  const chromium = fromPath([
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ]);
  if (chromium) return chromium;

  throw new Error(
    "no Chrome or Chromium found for Bun.WebView.\n" +
      `Looked in: ${tried.join(", ")}, then PATH for google-chrome and chromium.\n` +
      "Install one, or point CHROME_PATH at the executable.",
  );
};

let server: ReturnType<typeof Bun.spawn> | null = null;
let startup: Promise<void> | null = null;

const reachable = async () =>
  fetch(BASE, { signal: AbortSignal.timeout(2000) })
    .then(r => r.ok)
    .catch(() => false);

/**
 * Brings up the dev server once per test process.
 *
 * An already-running server is reused rather than duplicated, so `bun test`
 * works alongside a `bun run dev` in another terminal.
 */
export const ensureServer = (): Promise<void> => {
  startup ??= (async () => {
    if (await reachable()) return;

    server = Bun.spawn(["bunx", "vite", "dev", "--port", String(PORT), "--strictPort"], {
      cwd: new URL("../..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    });

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (await reachable()) return;
      // Fail fast instead of waiting out the full minute on a dead server.
      if (server.exitCode !== null) {
        throw new Error(`dev server exited with code ${server.exitCode}`);
      }
      await Bun.sleep(250);
    }
    throw new Error("dev server did not become reachable");
  })();
  return startup;
};

export const stopServer = () => {
  server?.kill();
  server = null;
  startup = null;
};

/**
 * Full teardown for a test file.
 *
 * close() ends a tab but leaves the browser Bun spawned for this process
 * running, so without closeAll() every run leaves another Chrome behind.
 */
export const shutdown = () => {
  stopServer();
  Bun.WebView.closeAll();
  sharedPage = null;
};

/**
 * Helpers installed into the page itself, before any application script runs.
 *
 * They live in the browser rather than in the harness because they need the
 * canvas, the store and the audio engine. Everything is async and memoised so
 * repeated evaluate calls do not re-import the module graph each time.
 */
const PAGE_HELPERS = `
window.__e2e = (() => {
  const mods = {};
  const load = (name, path) => (mods[name] ??= import(path));

  const store = () => load("store", "/src/store/editor-store.ts");
  const factory = () => load("factory", "/src/lib/clip-factory.ts");
  const clips = () => load("clips", "/src/lib/clips/index.ts");
  const audio = () => load("audio", "/src/lib/audio.ts");
  const glviz = () => load("glviz", "/src/lib/gl-viz/index.ts");
  const webgl = () => load("webgl", "/src/lib/webgl-renderer.ts");

  const canvas = () => document.getElementById("renderCanvas");
  const ctx2d = () => canvas().getContext("2d");
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  /**
   * Real audio, from the sample WAV in public/.
   *
   * A synthesised tone proves the plumbing works and nothing else: it has a
   * spectrum shaped by whoever wrote the oscillator, and any assertion about
   * the spectrum is really an assertion about the oscillator. This plays the
   * actual track instead, so "the analyser reports music" means music.
   *
   * The file is 73 seconds and 14 MB, and no test listens past a few seconds,
   * so it is fetched once and a slice long enough for the caller is re-wrapped
   * as a plain 44-byte WAV. Nothing waits on fourteen megabytes to hear a bass
   * note. Only the data chunk is copied, so the 120-byte LIST chunk the file
   * carries is dropped rather than needing it to be understood.
   */
  const TRACK = "/audio/example-audio.wav";

  const source = (() => {
    let pending = null;
    return () => (pending ??= fetch(TRACK).then((r) => {
      if (!r.ok) throw new Error("could not read " + TRACK + ": " + r.status);
      return r.arrayBuffer();
    }));
  })();

  const parseWav = (buf) => {
    const view = new DataView(buf);
    const tag = (at) => String.fromCharCode(
      view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
    if (tag(0) !== "RIFF" || tag(8) !== "WAVE") {
      throw new Error(TRACK + " is not a RIFF/WAVE file");
    }

    let at = 12, fmt = null, data = null;
    while (at + 8 <= buf.byteLength) {
      const id = tag(at), size = view.getUint32(at + 4, true);
      if (id === "fmt ") {
        fmt = {
          format: view.getUint16(at + 8, true),
          channels: view.getUint16(at + 10, true),
          rate: view.getUint32(at + 12, true),
          bits: view.getUint16(at + 22, true),
        };
      } else if (id === "data") {
        // Sizes can lie about the final chunk, so never read past the buffer.
        data = { at: at + 8, len: Math.min(size, buf.byteLength - (at + 8)) };
        break;
      }
      at += 8 + size + (size & 1);
    }
    if (!fmt || !data) throw new Error(TRACK + " has no fmt or data chunk");
    if (fmt.format !== 1) throw new Error(TRACK + " is not uncompressed PCM");
    return { ...fmt, ...data, blockAlign: fmt.channels * fmt.bits / 8 };
  };

  /** Re-wraps raw PCM in the smallest header a decoder will accept. */
  const wrapWav = (fmt, pcm) => {
    const out = new ArrayBuffer(44 + pcm.byteLength);
    const v = new DataView(out);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + pcm.byteLength, true); str(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, fmt.channels, true);
    v.setUint32(24, fmt.rate, true); v.setUint32(28, fmt.rate * fmt.blockAlign, true);
    v.setUint16(32, fmt.blockAlign, true); v.setUint16(34, fmt.bits, true);
    str(36, "data"); v.setUint32(40, pcm.byteLength, true);
    new Uint8Array(out, 44).set(new Uint8Array(pcm));
    return new Blob([out], { type: "audio/wav" });
  };

  const slices = new Map();
  const slice = async (secs) => {
    const key = Math.round(secs * 10);
    const cached = slices.get(key);
    if (cached) return cached;

    const buf = await source();
    const fmt = parseWav(buf);
    // Whole frames only: a partial one would shift every channel after it.
    const frames = Math.max(1, Math.min(
      Math.floor(fmt.len / fmt.blockAlign), Math.round(secs * fmt.rate)));
    const pcm = buf.slice(fmt.at, fmt.at + frames * fmt.blockAlign);

    const clip = {
      url: URL.createObjectURL(wrapWav(fmt, pcm)),
      seconds: frames / fmt.rate,
      sourceSeconds: fmt.len / fmt.blockAlign / fmt.rate,
    };
    slices.set(key, clip);
    return clip;
  };

  /**
   * Puts the track on the timeline, trimmed to \`secs\`.
   *
   * Defaults to a little over what the longest test waits for, so playback
   * cannot run out mid-measurement and leave the analyser decaying.
   */
  const addMusic = async (secs = 6) => {
    const clip = await slice(secs);
    (await factory()).addClipToTimeline("music", {
      audioUrl: clip.url, audioDuration: clip.seconds, name: "track", pan: 0, volume: 1,
    });
    return clip;
  };

  const addClip = async (type, settings = {}) => {
    (await factory()).addClipToTimeline(type, settings);
    return idOfLast(type);
  };

  const clipsOfType = async (type) =>
    (await store()).editorStore.getState().timelineClips.filter(c => c.type === type);

  const idOfLast = async (type) => (await clipsOfType(type)).pop()?.id;

  const select = async (id) => (await store()).editorStore.setState({ selectedClipId: id });

  const setState = async (patch) => (await store()).editorStore.setState(patch);

  /**
   * Counts lit samples inside a rect, sampling every other pixel.
   *
   * One readback for the whole region, never one per sample: a per-pixel
   * getImageData is a synchronous GPU round trip, and a text-sized rect works
   * out to tens of thousands of them.
   */
  const litIn = (x0, y0, w0, h0, threshold = 90) => {
    const c = canvas(), g = ctx2d();
    const left = Math.max(0, Math.round(x0)), top = Math.max(0, Math.round(y0));
    const right = Math.min(c.width, Math.round(x0 + w0));
    const bottom = Math.min(c.height, Math.round(y0 + h0));
    if (right <= left || bottom <= top) return 0;

    const w = right - left;
    const d = g.getImageData(left, top, w, bottom - top).data;
    let count = 0;
    for (let y = 0; y < bottom - top; y += 2)
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        if (d[i] + d[i + 1] + d[i + 2] > threshold || d[i + 3] > threshold) count++;
      }
    return count;
  };

  const bboxOf = async (type, id) => {
    const cl = (await clipsOfType(type)).find(c => c.id === id);
    return (await clips()).ClipRegistry.get(type)
      .getItemBoundingBox(null, canvas().width, canvas().height, cl.settings);
  };

  /** Draws a definition onto an existing 2D context at a given bounding box. */
  const drawDef = async (id, settings, ctx, bbox, isPlaying = false, time = 0) => {
    const m = await glviz();
    const def = m.resolveVisualizerDef(id);
    m.drawVisualizer(def, ctx, bbox, { ...def.settings, ...settings }, time, isPlaying);
  };

  /** Renders a definition offscreen so pixel assertions stay deterministic. */
  const renderDef = async (id, settings, width, height, isPlaying = false, time = 0) => {
    const off = document.createElement("canvas");
    off.width = width; off.height = height;
    await drawDef(id, settings, off.getContext("2d"),
                  { x: 0, y: 0, width, height }, isPlaying, time);
    return { pixels: off.getContext("2d").getImageData(0, 0, width, height).data, width, height };
  };

  const pixelAt = (img, x, y) => {
    const i = (y * img.width + x) * 4;
    return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2], img.pixels[i + 3]];
  };

  /**
   * Returns the page to a known state so tests can share one tab.
   *
   * Booting the editor costs about a second and a half, and doing that per test
   * dominated the whole run. Clearing the store is the cheaper equivalent of a
   * fresh page for everything these tests assert on.
   */
  const reset = async () => {
    const m = await store();
    try { (await audio()).stopAudio(); } catch { /* never started */ }
    m.editorStore.setState({
      timelineClips: [],
      videoClips: [],
      clipSettings: {},
      selectedClipId: null,
      isPlaying: false,
      aspectRatio: "16:9",
    });
    await wait(250);
    return { errors: window.__errors.length };
  };

  return {
    wait, canvas, ctx2d, store, factory, clips, audio, glviz, webgl,
    slice, addMusic, addClip, clipsOfType, idOfLast, select, setState,
    litIn, bboxOf, drawDef, renderDef, pixelAt, reset,
  };
})();
`;

/**
 * Captures console errors and uncaught exceptions.
 *
 * Bun.WebView has no equivalent of Playwright's page.on("console"), so this
 * installs through the devtools protocol before the app's first script runs -
 * anything injected later would miss the errors thrown during boot.
 */
const ERROR_TRAP = `
window.__errors = [];
window.addEventListener("error", e => window.__errors.push("uncaught: " + (e.message ?? e)));
window.addEventListener("unhandledrejection", e => window.__errors.push("rejection: " + String(e.reason)));
const nativeError = console.error.bind(console);
console.error = (...a) => { window.__errors.push(a.map(x => x?.message ?? String(x)).join(" ")); nativeError(...a); };
`;

export type AppView = Bun.WebView;

/**
 * What a test gets to work with.
 *
 * evaluate() returns whatever the page returned, which the compiler cannot
 * infer, so the result type is declared at the call site instead. Without that
 * a typo in a returned field name type-checks and then asserts against
 * undefined.
 */
export type TestPage = {
  view: AppView;
  eval: <R>(source: string) => Promise<R>;
  /** Errors recorded since this test started. */
  errors: () => Promise<string[]>;
  errorsSince: (count: number) => Promise<string[]>;
};

/** One tab for the whole process, opened on first use. */
let sharedPage: TestPage | null = null;

/** Opens the app in a fresh tab and waits until the editor has booted. */
const bootApp = async (): Promise<AppView> => {
  await ensureServer();

  const view = new Bun.WebView({
    width: 1600,
    height: 1000,
    backend: {
      type: "chrome",
      path: findBrowser(),
      argv: [
        "--use-gl=swiftshader",
        "--enable-unsafe-swiftshader",
        "--no-sandbox",
        // Without this the AudioContext stays suspended and every audio
        // assertion sees silence.
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  });

  // cdp() has no session until the tab has navigated once, so a blank page
  // first: it is far cheaper than booting the editor just to attach.
  await view.navigate("about:blank");
  await view.cdp("Page.enable");
  // Both scripts have to be in place before the app's first line runs, or the
  // errors thrown during boot are the ones that go unrecorded.
  await view.cdp("Page.addScriptToEvaluateOnNewDocument", { source: ERROR_TRAP });
  await view.cdp("Page.addScriptToEvaluateOnNewDocument", { source: PAGE_HELPERS });
  await view.navigate(BASE);

  // WebView has no waitForSelector, so poll for the thing actually needed:
  // the canvas the render loop draws into.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const ready = await view
      .evaluate(`!!document.getElementById("renderCanvas") && !!window.__e2e`)
      .catch(() => false);
    if (ready) break;
    await Bun.sleep(200);
  }

  await view.evaluate(`window.__e2e.wait(1200)`);
  return view;
};

/** Opens the app in a tab of its own. Prefer withApp. */
export const openApp = bootApp;

/** The shared tab, booted once per test process. */
export const app = async (): Promise<TestPage> => {
  if (sharedPage) return sharedPage;
  const view = await bootApp();
  sharedPage = {
    view,
    eval: <R,>(source: string) => view.evaluate(source) as Promise<R>,
    errors: () => view.evaluate(`window.__errors ?? []`).catch(() => [] as string[]) as Promise<string[]>,
    errorsSince: (n) =>
      view
        .evaluate(`(window.__errors ?? []).slice(${n})`)
        .catch(() => [] as string[]) as Promise<string[]>,
  };
  return sharedPage;
};

/**
 * Runs the body against the shared tab, reset to a clean state first.
 *
 * errors() reports only what this test added, so a shared page does not make
 * one test's console noise look like another's failure.
 */
export const withApp = async (body: (page: TestPage) => Promise<void>): Promise<void> => {
  const page = await app();
  const mark = await page.eval<number>(`(window.__e2e.reset(), window.__errors.length)`);
  const scoped: TestPage = {
    view: page.view,
    eval: page.eval,
    errorsSince: page.errorsSince,
    errors: () => page.errorsSince(mark),
  };
  await body(scoped);
};