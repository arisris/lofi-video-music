// Adapter: renders a gl-viz FieldSchema (select options {value,label}, color
// alpha, image) into shared controls. Used by the glviz clip SettingsView.
import { ColorInput } from "../../shared/ui/ColorInput";
import { TextInput } from "../../shared/ui/TextInput";
import { ScrubInput } from "../../shared/ui/ScrubInput";
import { SelectControl } from "../../shared/ui/Select";
import { SliderControl } from "../../shared/ui/SliderControl";
import { ToggleControl } from "../../shared/ui/ToggleControl";
import { useClipSettings } from "../../shared/hooks/useClipSettings";
import { listVisualizerDefs, type FieldSchema } from "./index";

function Field({ field, value, onChange }: { field: FieldSchema; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.kind) {
    case "slider":
      return (
        <SliderControl
          label={field.label}
          value={typeof value === "number" ? value : 0}
          min={field.min}
          max={field.max}
          step={field.step ?? 0.01}
          onChange={onChange}
        />
      );
    case "color":
      return (
        <ColorInput
          label={field.label}
          value={typeof value === "string" ? value : "#ffffff"}
          onChange={(v) => onChange(v)}
        />
      );
    case "toggle":
      return <ToggleControl label={field.label} value={value === true} onChange={onChange} />;
    case "select":
      return (
        <label className="flex items-center justify-between gap-2 text-xs text-neutral-300">
          <span>{field.label}</span>
          <SelectControl
            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
            options={field.options.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => onChange(v)}
            size="sm"
            wrapperClassName="w-32"
          />
        </label>
      );
    case "image":
      return (
        <label className="flex items-center justify-between gap-2 text-xs text-neutral-300">
          <span>{field.label}</span>
          <TextInput
            value={typeof value === "string" ? value : ""}
            placeholder={field.hint ?? "image URL"}
            onChange={(v) => onChange(v)}
            ariaLabel={field.label}
          />
        </label>
      );
    default:
      return null;
  }
}

export function VisualizerSettings({ clipId, variant }: { clipId: string; variant: string }) {
  const { values, set } = useClipSettings(clipId);
  const defs = listVisualizerDefs();
  const def = defs.find((d) => d.id === variant) ?? defs[0];
  if (!def) return null;
  return (
    <div className="space-y-2">
      {def.fields.map((f) => (
        <Field
          key={f.key}
          field={f}
          value={values[f.key] ?? def.settings[f.key]}
          onChange={(v) => set(f.key, v)}
        />
      ))}
    </div>
  );
}

export function VisualizerVariantSelect({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const defs = listVisualizerDefs();
  const current = typeof values.variant === "string" ? values.variant : (defs[0]?.id ?? "bars");
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-neutral-300">
      <span>Variant</span>
      <SelectControl
        value={current}
        options={defs.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(v) => {
          const next = defs.find((d) => d.id === v);
          set("variant", v);
          if (next) {
            for (const [k, nv] of Object.entries(next.settings)) {
              if (values[k] === undefined) set(k, nv);
            }
          }
        }}
        size="sm"
        wrapperClassName="w-32"
      />
    </label>
  );
}

// Re-export so the glviz clip can use ScrubInput when needed.
export { ScrubInput };
