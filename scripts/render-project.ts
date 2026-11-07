// Validasi headless sebuah bundle project (.lofi.zip) tanpa browser/UI:
//   bun scripts/render-project.ts <bundle.lofi.zip>
// Memeriksa skema, daftar clip/media, dan keberadaan asset yang dirujuk.
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";

const file = process.argv[2];
if (!file) {
  console.error("Pakai: bun scripts/render-project.ts <bundle.lofi.zip>");
  process.exit(1);
}

const raw = readFileSync(file);
const files = unzipSync(new Uint8Array(raw));
const entry = files["project.json"];
if (!entry) {
  console.error("FAIL: bundle tidak berisi project.json");
  process.exit(1);
}

const project = JSON.parse(strFromU8(entry)) as {
  version: number;
  meta: { name: string; createdAt: string };
  output: { aspectRatio: string; recordResolution: string; recordFps: number };
  tracks: Array<{ id: string }>;
  routes: {
    video: { clips: Array<{ id: string; type: string; start: number; duration: number; media?: { mediaId: string } | null }>; selectedClipId: string | null };
    thumb: { clips: Array<{ id: string; type: string; start: number; duration: number }> };
  };
  mediaPool: Array<{ id: string; name: string; kind: string; source: { type: string; value: string } }>;
};

if (project.version !== 1) {
  console.error(`FAIL: versi project ${project.version} tidak didukung (app: 1)`);
  process.exit(1);
}

const assetNames = new Set(Object.keys(files).filter((k) => k !== "project.json"));
let missing = 0;
for (const m of project.mediaPool) {
  if (m.source.type === "asset") {
    const key = m.source.value.startsWith("assets/") ? m.source.value : `assets/${m.source.value}`;
    if (!assetNames.has(m.source.value) && !assetNames.has(key) && !assetNames.has(m.id)) {
      console.error(`MISSING asset: ${m.source.value} (${m.name})`);
      missing++;
    }
  }
}

const v = project.routes.video.clips;
const t = project.routes.thumb.clips;
const end = v.reduce((a, c) => Math.max(a, c.start + c.duration), 0);
console.log(`OK  "${project.meta.name}" (${project.meta.createdAt})`);
console.log(`    output: ${project.output.aspectRatio} ${project.output.recordResolution}@${project.output.recordFps}`);
console.log(`    tracks: ${project.tracks.length}, video clips: ${v.length}, thumb clips: ${t.length}, media: ${project.mediaPool.length}`);
console.log(`    durasi video: ${end.toFixed(1)}s, asset hilang: ${missing}`);
process.exit(missing > 0 ? 2 : 0);
