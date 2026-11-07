import { useEffect, useRef, useState } from "react";
import { formatLrcTime, parseTimeInput } from "../../modules/lyrics/lyrics";

export interface TimeInputProps {
  label: string;
  value: number | null;
  onUpdate: (value: number | null) => void;
  /**
   * Formatted time shown in place of the value while `value` is null. Passing
   * the derived end here lets a line show where it actually stops even though
   * nothing has been written down yet.
   */
  autoFrom?: number;
  /**
   * Called the moment the user puts a cursor in this field, however they got
   * there - a click on the label, or tabbing along the row.
   */
  onActivate?: () => void;
  /**
   * Greys the field out and refuses input. For a value that cannot mean
   * anything yet - an end time on a line with no start, which the renderer
   * ignores outright, so accepting one would look like it worked.
   */
  disabled?: boolean;
}

/**
 * Typeable time field in `mm:ss.xx`.
 *
 * Verbatim port of src_old/components/ui/time-input.tsx: raw second counts
 * are unreadable past one minute, and a plain ScrubInput shows exactly
 * that — this field formats the same number every LRC surface uses
 * and parses `mm:ss.xx`, `m:ss`, `ss.xx` or plain `ss` back.
 */
export const TimeInput = ({
  label,
  value,
  onUpdate,
  autoFrom,
  onActivate,
  disabled = false,
}: TimeInputProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  /**
   * Set the instant the field closes on purpose.
   *
   * Closing unmounts the input, and Enter sets state in the same tick as the
   * commit - without this the blur that follows would save a second time, and
   * an Escape would be undone by the very blur it caused.
   */
  const closedRef = useRef(false);

  /**
   * Select the existing value once, when the field opens.
   *
   * An effect keyed on the open state fires exactly once, so typing is never
   * interrupted by re-selection on re-render.
   */
  useEffect(() => {
    if (!isEditing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [isEditing]);

  /** One place to report the cursor arriving, however that happened. */
  const activate = () => {
    if (isEditing) return;
    closedRef.current = false;
    setIsEditing(true);
    onActivate?.();
  };

  const commitTyped = (raw: string) => {
    if (!raw.trim()) {
      onUpdate(null);
      return;
    }
    const parsed = parseTimeInput(raw);
    if (Number.isFinite(parsed)) onUpdate(parsed);
  };

  /**
   * Leaves the editor, saving unless the user asked to cancel.
   *
   * Leaving a field commits now: typing looked refused when blur threw the
   * number away the moment somebody clicked the next field instead of
   * pressing Enter.
   */
  const close = (raw: string, commit: boolean) => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (commit) commitTyped(raw);
    setIsEditing(false);
  };

  // The last timed line runs until the playhead leaves the clip, which arrives
  // here as Infinity - formatLrcTime would turn that into "Infinity:NaN".
  const derived =
    autoFrom !== undefined && Number.isFinite(autoFrom) ? autoFrom : undefined;

  if (disabled)
    return (
      <div
        title="This line has no start yet, so it never reaches the canvas - set its start first."
        className="flex h-7 min-w-0 flex-1 cursor-not-allowed items-center overflow-hidden rounded border border-neutral-800/50 bg-neutral-900/30 opacity-40"
      >
        <div className="flex h-full w-5 flex-none items-center justify-center border-r border-neutral-800/50 bg-neutral-950/40 text-[9px] font-bold text-neutral-600 select-none">
          {label}
        </div>
        <span className="px-1.5 font-mono text-[10px] text-neutral-600">--:--</span>
      </div>
    );

  return (
    <div className="group flex h-7 min-w-0 flex-1 items-center overflow-hidden rounded border border-neutral-700/50 bg-neutral-800/40 transition-all hover:border-neutral-600 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/50">
      <div
        className="flex h-full w-5 flex-none cursor-pointer items-center justify-center border-r border-neutral-700/50 bg-neutral-900/40 text-[9px] font-bold text-neutral-500 transition-colors select-none hover:text-blue-400"
        onClick={activate}
        title="Click to type a time"
      >
        {label}
      </div>

      {isEditing ? (
        <input
          ref={editRef}
          type="text"
          // Only a value that was really written down gets prefilled. A derived
          // one goes in as a placeholder instead, so opening the field and
          // pressing Enter leaves it derived.
          defaultValue={value !== null ? formatLrcTime(value) : ""}
          placeholder={derived === undefined ? "0:00.00" : formatLrcTime(derived)}
          className="h-full w-full min-w-0 flex-1 bg-neutral-900 px-1.5 font-mono text-[10px] text-white outline-none"
          onFocus={() => onActivate?.()}
          onBlur={(e) => close(e.currentTarget.value, true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") close(e.currentTarget.value, true);
            if (e.key === "Escape") close(e.currentTarget.value, false);
          }}
        />
      ) : (
        <div
          className="flex h-full min-w-0 flex-1 cursor-text items-center px-1.5 font-mono text-[10px] select-none"
          onClick={activate}
        >
          {value !== null ? (
            <span className="text-neutral-200">{formatLrcTime(value)}</span>
          ) : derived !== undefined ? (
            // Derived, not pinned - but still a real number. The dotted rule
            // marks it as "follows the next line" rather than a typed value.
            <span
              className="text-neutral-300 underline decoration-neutral-600 decoration-dotted underline-offset-2"
              title="Follows the next line - click to pin this value"
            >
              {formatLrcTime(derived)}
            </span>
          ) : autoFrom === Infinity ? (
            <span
              className="text-neutral-300 underline decoration-neutral-600 decoration-dotted underline-offset-2"
              title="Runs until the track ends - tap E to close it"
            >
              &#8734;
            </span>
          ) : (
            <span className="text-neutral-600">--:--</span>
          )}
        </div>
      )}
    </div>
  );
};
