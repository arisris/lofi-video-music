import { useRef, useState } from "react";

export interface ScrubInputProps {
  label?: string;
  value: number;
  onUpdate: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  ghost?: boolean;
}

/** Scrubbable (drag-to-change) + manual input number field. */
export const ScrubInput = ({
  label,
  value,
  onUpdate,
  step = 1,
  min = -Infinity,
  max = Infinity,
  ghost = false,
}: ScrubInputProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const dragRef = useRef(false);

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
      onUpdate(newValue);
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

  const commitTyped = (raw: string) => {
    let val = parseFloat(raw);
    if (!isNaN(val)) {
      val = Math.max(min, Math.min(max, val));
      onUpdate(val);
    }
  };

  return (
    <div
      className={`${
        ghost ? "" : "bg-slate-800/40 border border-slate-700/50 rounded overflow-hidden"
      } flex items-center h-7 transition-all group ${isEditing ? "ring-1 ring-blue-500/50" : "hover:border-slate-600"}`}
    >
      {/* Label Area: Used for scrubbing (only shown when a label exists) */}
      {label && (
        <div
          className="w-6 h-full flex items-center justify-center bg-slate-900/40 text-[10px] font-bold border-r border-slate-700/50 text-slate-500 cursor-ew-resize hover:text-blue-400 transition-colors select-none"
          onMouseDown={startDrag}
        >
          {label}
        </div>
      )}

      {/* Value Area: Used for manual input */}
      {isEditing ? (
        <input
          ref={(el) => {
            el?.focus();
            el?.select();
          }}
          type="number"
          value={value}
          step={step}
          className="flex-1 bg-slate-900 text-[11px] text-white px-2 outline-none h-full w-full font-mono"
          onBlur={() => setIsEditing(false)}
          onChange={(e) => commitTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setIsEditing(false);
            if (e.key === "Escape") setIsEditing(false);
          }}
        />
      ) : (
        <div
          className="flex-1 text-[11px] text-slate-200 px-2 font-mono flex items-center h-full cursor-text select-none"
          onClick={() => setIsEditing(true)}
        >
          {Math.round(value * 100) / 100}
        </div>
      )}
    </div>
  );
};
