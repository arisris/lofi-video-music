// Central keyboard shortcut registry: single source for the help dialog
// and the global keydown handler (use-global-shortcuts).
export type ShortcutGroup = "Playback" | "Editing" | "General";

export interface ShortcutDef {
  id: string;
  group: ShortcutGroup;
  keys: string;
  description: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: "play-pause", group: "Playback", keys: "Space / K", description: "Play or pause" },
  { id: "seek-back", group: "Playback", keys: "Left", description: "Back 1 second (Shift: 5 seconds)" },
  { id: "seek-forward", group: "Playback", keys: "Right", description: "Forward 1 second (Shift: 5 seconds)" },
  { id: "go-start", group: "Playback", keys: "Home", description: "Go to start" },
  { id: "go-end", group: "Playback", keys: "End", description: "Go to end" },
  { id: "undo", group: "Editing", keys: "Ctrl+Z", description: "Undo" },
  { id: "redo", group: "Editing", keys: "Ctrl+Shift+Z / Ctrl+Y", description: "Redo" },
  { id: "delete-clip", group: "Editing", keys: "Del", description: "Delete selected clip" },
  { id: "duplicate-clip", group: "Editing", keys: "Ctrl+D", description: "Duplicate selected clip" },
  { id: "deselect", group: "Editing", keys: "Esc", description: "Deselect / close dialog" },
  { id: "help", group: "General", keys: "? or Ctrl+/", description: "Open shortcut help" },
];

/** Typing targets: shortcuts stay silent while the user types. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable
  );
}
