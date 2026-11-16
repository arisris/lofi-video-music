import { useEffect } from "react";
import { useAnchoredMenu } from "../../shared/ui/anchored-menu";
import { useEditorStore } from "../../store/editor-store";

/** Right-click menu for a timeline clip (Duplicate / Delete). */
export function ClipContextMenu({
  x,
  y,
  clipId,
  onClose,
}: {
  x: number;
  y: number;
  clipId: string;
  onClose: () => void;
}) {
  const { ref, style } = useAnchoredMenu({ x, y });

  useEffect(() => {
    const close = (e: Event) => {
      const el = document.getElementById("clip-context-menu");
      if (!el || !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      id="clip-context-menu"
      className="fixed z-9999 min-w-35 rounded-lg border border-neutral-700/80 bg-neutral-900 py-1.5 shadow-2xl"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:bg-blue-600/20 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          useEditorStore.getState().duplicateClip(clipId);
          onClose();
        }}
      >
        <i className="icon-[ri--file-copy-line] h-3.5 w-3.5 text-blue-400" />
        <span>Duplicate Clip</span>
      </button>
      <button
        className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left text-xs text-neutral-300 transition-colors hover:bg-red-600/20 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          useEditorStore.getState().removeClip(clipId);
          onClose();
        }}
      >
        <i className="icon-[ri--delete-bin-line] h-3.5 w-3.5 text-red-400" />
        <span>Delete Clip</span>
      </button>
    </div>
  );
}
