// Labeled slider: FieldLabel + value + RangeInput (+ optional Reset button).
// Used by inspectors and the generic schema; the old style (text-xs label +
// plain range) was replaced with the standard look for consistency with other clips.
import { FieldLabel } from "./FieldLabel";
import { RangeInput } from "./RangeInput";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Number format at the right of the label (default: String(value)). */
  format?: (v: number) => string;
  /** When present, show a Reset button next to the slider. */
  onReset?: () => void;
  accent?: "blue" | "emerald";
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  onReset,
  accent = "blue",
}: Props) {
  const text = format ? format(value) : String(value);
  const slider = (
    <RangeInput
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      accent={accent}
      ariaLabel={label}
      className={`h-1 cursor-pointer appearance-none rounded-full bg-neutral-800 ${onReset ? "flex-1" : "w-full"}`}
    />
  );
  return (
    <div>
      <FieldLabel
        value={<span className="font-mono text-[10px] text-blue-400">{text}</span>}
      >
        {label}
      </FieldLabel>
      {onReset ? (
        <div className="flex items-center gap-3">
          {slider}
          <button
            className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      ) : (
        slider
      )}
    </div>
  );
}
