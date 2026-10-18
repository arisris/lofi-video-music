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
  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
    <label className="mb-2 block text-xs font-bold tracking-wider text-slate-400 uppercase">
      {label}
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-blue-500"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
    {(minLabel || maxLabel) && (
      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-slate-500">
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
export const ToggleControl = ({
  label,
  checked,
  description,
  onChange,
}: ToggleControlProps) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked || false}
        className="h-4 w-4 rounded accent-blue-600"
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-xs font-bold text-slate-300">{label}</span>
    </label>
    {description && (
      <p className="mt-1 text-[10px] text-slate-500">{description}</p>
    )}
  </div>
);
