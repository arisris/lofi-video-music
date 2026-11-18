// Adapter: renders a gl-viz FieldSchema (select options {value,label}, color
// alpha, image) into shared controls. Used by the glviz clip SettingsView.
import { ColorInput } from "../../shared/ui/ColorInput";
import { ScrubInput } from "../../shared/ui/ScrubInput";
import { SelectControl } from "../../shared/ui/Select";
import { SliderControl } from "../../shared/ui/SliderControl";
import { ToggleControl } from "../../shared/ui/ToggleControl";
import { useClipSettings } from "../../shared/hooks/useClipSettings";
import { useEditorStore } from "../../store/editor-store";
import { listVisualizerDefs, type FieldSchema } from "./index";

/**
 * Picks an image out of the media pool.
 *
 * Only the URL is stored, never the element. Settings survive HMR and route
 * swaps, and a detached HTMLImageElement in the store would not survive a
 * reload; the engine resolves the URL to a texture and caches it by URL.
 */
function ImageField({
  field,
  value,
  onChange,
}: {
  field: Extract<FieldSchema, { kind: "image" }>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const mediaPool = useEditorStore((s) => s.mediaPool);
  const images = mediaPool.filter((m) => m.type === "image");
  const stored = typeof value === "string" ? value : "";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="block text-[10px] text-neutral-500">
          {field.label}
        </span>
        {stored && (
          <button
            className="cursor-pointer text-[9px] text-neutral-500 hover:text-rose-400"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        )}
      </div>
      {images.length === 0 ? (
        <p className="text-[9px] leading-relaxed text-neutral-600">
          No images in the media pool. Add one from the Media tab, then pick it
          here.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-1">
          {images.map((img) => {
            const src = img.thumbnail || img.url;
            const active = img.url === stored;
            return (
              <button
                key={img.id || img.url}
                title={img.name || "image"}
                className={`aspect-square cursor-pointer overflow-hidden rounded border transition ${
                  active
                    ? "border-blue-500 ring-1 ring-blue-500/50"
                    : "border-neutral-700 hover:border-neutral-500"
                }`}
                onClick={() => onChange(img.url)}
              >
                <img
                  src={src}
                  alt={img.name || ""}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
      {field.hint && (
        <p className="mt-1.5 text-[9px] text-neutral-600">{field.hint}</p>
      )}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
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
      return (
        <ToggleControl
          label={field.label}
          value={value === true}
          onChange={onChange}
        />
      );
    case "select":
      return (
        <label className="flex items-center justify-between gap-2 text-xs text-neutral-300">
          <span>{field.label}</span>
          <SelectControl
            value={
              typeof value === "string" || typeof value === "number"
                ? String(value)
                : ""
            }
            options={field.options.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            onChange={(v) => onChange(v)}
            size="sm"
            wrapperClassName="w-32"
          />
        </label>
      );
    case "image":
      return <ImageField field={field} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

export function VisualizerSettings({
  clipId,
  variant,
}: {
  clipId: string;
  variant: string;
}) {
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
  const current =
    typeof values.variant === "string"
      ? values.variant
      : (defs[0]?.id ?? "bars");
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-neutral-300">
      <span>Variant</span>
      <SelectControl
        value={current}
        options={defs.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(v) => {
          const next = defs.find((d) => d.id === v);
          if (!next) {
            set("variant", v);
            return;
          }
          // Drop keys that belonged to the previous variant so stale values
          // (e.g. aura's glow leaking into bars) don't ride along forever.
          // Transform + animations keys are shared and must survive.
          const keep = new Set([
            "variant",
            "x",
            "y",
            "scaleX",
            "scaleY",
            "rotation",
            "originX",
            "originY",
            "animations",
            "enabled",
            "opacity",
            ...Object.keys(next.settings),
          ]);
          const store = useEditorStore.getState();
          const clip = store.clips.find((c) => c.id === clipId);
          const prevSettings = (clip?.settings ?? values) as Record<
            string,
            unknown
          >;
          const cleaned: Record<string, unknown> = { variant: v };
          for (const [k, val] of Object.entries(prevSettings)) {
            if (keep.has(k)) cleaned[k] = val;
          }
          for (const [k, nv] of Object.entries(next.settings)) {
            if (cleaned[k] === undefined) cleaned[k] = nv;
          }
          store.updateClip(clipId, { settings: cleaned });
        }}
        size="sm"
        wrapperClassName="w-32"
      />
    </label>
  );
}

// Re-export so the glviz clip can use ScrubInput when needed.
export { ScrubInput };
