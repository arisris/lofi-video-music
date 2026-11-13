// Scrubbable (drag-to-change) + manual input number field.
// `onChange` is an
// alias of `onUpdate` for new callers (SchemaFields, VisualizerSettings).
import { useEffect, useRef, useState } from "react";

export interface ScrubInputProps {
  label?: string;
  value: number;
  onUpdate?: (value: number) => void;
  /** onUpdate alias (new API). */
  onChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  ghost?: boolean;
}

export function ScrubInput({
  label,
  value,
  onUpdate,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  ghost = false,
}: ScrubInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const dragRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const emit = onUpdate ?? onChange ?? (() => {});

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const startDrag = (e: React.MouseEvent) => {
    if (!label) return;
    e.preventDefault();
    dragRef.current = true;
    const startX = e.clientX;
    const startValue = value;

    const onMouseMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = me.clientX - startX;
      let newValue = startValue + dx * step;
      newValue = Math.max(min, Math.min(max, newValue));
      emit(newValue);
    };

    const onMouseUp = () => {
      dragRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "ew-resize";
  };

  const commit = () => {
    const val = parseFloat(draft);
    if (!Number.isNaN(val)) {
      emit(Math.max(min, Math.min(max, val)));
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`${
        ghost
          ? ""
          : "overflow-hidden rounded border border-neutral-700/50 bg-neutral-800/40"
      } group flex h-7 items-center transition-all ${isEditing ? "ring-1 ring-blue-500/50" : "hover:border-neutral-600"}`}
    >
      {/* Label Area: Used for scrubbing (only shown when a label exists) */}
      {label && (
        <div
          className="flex h-full w-6 cursor-ew-resize items-center justify-center border-r border-neutral-700/50 bg-neutral-900/40 text-[10px] font-bold text-neutral-500 transition-colors select-none hover:text-blue-400"
          onMouseDown={startDrag}
        >
          {label}
        </div>
      )}

      {/* Value Area: uncontrolled while typing, commits on blur/Enter */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          defaultValue={value}
          step={step}
          className="h-full w-full flex-1 bg-neutral-900 px-2 font-mono text-[11px] text-white outline-none"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setIsEditing(false);
          }}
        />
      ) : (
        <div
          className="flex h-full flex-1 cursor-text items-center px-2 font-mono text-[11px] text-neutral-200 select-none"
          onClick={() => {
            setDraft(String(value));
            setIsEditing(true);
          }}
        >
          {Math.round(value * 100) / 100}
        </div>
      )}
    </div>
  );
}
