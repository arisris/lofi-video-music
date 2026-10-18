// Generic settings controls driven by a visualizer's FieldSchema.
//
// Each VisualizerDef declares only what it needs; this renders those controls
// so a new visualizer never ships its own hand-written inspector. Kept
// deliberately dumb - it reads settings and reports changes, nothing else.

import type { FieldSchema } from "../../lib/gl-viz/types";
import { useEditorStore } from "../../store/editor-store";

interface FieldsProps {
  fields: FieldSchema[];
  settings: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

const LABEL = "block text-[10px] text-slate-500 mb-1.5";
const VALUE = "text-[10px] text-slate-600 font-mono";

/** Match the displayed precision to the slider step so 0.25 never reads as 0.3. */
const decimalsFor = (step?: number): number => {
  if (!step || step >= 1) return 0;
  const frac = String(step).split(".")[1];
  return frac ? Math.min(frac.length, 3) : 2;
};

const readNumber = (settings: Record<string, unknown>, key: string, min: number, max: number): number => {
  const raw = settings[key];
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : min;
  return Math.min(max, Math.max(min, n));
};

const SliderField = ({ field, settings, onChange }: {
  field: Extract<FieldSchema, { kind: "slider" }>;
  settings: Record<string, unknown>;
  onChange: FieldsProps["onChange"];
}) => {
  const value = readNumber(settings, field.key, field.min, field.max);
  return (
    <div>
      <label className={`${LABEL} flex justify-between items-baseline`}>
        <span>{field.label}</span>
        <span className={VALUE}>
          {`${(value * (field.scale ?? 1)).toFixed(decimalsFor(field.step))}${field.unit ?? ""}`}
        </span>
      </label>
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={value}
        className="w-full accent-blue-500"
        onChange={(e) => onChange(field.key, parseFloat(e.target.value))}
      />
    </div>
  );
};

const ColorField = ({ field, settings, onChange }: {
  field: Extract<FieldSchema, { kind: "color" }>;
  settings: Record<string, unknown>;
  onChange: FieldsProps["onChange"];
}) => {
  const raw = settings[field.key];
  const value = typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? raw : "#3b82f6";
  return (
    <div>
      <label className={`${LABEL} flex justify-between items-baseline`}>
        <span>{field.label}</span>
        <span className={VALUE}>{value.toUpperCase()}</span>
      </label>
      <input
        type="color"
        value={value}
        className="w-full h-8 bg-transparent cursor-pointer rounded border border-slate-700"
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </div>
  );
};

const ToggleField = ({ field, settings, onChange }: {
  field: Extract<FieldSchema, { kind: "toggle" }>;
  settings: Record<string, unknown>;
  onChange: FieldsProps["onChange"];
}) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={settings[field.key] === true}
      className="w-4 h-4 accent-blue-600 rounded"
      onChange={(e) => onChange(field.key, e.target.checked)}
    />
    <span className="text-[10px] text-slate-400">{field.label}</span>
  </label>
);

const SelectField = ({ field, settings, onChange }: {
  field: Extract<FieldSchema, { kind: "select" }>;
  settings: Record<string, unknown>;
  onChange: FieldsProps["onChange"];
}) => {
  const raw = settings[field.key];
  const value = typeof raw === "string" ? raw : field.options[0]?.value ?? "";
  return (
    <div>
      <label className={LABEL}>{field.label}</label>
      <select
        className="w-full bg-slate-800 border border-slate-700 rounded px-2 h-7 text-[10px] text-slate-300 outline-none"
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
};

/**
 * Picks an image out of the media pool.
 *
 * Only the URL is stored, never the element. Settings survive HMR and route
 * swaps, and a detached HTMLImageElement in the store would not survive a
 * reload; the engine resolves the URL to a texture and caches it by URL.
 */
const ImageField = ({ field, settings, onChange }: {
  field: Extract<FieldSchema, { kind: "image" }>;
  settings: Record<string, unknown>;
  onChange: FieldsProps["onChange"];
}) => {
  const mediaPool = useEditorStore((s) => s.mediaPool);
  const images = mediaPool.filter((m) => m.type === "image");
  const raw = settings[field.key];
  const value = typeof raw === "string" ? raw : "";

  return (
    <div>
      <div className={`${LABEL} flex justify-between items-baseline`}>
        <span>{field.label}</span>
        {value && (
          <button
            className="text-[9px] text-slate-500 hover:text-rose-400 cursor-pointer"
            onClick={() => onChange(field.key, "")}
          >
            Clear
          </button>
        )}
      </div>
      {images.length === 0 ? (
        <p className="text-[9px] text-slate-600 leading-relaxed">
          No images in the media pool. Add one from the Media tab, then pick it here.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-1">
          {images.map((img) => {
            const src = (img.thumbnail as string | null) || img.url;
            const active = img.url === value;
            return (
              <button
                key={img.id || img.url}
                title={img.name || "image"}
                className={`aspect-square rounded border overflow-hidden cursor-pointer transition ${
                  active ? "border-blue-500 ring-1 ring-blue-500/50" : "border-slate-700 hover:border-slate-500"
                }`}
                onClick={() => onChange(field.key, img.url)}
              >
                <img src={src} alt={img.name || ""} className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
      {field.hint && <p className="mt-1.5 text-[9px] text-slate-600">{field.hint}</p>}
    </div>
  );
};

/** Renders a definition's controls in declaration order. */
export const SchemaFields = ({ fields, settings, onChange }: FieldsProps) => {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        switch (field.kind) {
          case "slider":
            return <SliderField key={field.key} field={field} settings={settings} onChange={onChange} />;
          case "color":
            return <ColorField key={field.key} field={field} settings={settings} onChange={onChange} />;
          case "toggle":
            return <ToggleField key={field.key} field={field} settings={settings} onChange={onChange} />;
          case "select":
            return <SelectField key={field.key} field={field} settings={settings} onChange={onChange} />;
          case "image":
            return <ImageField key={field.key} field={field} settings={settings} onChange={onChange} />;
        }
      })}
    </div>
  );
};