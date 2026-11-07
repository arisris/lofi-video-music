// Inspector panel card — `rounded-lg border bg-neutral-800/40` frame
// reused across every clip SettingsView.
// `spacing` controls the gap between children, `title`/`action` fill the header.
export function Card({
  title,
  action,
  children,
  spacing,
  padding = "md",
  radius = "lg",
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  spacing?: "sm" | "md";
  padding?: "sm" | "md" | "none";
  radius?: "lg" | "xl";
  className?: string;
}) {
  const pad = padding === "md" ? "p-4" : padding === "sm" ? "p-2.5" : "";
  const gap = spacing === "sm" ? "space-y-3" : spacing === "md" ? "space-y-4" : "";
  const r = radius === "xl" ? "rounded-xl" : "rounded-lg";
  return (
    <div className={`${gap} ${r} border border-neutral-700/50 bg-neutral-800/40 ${pad} ${className}`}>
      {title !== undefined && (
        <div className={`flex items-center justify-between ${spacing ? "" : "mb-3"}`}>
          <label className="block text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
            {title}
          </label>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
