// Reusable dropdown select — one look for the whole app.
// Replaces a dozen raw <select> elements scattered across inspectors,
// visualizer, and panels. Size variants follow the existing pattern:
// - "md": large field (font, text effect, ken-burns) px-3 py-2 text-xs
// - "sm": small field h-7 text-[10px] (weight, align, animation, style)
// Always appearance-none + custom chevron for consistency.
import type { CSSProperties } from "react";

export type SelectOption = string | { value: string; label: string };

function normalize(options: SelectOption[]): Array<{ value: string; label: string }> {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export function SelectControl({
  value,
  options,
  onChange,
  size = "md",
  wrapperClassName = "w-full",
  className = "",
  radius = "rounded",
  optionStyle,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  size?: "sm" | "md";
  wrapperClassName?: string;
  className?: string;
  radius?: "rounded" | "rounded-lg";
  optionStyle?: CSSProperties | ((value: string) => CSSProperties | undefined);
  ariaLabel?: string;
}) {
  const items = normalize(options);
  const sizeClass =
    size === "sm"
      ? "h-7 px-2 pr-7 text-[10px]"
      : "px-3 py-2 pr-8 text-xs";
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        aria-label={ariaLabel}
        className={`w-full cursor-pointer appearance-none border border-neutral-700 bg-neutral-800 text-neutral-200 transition-colors outline-none hover:bg-neutral-700/50 focus:border-blue-500/50 ${radius} ${sizeClass} ${className}`}
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        {items.map((o) => (
          <option
            key={o.value}
            value={o.value}
            style={
              typeof optionStyle === "function"
                ? optionStyle(o.value)
                : optionStyle
            }
          >
            {o.label}
          </option>
        ))}
      </select>
      <i className="pointer-events-none absolute top-1/2 right-2 icon-[ri--arrow-down-s-line] -translate-y-1/2 text-neutral-500" />
    </div>
  );
}
