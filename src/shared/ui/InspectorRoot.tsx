// Root wrapper for every SettingsView inspector (enter animation + space-y).
export function InspectorRoot({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`animate-in fade-in slide-in-from-top-2 space-y-4 duration-300 ${className}`}>
      {children}
    </div>
  );
}
