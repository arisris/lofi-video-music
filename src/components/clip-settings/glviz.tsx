// Inspector for the "glviz" clip.
//
// The clip owns none of this: which controls exist, what they are called and
// what they default to all come from the selected definition's schema. This
// panel only adds the style switcher, because choosing a style replaces the
// whole settings set.

import { editorStore } from "../../store/editor-store";
import { getClipsToSearch } from "../../utils/helpers";
import { updateTimelineClipSettings } from "../../store/actions/timeline-actions";
import {
  getVisualizerDef,
  listVisualizerDefs,
  resolveVisualizerDef,
} from "../../lib/gl-viz";
import { SchemaFields } from "./fields";
import {
  SharedTransformSettingsView,
  SharedAnimationSettingsView,
} from "./shared";

interface ClipViewProps {
  clip?: Record<string, any>;
}

/** Settings panel for the "glviz" timeline clip. */
export const GlvizSettingsView = ({ clip }: ClipViewProps) => {
  const clipsToSearch = getClipsToSearch(editorStore.getState());
  const selectedClip =
    clip ||
    clipsToSearch.find(
      (c: any) =>
        c.id === editorStore.getState().selectedClipId && c.type === "glviz",
    );

  if (!selectedClip) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 italic">
        Select a shader visualizer from the list to change settings
      </div>
    );
  }

  const settings = selectedClip.settings as Record<string, any>;
  const def = resolveVisualizerDef(settings.style as string);
  const defs = listVisualizerDefs();

  if (!def) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 italic">
        No shader visualizers are registered
      </div>
    );
  }

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  // A definition's defaults are its own, so switching style replaces the
  // settings rather than merging into whatever the previous style left behind.
  const selectStyle = (id: string) => {
    const next = getVisualizerDef(id);
    if (!next) return;
    update({ style: id, ...next.settings });
  };

  return (
    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 duration-300">
      <div>
        <label className="mb-1.5 block text-[10px] text-slate-500">Style</label>
        <select
          className="h-7 w-full rounded border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300 outline-none"
          value={settings.style ?? def.id}
          onChange={(e) => selectStyle(e.target.value)}
        >
          {defs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <SchemaFields
        fields={def.fields}
        settings={settings}
        onChange={(key, value) => update({ [key]: value })}
      />

      <SharedTransformSettingsView
        settings={settings}
        updateSettings={update}
      />
      <SharedAnimationSettingsView
        settings={settings}
        updateSettings={update}
      />
    </div>
  );
};
