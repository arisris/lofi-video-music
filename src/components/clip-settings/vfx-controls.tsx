export interface SliderControlProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  minLabel?: string;
  maxLabel?: string;
  onChange: (value: number) => void;
}

/** A modular slider component. */
export const SliderControl = ({
  label,
  min,
  max,
  step,
  value,
  minLabel,
  maxLabel,
  onChange,
}: SliderControlProps) => (
  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      className="w-full cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none accent-blue-500"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
    {(minLabel || maxLabel) && (
      <div className="flex justify-between text-[9px] text-slate-500 mt-1.5 font-mono">
        <span>{minLabel || ""}</span>
        <span>{maxLabel || ""}</span>
      </div>
    )}
  </div>
);

export interface ToggleControlProps {
  label: string;
  checked?: boolean;
  description?: string;
  onChange: (checked: boolean) => void;
}

/** A modular toggle checkbox component. */
export const ToggleControl = ({ label, checked, description, onChange }: ToggleControlProps) => (
  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked || false}
        className="w-4 h-4 accent-blue-600 rounded"
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-xs font-bold text-slate-300">{label}</span>
    </label>
    {description && <p className="text-[10px] text-slate-500 mt-1">{description}</p>}
  </div>
);
