// Empty placeholder (icon search results, unregistered shader, etc.).
export function EmptyState({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`py-8 text-center text-xs text-neutral-500 italic ${className}`}
    >
      {children}
    </div>
  );
}
