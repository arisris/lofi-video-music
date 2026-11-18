// Panel/inspector button — variants reused across the app:
// - ghost: neutral full-width button (Load More x3 in MediaLibraryPanel)
// - primary: blue action (Apply to All in MusicSettings)
// - secondary: full neutral action (Replace Media Source in OverlaySettings)
// - mini: small Reset button next to sliders
// - icon: square icon button (LyricsPanel gear, + SyncEditor) + plain iconGhost.
import type { CSSProperties } from "react";

const BASE =
  "cursor-pointer items-center justify-center transition-all disabled:cursor-wait disabled:opacity-50";

const VARIANTS: Record<string, string> = {
  ghost:
    "bg-neutral-850 flex w-full gap-1.5 rounded-lg border border-neutral-700 py-2 text-[10px] font-bold tracking-wider text-neutral-300 uppercase hover:border-neutral-600 hover:bg-neutral-800 hover:text-white",
  primary:
    "flex w-full gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs font-bold tracking-wider text-blue-400 uppercase hover:bg-blue-500 hover:text-white",
  secondary:
    "flex w-full gap-2 rounded border border-neutral-700 bg-neutral-800 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700",
  mini: "rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white",
  icon: "shrink-0 rounded-lg border text-neutral-300 transition-colors hover:border-blue-500/40 hover:bg-blue-600/15 hover:text-blue-400",
  iconGhost: "text-neutral-500 transition-colors hover:text-white",
};

export function Button({
  variant = "ghost",
  size = "md",
  children,
  onClick,
  disabled,
  title,
  ariaLabel,
  className = "",
  style,
}: {
  variant?: "ghost" | "primary" | "secondary" | "mini" | "icon" | "iconGhost";
  /** Only for the icon/iconGhost variants. */
  size?: "sm" | "md";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const sizing =
    variant === "icon"
      ? size === "md"
        ? "flex h-11 w-11 border-neutral-700/50 bg-neutral-800/40"
        : "flex w-9 self-stretch border-neutral-700 bg-neutral-800"
      : variant === "iconGhost"
        ? "p-1"
        : "flex";
  return (
    <button
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`${BASE} ${VARIANTS[variant]} ${sizing} ${className} outline-none focus-visible:outline-2 focus-visible:outline-blue-500`}
    >
      {children}
    </button>
  );
}
