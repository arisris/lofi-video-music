import { ScrubInput } from "./scrub-input";

export interface ColorInputProps {
  label: string;
  value?: string;
  onUpdate: (value: string) => void;
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

/** Combined color picker / hex text field / alpha scrubber. */
export const ColorInput = ({ label, value, onUpdate }: ColorInputProps) => {
  const currentHex = getHex(value ?? "");
  const currentAlpha = getAlpha(value ?? "");

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[10px] text-slate-500">{label}</label>
      <div className="flex h-7 items-center overflow-hidden rounded border border-slate-700/50 bg-slate-800/40 transition-all focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50">
        {/* 1. Color Picker Area */}
        <div className="relative flex h-full w-10 flex-none items-center justify-center border-r border-slate-700/50 bg-slate-900/20">
          <input
            type="color"
            className="h-5 w-6 cursor-pointer rounded-sm border-none bg-transparent p-0"
            value={currentHex}
            onChange={(e) => {
              const newAlpha = currentAlpha === 0 ? 1 : currentAlpha;
              onUpdate(hexToRgba(e.target.value, newAlpha));
            }}
          />
          {currentAlpha < 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/40">
              <i className="icon-[ri--contrast-drop-2-line] text-[10px] text-white/50" />
            </div>
          )}
        </div>

        {/* 2. Text Input */}
        <input
          type="text"
          className={`h-full flex-1 border-none bg-transparent px-2 font-mono text-slate-300 outline-none ${
            (value ?? "").length > 15 ? "text-[9px]" : "text-[10px]"
          }`}
          value={value || "#000000"}
          onChange={(e) => onUpdate(e.target.value)}
        />

        {/* 3. Alpha Slider */}
        <div className="h-full w-14 flex-none border-l border-slate-700/50">
          <ScrubInput
            label=""
            value={currentAlpha}
            step={0.01}
            min={0}
            max={1}
            ghost={true}
            onUpdate={(val) => onUpdate(hexToRgba(currentHex, val))}
          />
        </div>
      </div>
    </div>
  );
};
