// Inspector label typography — two styles used at ~50 call sites:
// SectionTitle (uppercase heading) and FieldLabel (small label + right value).
// `className` replaces the default margin slot (mb-4 / mb-1.5) so no
// stacked Tailwind utilities conflict.
export function SectionTitle({
  children,
  className = "mb-4",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h4 className={`${className} text-[10px] font-bold tracking-widest text-neutral-500 uppercase`}>
      {children}
    </h4>
  );
}

export function FieldLabel({
  children,
  value,
  className = "mb-1.5",
}: {
  children: React.ReactNode;
  /** Right column (e.g. blue mono number). Forces flex justify-between layout. */
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`${className} text-[10px] text-neutral-500 ${value !== undefined ? "flex justify-between" : "block"}`}
    >
      {value !== undefined ? (
        <>
          <span>{children}</span>
          {value}
        </>
      ) : (
        children
      )}
    </label>
  );
}
