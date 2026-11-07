// Themed range input — the single definition of the standard track look.
// `className` fully replaces the layout portion (default = standard look);
// `accent` picks the thumb/fill color.
export function RangeInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  accent = "blue",
  className = "h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-800",
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accent?: "blue" | "emerald";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      className={`${className} ${accent === "emerald" ? "accent-emerald-500" : "accent-blue-500"}`}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
