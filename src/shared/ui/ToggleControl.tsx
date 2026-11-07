interface Props {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleControl({ label, value, onChange }: Props) {
  return (
    <label className="flex items-center justify-between text-xs text-neutral-300">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
