// Single-line panel-style text input (generic schema + visualizer).
export function TextInput({
  value,
  onChange,
  placeholder,
  className = "w-32",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      className={`rounded bg-neutral-800 px-2 py-1 text-neutral-100 outline-none ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
