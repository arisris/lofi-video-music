// Segmented tab group — Sync/Raw/LRC pill in LyricsPanel (md) and
// Solid/Gradient toggle in ShapeSettings (xs).
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "md" | "xs";
}) {
  if (size === "xs") {
    return (
      <div className="flex rounded border border-neutral-800 bg-neutral-900 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            className={`cursor-pointer rounded px-2 py-0.5 text-[9px] font-semibold transition-all ${
              value === o.value
                ? "bg-neutral-800 text-neutral-200"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-none gap-1 rounded-xl border border-neutral-800 bg-neutral-950/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors ${
            value === o.value
              ? "bg-blue-600/20 text-blue-400"
              : "text-neutral-500 hover:bg-neutral-800/60 hover:text-neutral-300"
          }`}
        >
          {o.icon && <i className={`${o.icon} h-3.5 w-3.5`} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
