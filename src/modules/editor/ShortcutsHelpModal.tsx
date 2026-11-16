import { useEffect, useRef } from "react";
import { SHORTCUTS, type ShortcutGroup } from "../../shared/lib/shortcuts";
import { useEditorStore } from "../../store/editor-store";

const GROUPS: ShortcutGroup[] = ["Playback", "Editing", "General"];

/** Shortcut help dialog: grouped shortcut list, backdrop click closes,
 * focus moves to Close on open and returns to the trigger on close. */
export function ShortcutsHelpModal() {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const el = prevFocus.current;
      if (el instanceof HTMLElement) el.focus();
    };
  }, []);

  const close = () => useEditorStore.setState({ showShortcutsHelp: false });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-xs font-bold tracking-wider text-neutral-100 uppercase">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={close}
            className="rounded-md p-1.5 text-neutral-500 transition-colors outline-none hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <i className="icon-[ri--close-line] block h-4 w-4" />
          </button>
        </div>
        <div className="custom-scrollbar max-h-96 overflow-y-auto p-4">
          {GROUPS.map((group) => (
            <div key={group} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                {group}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-neutral-300">{s.description}</span>
                    <kbd className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
