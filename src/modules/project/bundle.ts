// .zip bundle: project.json + assets/ — read/write with fflate (sync).
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ProjectV1 } from "./schema";
import { isProjectV1 } from "./schema";

export const BUNDLE_NAME = "project.lofi.zip";
const PROJECT_ENTRY = "project.json";

export function projectFileName(metaName: string): string {
  const slug = (metaName || "untitled-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "untitled-project"}.lofi.zip`;
}

/** Assemble a bundle from the project + asset bytes. */
export async function packBundle(project: ProjectV1, blobs: Map<string, Blob>): Promise<Blob> {
  const jobs: Array<Promise<[string, Uint8Array]>> = [];
  for (const [path, blob] of blobs) {
    const name = path.startsWith("assets/") ? path : `assets/${path}`;
    jobs.push(
      blob.arrayBuffer().then((buf) => [name, new Uint8Array(buf)] as [string, Uint8Array]),
    );
  }
  const entries = await Promise.all(jobs);
    const files: Record<string, Uint8Array> = {
        [PROJECT_ENTRY]: strToU8(JSON.stringify(project, null, 2)),
    };
    for (const [name_1, data] of entries) files[name_1] = data;
    return new Blob([new Uint8Array(zipSync(files)).buffer as ArrayBuffer], { type: "application/zip" });
}

export interface UnpackedBundle {
  project: ProjectV1;
  assets: Map<string, Blob>;
}

/** Unpack a bundle: validate project.json + return asset bytes. */
export function unpackBundle(data: Uint8Array): UnpackedBundle {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error("Not a valid project bundle (corrupt zip).");
  }
  const raw = files[PROJECT_ENTRY];
  if (!raw) throw new Error("Bundle does not contain project.json.");
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new Error("project.json is corrupt (not valid JSON).");
  }
  if (!isProjectV1(json)) {
    const v = (json as { version?: unknown } | null)?.version;
    throw new Error(
      typeof v === "number" && v > 1
        ? `Project version (${String(v)}) is newer than the app — please update.`
        : "Unrecognized project schema.",
    );
  }
  const assets = new Map<string, Blob>();
  for (const [name, bytes] of Object.entries(files)) {
    if (name === PROJECT_ENTRY) continue;
    // Copy so the fflate buffer can be GC'd; the Blob holds its own copy.
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    assets.set(name, new Blob([copy.buffer as ArrayBuffer]));
    assets.set(name.replace(/^assets\//, ""), new Blob([copy.buffer as ArrayBuffer]));
  }
  return { project: json, assets };
}
