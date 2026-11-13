// Glviz clip inspector
// style picker (replaces settings with the definition defaults, not a merge),
// definition schema controls, then Transform + Animations.
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { useEditorStore } from "../../../store/editor-store";
import { SelectControl } from "../../../shared/ui/Select";
import { getVisualizerDef, listVisualizerDefs } from "../../visualizers";
import { VisualizerSettings } from "../../visualizers/VisualizerSettings";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { FieldLabel } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { AnimationSettings, TransformSettings } from "./TextSettings";

export function GlvizSettingsView({ clipId }: { clipId: string }) {
  const { values } = useClipSettings(clipId);
  const updateClipSettings = useEditorStore((s) => s.updateClipSettings);
  const defs = listVisualizerDefs();
  const current = typeof values.variant === "string" ? values.variant : (defs[0]?.id ?? "");

  const selectStyle = (id: string) => {
    const next = getVisualizerDef(id);
    if (!next) return;
    // Definition defaults are standalone — replace settings, don't merge.
    updateClipSettings(clipId, { variant: id, ...next.settings });
  };

  if (defs.length === 0) {
    return <EmptyState>No shader visualizers are registered</EmptyState>;
  }

  return (
    <InspectorRoot>
      <div>
        <FieldLabel>Style</FieldLabel>
        <SelectControl
          value={current}
          options={defs.map((d) => ({ value: d.id, label: d.name }))}
          onChange={selectStyle}
          size="sm"
        />
      </div>

      <VisualizerSettings clipId={clipId} variant={current} />

      <TransformSettings clipId={clipId} />
      <AnimationSettings clipId={clipId} />
    </InspectorRoot>
  );
}
