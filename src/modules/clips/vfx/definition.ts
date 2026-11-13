// Adapter: each VFX definition is registered as a ClipDefinition so it joins
// the timeline (trim/move/enable over a time range; added via
// addClipToTimeline(vfx.id) and drawn in the timeline pass).
// Per-clip-id persistent particle state (replaces `clip.drops` in the old code
// and the global Map in the old VFX pass).
import type { ClipDefinition } from "../../../shared/types/clip";
import { DEFAULT_TRANSFORM } from "../../../shared/lib/canvas-transform";
import { useEditorStore } from "../../../store/editor-store";
import { vfxRegistry } from "../../vfx";
import type { VfxDefinition, VfxState } from "../../vfx/_core/types";

const vfxClipStates = new Map<string, VfxState>();

function pruneStaleStates() {
  if (vfxClipStates.size === 0) return;
  const alive = new Set(useEditorStore.getState().clips.map((c) => c.id));
  for (const id of [...vfxClipStates.keys()]) {
    if (!alive.has(id)) vfxClipStates.delete(id);
  }
}

function toClipDefinition(vfx: VfxDefinition): ClipDefinition {
  return {
    type: vfx.type as ClipDefinition["type"],
    name: vfx.name,
    icon: "icon-[ri--magic-line]",
    defaultDuration: 5,
    defaultSettings: { ...DEFAULT_TRANSFORM, ...vfx.defaultSettings },
    schema: vfx.schema,
    draw({ ctx, w, h, settings, localTime, clipId }) {
      let state = vfxClipStates.get(clipId);
      if (!state) {
        state = {};
        vfxClipStates.set(clipId, state);
      }
      pruneStaleStates();
      vfx.draw({ ctx, w, h, settings, time: localTime, state });
    },
  };
}

export const vfxClipDefinitions: ClipDefinition[] = vfxRegistry
  .list()
  .map(toClipDefinition);
