// Keyframed motion editor for background clips: explicit pan/zoom/rotation
// control points along the clip. Two or more keyframes drive the frame in
// drawBackground; fewer than two is stored but inert.
import { useEffect, useRef, useState } from "react";
import { seekTo } from "../../audio/audio-engine";
import { useEditorStore } from "../../../store/editor-store";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import {
  DEFAULT_KEYFRAME_MOTION,
  resolveMotionAt,
  sanitizeMotionKeyframes,
  type MotionKeyframe,
} from "../../../shared/lib/motion-keyframes";
import { useAnchoredMenu } from "../../../shared/ui/anchored-menu";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";

const round2 = (v: number) => Math.round(v * 100) / 100;

type GraphProp = "scale" | "x" | "y" | "rotation";

const GRAPH_PROPS: Array<{ id: GraphProp; label: string; hint: string }> = [
  { id: "scale", label: "Z", hint: "Zoom" },
  { id: "x", label: "X", hint: "Pan horizontal" },
  { id: "y", label: "Y", hint: "Pan vertical" },
  { id: "rotation", label: "R", hint: "Rotation" },
];

/** Vertical band + behavior per graphed property (auto-fits the data). */
function propBand(prop: GraphProp, vals: number[]): {
  lo: number;
  hi: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
} {
  const neutral = prop === "scale" ? 1 : 0;
  const fallback =
    prop === "scale"
      ? { lo: 0.9, hi: 1.6 }
      : prop === "rotation"
        ? { lo: -15, hi: 15 }
        : { lo: -64, hi: 64 };
  const lo = Math.min(neutral, fallback.lo, ...vals);
  const hi = Math.max(neutral, fallback.hi, ...vals);
  if (prop === "scale")
    return {
      lo,
      hi,
      min: 0.05,
      max: 8,
      step: 0.05,
      format: (v) => `${Math.round(v * 100)}%`,
    };
  if (prop === "rotation")
    return {
      lo,
      hi,
      min: -45,
      max: 45,
      step: 1,
      format: (v) => `${Math.round(v)}°`,
    };
  return {
    lo,
    hi,
    min: -1000,
    max: 1000,
    step: 1,
    format: (v) => `${Math.round(v)}px`,
  };
}

interface PointMenuState {
  x: number;
  y: number;
  index: number;
}

/** Context menu for one keyframe point: what it holds + what to do with it. */
function PointMenu({
  anchor,
  kf,
  index,
  onGoTo,
  onSetToPlayhead,
  onDelete,
  onClose,
}: {
  anchor: { x: number; y: number };
  kf: MotionKeyframe;
  index: number;
  onGoTo: () => void;
  onSetToPlayhead: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { ref, style } = useAnchoredMenu(anchor);

  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el || !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, ref]);

  const item =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-neutral-300 outline-none transition-colors hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-500";
  const dangerItem =
    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-neutral-300 outline-none transition-colors hover:bg-red-950/50 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-blue-500";

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Keyframe ${index + 1} actions`}
      style={style}
      className="fixed z-9999 w-52 rounded-lg border border-neutral-700 bg-neutral-900 p-1.5 shadow-2xl"
    >
      <div className="px-2 pt-1 pb-2">
        <div className="font-mono text-[11px] font-bold text-neutral-100">
          #{index + 1} · {kf.t.toFixed(2)}s
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-neutral-500">
          Zoom {Math.round(kf.scale * 100)}% · Pan ({Math.round(kf.x)},{" "}
          {Math.round(kf.y)}) · Rot {Math.round(kf.rotation)}°
        </div>
      </div>
      <button type="button" role="menuitem" className={item} onClick={onGoTo}>
        <i className="icon-[ri--skip-forward-line] h-3.5 w-3.5 text-neutral-500" />
        Go to keyframe
      </button>
      <button
        type="button"
        role="menuitem"
        className={item}
        onClick={onSetToPlayhead}
      >
        <i className="icon-[ri--map-pin-time-line] h-3.5 w-3.5 text-neutral-500" />
        Move to playhead
      </button>
      <button
        type="button"
        role="menuitem"
        className={dangerItem}
        onClick={onDelete}
      >
        <i className="icon-[ri--delete-bin-line] h-3.5 w-3.5 text-neutral-500" />
        Delete keyframe
      </button>
    </div>
  );
}

export function MotionKeyframesCard({ clipId }: { clipId: string }) {
  const { clip, values, set } = useClipSettings(clipId);
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = typeof clip?.duration === "number" ? clip.duration : 0;
  const start = typeof clip?.start === "number" ? clip.start : 0;
  const local = currentTime - start;
  const keyframes = sanitizeMotionKeyframes(values.motionKeyframes, duration);
  const active = keyframes.length >= 2;
  const graphRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    index: number;
    moved: boolean;
    origT: number;
    origVal: number;
    cancelEsc?: () => void;
  } | null>(null);
  const [menu, setMenu] = useState<PointMenuState | null>(null);
  // Which property the graph's vertical axis shows and edits.
  const [graphProp, setGraphProp] = useState<GraphProp>("scale");

  const propVals = keyframes.map((k) => k[graphProp]);
  const band = propBand(graphProp, propVals);
  const propLabel =
    GRAPH_PROPS.find((p) => p.id === graphProp)?.hint ?? graphProp;
  const yOf = (v: number) =>
    band.hi > band.lo ? (1 - (v - band.lo) / (band.hi - band.lo)) * 100 : 50;
  const valOf = (fracY: number) =>
    Math.min(band.max, Math.max(band.min, band.hi - fracY * (band.hi - band.lo)));

  const write = (next: MotionKeyframe[], preset: string = "custom") => {
    set(
      "motionKeyframes",
      [...next].sort((a, b) => a.t - b.t),
    );
    // Any hand edit detaches the list from its template so the preset
    // picker can honestly report "Custom".
    set("motionPreset", preset);
  };

  const patch = (index: number, field: keyof MotionKeyframe, val: number) => {
    const next = keyframes.map((k, i) =>
      i === index ? { ...k, [field]: field === "t" ? round2(val) : val } : k,
    );
    write(next);
  };

  const addAtPlayhead = () => {
    const t = round2(Math.min(Math.max(0, local), Math.max(0, duration)));
    // Merge with a neighbour within 0.15s instead of stacking duplicates.
    const base = resolveMotionAt(keyframes, t) ?? DEFAULT_KEYFRAME_MOTION;
    write([
      ...keyframes.filter((k) => Math.abs(k.t - t) > 0.15),
      { t, x: base.x, y: base.y, scale: base.scale, rotation: base.rotation },
    ]);
  };

  const removeAt = (index: number) =>
    write(keyframes.filter((_, i) => i !== index));

  const goTo = (t: number) => seekTo(start + t);
  const closeMenu = () => setMenu(null);

  const setToPlayhead = (index: number) => {
    const prev = keyframes[index - 1]?.t ?? 0;
    const next = keyframes[index + 1]?.t ?? Math.max(0, duration);
    patch(
      index,
      "t",
      round2(Math.min(Math.max(Math.max(0, local), prev), next)),
    );
    closeMenu();
  };

  // Drop a stale menu when the clip or its points change underneath it.
  useEffect(() => {
    if (menu && (menu.index >= keyframes.length || clip?.id !== clipId)) {
      setMenu(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyframes.length, clipId]);

  const onDotPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      index,
      moved: false,
      origT: keyframes[index].t,
      origVal: keyframes[index][graphProp],
    };
    setMenu(null);
  };

  const onDotPointerMove = (
    e: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const drag = dragRef.current;
    const box = graphRef.current?.getBoundingClientRect();
    if (!drag || drag.index !== index || !box || box.width <= 0) return;
    if (!drag.moved) {
      drag.moved = true;
      // Esc cancels the drag (capture: runs before the global handler).
      const cancel = (ke: KeyboardEvent) => {
        if (ke.key !== "Escape") return;
        ke.stopPropagation();
        ke.preventDefault();
        const d = dragRef.current;
        if (d) {
          patch(d.index, "t", d.origT);
          patch(d.index, graphProp, d.origVal);
        }
        dragRef.current = null;
        window.removeEventListener("keydown", cancel, true);
      };
      drag.cancelEsc = () => window.removeEventListener("keydown", cancel, true);
      window.addEventListener("keydown", cancel, true);
    }
    const fracX = (e.clientX - box.left) / box.width;
    const fracY = (e.clientY - box.top) / box.height;
    const prev = keyframes[index - 1]?.t ?? 0;
    const next = keyframes[index + 1]?.t ?? Math.max(0, duration);
    // Horizontal = retime (never crosses neighbours), vertical = graph prop.
    patch(
      index,
      "t",
      round2(
        Math.min(Math.max(fracX * duration, prev), next),
      ),
    );
    patch(index, graphProp, round2(valOf(Math.min(Math.max(fracY, 0), 1))));
  };

  const onDotPointerUp = (
    e: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.index !== index) return;
    drag.cancelEsc?.();
    dragRef.current = null;
    if (!drag.moved) {
      setMenu({ x: e.clientX, y: e.clientY, index });
    }
  };

  const onDotKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const k = keyframes[index];
    if (!k) return;
    const prev = keyframes[index - 1]?.t ?? 0;
    const next = keyframes[index + 1]?.t ?? Math.max(0, duration);
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowRight" ? 1 : -1);
      patch(index, "t", round2(Math.min(Math.max(k.t + step, prev), next)));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const step = (e.shiftKey ? band.step * 4 : band.step) * dir;
      patch(
        index,
        graphProp,
        round2(Math.min(band.max, Math.max(band.min, k[graphProp] + step))),
      );
    } else if (e.key === "Enter" && menu?.index !== index) {
      e.preventDefault();
      const box = e.currentTarget.getBoundingClientRect();
      setMenu({
        x: box.left + box.width / 2,
        y: box.bottom,
        index,
      });
    }
  };

  const line =
    keyframes.length >= 2
      ? keyframes
          .map(
            (k) =>
              `${duration > 0 ? (k.t / duration) * 100 : 0},${yOf(k[graphProp])}`,
          )
          .join(" ")
      : "";
  const neutral = graphProp === "scale" ? 1 : 0;

  return (
    <Card title="Motion Keyframes" spacing="sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-neutral-500">
          {active
            ? `${keyframes.length} keyframes drive motion — drag a point to retime (↔) or edit ${propLabel} (↕), click it for actions.`
            : "Add 2+ keyframes to start motion — or pick a preset above."}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
            active
              ? "bg-blue-500/15 text-blue-400"
              : "bg-neutral-800 text-neutral-500"
          }`}
        >
          {active ? "ACTIVE" : `${keyframes.length}/2`}
        </span>
      </div>

      {/* Graph property: which value the vertical axis shows and edits. */}
      <div
        role="group"
        aria-label="Graphed property"
        className="mb-2 flex items-center gap-1"
      >
        {GRAPH_PROPS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.hint}
            aria-label={`Graph ${p.hint}`}
            aria-pressed={graphProp === p.id}
            onClick={() => setGraphProp(p.id)}
            className={`h-6 min-w-7 cursor-pointer rounded px-1.5 font-mono text-[10px] font-bold outline-none transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
              graphProp === p.id
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-1 font-mono text-[9px] text-neutral-600">
          {band.format(band.lo)} – {band.format(band.hi)}
        </span>
      </div>

      {/* Motion graph: x = time, y = active property. Background click seeks. */}
      <div
        ref={graphRef}
        tabIndex={0}
        role="slider"
        aria-label={`Motion graph: horizontal is time, vertical is ${propLabel}`}
        aria-valuemin={0}
        aria-valuemax={round2(duration)}
        aria-valuenow={round2(Math.min(Math.max(0, local), Math.max(0, duration)))}
        className="relative mb-3 h-24 cursor-pointer overflow-hidden rounded border border-neutral-800 bg-neutral-950/60 outline-none focus-visible:outline-2 focus-visible:outline-blue-500"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const frac =
            box.width > 0 ? (e.clientX - box.left) / box.width : 0;
          goTo(round2(Math.min(Math.max(0, frac), 1) * duration));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            const step = e.shiftKey ? 1 : 0.1;
            goTo(
              round2(
                Math.min(
                  Math.max(0, local + (e.key === "ArrowRight" ? step : -step)),
                  Math.max(0, duration),
                ),
              ),
            );
          }
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Neutral baseline (no zoom / centered / no rotation) */}
          {band.lo < neutral && band.hi > neutral && (
            <line
              x1="0"
              x2="100"
              y1={yOf(neutral)}
              y2={yOf(neutral)}
              stroke="currentColor"
              strokeWidth={0.6}
              className="text-neutral-700"
              strokeDasharray="2 1.5"
            />
          )}
          {line && (
            <polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="text-blue-500/70"
            />
          )}
        </svg>
        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-neutral-500"
          style={{
            left: `${duration > 0 ? (Math.min(Math.max(0, local), duration) / duration) * 100 : 0}%`,
          }}
        />
        {keyframes.map((k, i) => (
          <button
            key={`${k.t}-${i}`}
            type="button"
            title={`Keyframe ${i + 1} at ${k.t.toFixed(2)}s, ${propLabel} ${band.format(k[graphProp])} — drag to move, click for actions`}
            aria-label={`Keyframe ${i + 1} at ${k.t.toFixed(2)} seconds, ${propLabel} ${band.format(k[graphProp])}. Arrows retime or edit ${propLabel}, Enter opens actions.`}
            className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 outline-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-white ${
              menu?.index === i
                ? "border-white bg-blue-400"
                : "border-blue-300 bg-blue-500 hover:scale-125"
            }`}
            style={{
              left: `${duration > 0 ? (k.t / duration) * 100 : 0}%`,
              top: `${yOf(k[graphProp])}%`,
              touchAction: "none",
            }}
            onPointerDown={(e) => onDotPointerDown(e, i)}
            onPointerMove={(e) => onDotPointerMove(e, i)}
            onPointerUp={(e) => onDotPointerUp(e, i)}
            onClick={(e) => {
              // Pointer path opens the menu on pointer-up; keyboard
              // (Enter/Space) arrives here with detail 0.
              e.stopPropagation();
              if (e.detail === 0 && menu?.index !== i) {
                const box = e.currentTarget.getBoundingClientRect();
                setMenu({
                  x: box.left + box.width / 2,
                  y: box.bottom,
                  index: i,
                });
              }
            }}
            onKeyDown={(e) => onDotKeyDown(e, i)}
          />
        ))}
      </div>

      {menu && keyframes[menu.index] && (
        <PointMenu
          anchor={menu}
          kf={keyframes[menu.index]}
          index={menu.index}
          onGoTo={() => {
            goTo(keyframes[menu.index].t);
            closeMenu();
          }}
          onSetToPlayhead={() => setToPlayhead(menu.index)}
          onDelete={() => {
            removeAt(menu.index);
            closeMenu();
          }}
          onClose={closeMenu}
        />
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={addAtPlayhead}
          title={`Add keyframe at ${round2(Math.max(0, local)).toFixed(2)}s`}
        >
          <span className="flex items-center gap-1.5 text-[10px]">
            <i className="icon-[ri--add-line] h-3.5 w-3.5" />
            Keyframe at playhead ({round2(Math.max(0, local)).toFixed(1)}s)
          </span>
        </Button>
        {keyframes.length > 0 && (
          <Button
            variant="mini"
            onClick={() => write([], "none")}
            title="Delete all keyframes and return to the preset"
            ariaLabel="Clear all motion keyframes"
          >
            Clear
          </Button>
        )}
      </div>
    </Card>
  );
}
