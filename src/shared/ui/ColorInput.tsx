// Combined color picker / hex text field / alpha scrubber.
// `onChange` is an
// alias of `onUpdate` for new callers.
import { useState, type ReactNode } from "react";
import { ScrubInput } from "./ScrubInput";

export interface ColorInputProps {
  label: ReactNode;
  value?: string;
  onUpdate?: (value: string) => void;
  /** onUpdate alias (new API). */
  onChange?: (value: string) => void;
}

// Helper to convert hex to rgba if needed
const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || hex === "transparent") return "transparent";
  if (!hex.startsWith("#")) return hex; // Already rgba or named
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper to get alpha from rgba string
const getAlpha = (val: string) => {
  if (val === "transparent") return 0;
  if (!val) return 1;
  if (val.startsWith("#")) return 1;
  const match = val.match(/rgba?\(.*,\s*([\d.]+)\)/);
  return match ? parseFloat(match[1]) : 1;
};

// Helper to get hex from rgba
const getHex = (val: string) => {
  if (!val || val === "transparent") return "#000000";
  if (val.startsWith("#")) return val.slice(0, 7);
  const match = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return "#000000";
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
};

export function ColorInput({
  label,
  value,
  onUpdate,
  onChange,
}: ColorInputProps) {
  const emit = onUpdate ?? onChange ?? (() => {});
  const currentHex = getHex(value ?? "");
  const currentAlpha = getAlpha(value ?? "");
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    // Accept #rgb/#rrggbb/rgba()/named; fall back to the previous value on
    // garbage instead of storing an invalid string that flashes the picker.
    const t = draft.trim();
    const ok =
      t === "" ||
      t === "transparent" ||
      /^#[0-9a-f]{3,8}$/i.test(t) ||
      /^rgba?\(/i.test(t) ||
      /^[a-z]+$/i.test(t);
    if (ok && t !== "") emit(t);
    setDraft(null);
  };

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[10px] text-neutral-500">
        {label}
      </label>
      <div className="flex h-7 items-center overflow-hidden rounded border border-neutral-700/50 bg-neutral-800/40 transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50">
        {/* 1. Color Picker Area */}
        <div className="relative flex h-full w-10 flex-none items-center justify-center border-r border-neutral-700/50 bg-neutral-900/20">
          <input
            type="color"
            className="h-5 w-6 cursor-pointer rounded-sm border-none bg-transparent p-0"
            value={currentHex}
            onChange={(e) => {
              const newAlpha = currentAlpha === 0 ? 1 : currentAlpha;
              emit(hexToRgba(e.target.value, newAlpha));
            }}
          />
          {currentAlpha < 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-900/40">
              <i className="icon-[ri--contrast-drop-2-line] text-[10px] text-white/50" />
            </div>
          )}
        </div>

        {/* 2. Text Input (uncontrolled while typing, commits on blur/Enter) */}
        <input
          type="text"
          className={`h-full flex-1 border-none bg-transparent px-2 font-mono text-neutral-300 outline-none ${
            (value ?? "").length > 15 ? "text-[9px]" : "text-[10px]"
          }`}
          key={`color-${value ?? ""}`}
          defaultValue={value || "#000000"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              (e.target as HTMLInputElement).value = value || "#000000";
              setDraft(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />

        {/* 3. Alpha Slider */}
        <div className="h-full w-14 flex-none border-l border-neutral-700/50">
          <ScrubInput
            label=""
            value={currentAlpha}
            step={0.01}
            min={0}
            max={1}
            ghost={true}
            onUpdate={(val) => emit(hexToRgba(currentHex, val))}
          />
        </div>
      </div>
    </div>
  );
}
