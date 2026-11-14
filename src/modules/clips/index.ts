import type { ClipDefinition } from "../../shared/types/clip";
import { createRegistry } from "./_core/registry";
import { backgroundClip } from "./background/definition";
import { glvizClip } from "./glviz/definition";
import { musicClip } from "./music/definition";
import { overlayClip } from "./overlay/definition";
import { playlistClip } from "./playlist/definition";
import { shapeClip } from "./shape/definition";
import { textClip } from "./text/definition";
import { titleClip } from "./title/definition";
import { vfxClipDefinitions } from "./vfx/definition";

// Note: lyricsClip (./lyrics/definition) is NOT registered as a timeline
// clip — production model: lyrics attach to the music clip and draw as
// one global layer (render-loop). The definition is used directly for draw/bbox.

export const clipRegistry = createRegistry<ClipDefinition>((e) => e.type);

for (const def of [
  backgroundClip,
  textClip,
  titleClip,
  shapeClip,
  overlayClip,
  glvizClip,
  musicClip,
  playlistClip,
  ...vfxClipDefinitions,
]) {
  clipRegistry.register(def);
}

export function getClipDef(type: string): ClipDefinition | undefined {
  return clipRegistry.get(type);
}
