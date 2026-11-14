// Adapter: each VFX definition is registered as a ClipDefinition so it joins
// the timeline (trim/move/enable over a time range; added via
// addClipToTimeline(vfx.id) and drawn in the timeline pass).
// Per-clip-id persistent particle state (replaces `clip.drops` in the old code
// and the global Map in the old VFX pass).
import type { ClipDefinition, ClipType } from "../../../shared/types/clip";
import { CLIP_TYPES } from "../../../shared/types/clip";
import { applyClipAnimations } from "../../../shared/lib/animations";
import { useEditorStore } from "../../../store/editor-store";
import { vfxRegistry } from "../../vfx";
import type { VfxDefinition, VfxState } from "../../vfx/_core/types";

const vfxClipStates = new Map<string, VfxState>();
let lastClipCount = -1;

function pruneStaleStates() {
  // Count check first: no allocation on the common path (every clip, every
  // frame). A full prune only runs when the clip list actually changed size.
  const clips = useEditorStore.getState().clips;
  if (clips.length === lastClipCount) return;
  lastClipCount = clips.length;
  if (vfxClipStates.size === 0) return;
  const alive = new Set(clips.map((c) => c.id));
  for (const id of [...vfxClipStates.keys()]) {
    if (!alive.has(id)) vfxClipStates.delete(id);
  }
}

/** Loud failure instead of a silent `as` cast — a typo'd VFX type used to
 * register an unrenderable clip without any error. */
function asClipType(type: string): ClipType {
  if (!(CLIP_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unknown VFX clip type: ${type}`);
  }
  return type as ClipType;
}

function toClipDefinition(vfx: VfxDefinition): ClipDefinition {
  return {
    type: asClipType(vfx.type),
    name: vfx.name,
    icon: vfx.icon,
    defaultDuration: 5,
    // No DEFAULT_TRANSFORM: fullscreen effects ignore x/y/scale/rotation, so
    // those keys would be dead data on every VFX clip.
    defaultSettings: { ...vfx.defaultSettings },
    schema: vfx.schema,
    draw({ ctx, w, h, settings, localTime, duration, clipId }) {
      let state = vfxClipStates.get(clipId);
      if (!state) {
        state = {};
        vfxClipStates.set(clipId, state);
      }
      pruneStaleStates();
      // In/Out transitions + continuous animations, like every other clip.
      // Per-effect save/restore keeps the transition alpha intact, and the
      // render loop contains whatever the def leaves behind.
      applyClipAnimations(ctx, settings, localTime, duration, vfx.type);
      vfx.draw({ ctx, w, h, settings, time: localTime, duration, state });
    },
  };
}

export const vfxClipDefinitions: ClipDefinition[] = vfxRegistry
  .list()
  .map(toClipDefinition);
