// Single-option grid — used for the shape type grid (icon card
// tone) and the lyric In/Out transition grids (text chip tone).
// `columns` maps to literal classes so Tailwind can detect them.
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
  tone = "chip",
}: {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
  tone?: "chip" | "card";
}) {
  const cols = columns === 4 ? "grid-cols-4" : columns === 2 ? "grid-cols-2" : "grid-cols-3";
  if (tone === "card") {
    return (
      <div className={`grid ${cols} gap-1.5`}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded border px-1 py-1.5 text-[9px] font-semibold transition-all ${
                active
                  ? "border-blue-500/40 bg-blue-600/20 text-blue-400"
                  : "border-neutral-800 bg-neutral-900/45 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
              onClick={() => onChange(o.value)}
            >
              {o.icon && <i className={`${o.icon} h-3.5 w-3.5`} />}
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className={`grid ${cols} gap-1`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded border px-1 py-1.5 text-[9px] font-bold transition-colors ${
              active
                ? "border-blue-600/40 bg-blue-600/20 text-blue-400"
                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700/50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
