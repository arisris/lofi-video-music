// Setting row with title + description + right-side control (Loop Video, Audio
// Reactive, Type Out) + its toggle pill.
export function SettingRow({
  title,
  description,
  control,
  padding = "md",
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
  padding?: "sm" | "md";
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-neutral-700/50 bg-neutral-800/40 ${padding === "sm" ? "p-2" : "p-2.5"}`}
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-neutral-300">{title}</span>
        {description && (
          <span className="text-[9px] text-neutral-500">{description}</span>
        )}
      </div>
      {control}
    </div>
  );
}

/** On/off toggle pill (mirrors the local ToggleButton in TextSettings + Overlay). */
export function TogglePill({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`relative h-4 w-8 shrink-0 cursor-pointer rounded-full transition-colors ${value ? "bg-blue-600" : "bg-neutral-700"}`}
      onClick={onToggle}
    >
      <div
        className={`absolute top-0.5 bottom-0.5 w-3 rounded-full bg-white transition-all ${
          value ? "right-0.5" : "left-0.5"
        }`}
      />
    </button>
  );
}
