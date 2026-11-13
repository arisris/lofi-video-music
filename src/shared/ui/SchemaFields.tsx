// Generic renderer for FieldSchema. Every clip inspector uses this,
// so there is no more Slider/Scrub/Color triple-copy per clip.
// Covers the old per-clip fields/shared/vfx-controls panels in one place.
import type { FieldSchema } from "../types/clip";
import { ColorInput } from "./ColorInput";
import { ScrubInput } from "./ScrubInput";
import { TextInput } from "./TextInput";
import { SelectControl } from "./Select";
import { SliderControl } from "./SliderControl";
import { ToggleControl } from "./ToggleControl";

interface Props {
  schema: FieldSchema[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function bool(v: unknown): boolean {
  return v === true;
}

export function SchemaFields({ schema, values, onChange }: Props) {
  if (schema.length === 0) return null;
  return (
    <div className="space-y-2">
      {schema.map((f) => {
        const v = values[f.key];
        switch (f.kind) {
          case "slider":
            return (
              <SliderControl
                key={f.key}
                label={f.label}
                value={num(v)}
                min={f.min ?? 0}
                max={f.max ?? 100}
                step={f.step ?? 1}
                onChange={(nv) => onChange(f.key, nv)}
              />
            );
          case "number":
            return (
              <ScrubInput
                key={f.key}
                label={f.label}
                value={num(v)}
                onChange={(nv) => onChange(f.key, nv)}
              />
            );
          case "color":
            return (
              <ColorInput
                key={f.key}
                label={f.label}
                value={str(v, "#ffffff")}
                onChange={(nv) => onChange(f.key, nv)}
              />
            );
          case "toggle":
            return (
              <ToggleControl
                key={f.key}
                label={f.label}
                value={bool(v)}
                onChange={(nv) => onChange(f.key, nv)}
              />
            );
          case "select":
            return (
              <label
                key={f.key}
                className="flex items-center justify-between gap-2 text-xs text-neutral-300"
              >
                <span>{f.label}</span>
                <SelectControl
                  value={str(v)}
                  options={f.options ?? []}
                  onChange={(nv) => onChange(f.key, nv)}
                  size="sm"
                  wrapperClassName="w-32"
                />
              </label>
            );
          case "text":
          default:
            return (
              <label
                key={f.key}
                className="flex items-center justify-between gap-2 text-xs text-neutral-300"
              >
                <span>{f.label}</span>
                <TextInput
                  value={str(v)}
                  placeholder={f.placeholder}
                  onChange={(nv) => onChange(f.key, nv)}
                  ariaLabel={f.label}
                />
              </label>
            );
        }
      })}
    </div>
  );
}
