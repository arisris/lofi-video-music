// Dedicated transition properties: the boundary owned by the incoming
// background clip. Selected via timeline badges/gap clicks (never part of
// either clip's own panel) — ready for more blend types later.
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { useEditorStore } from "../../../store/editor-store";
import {
  BG_TRANSITION_MAX_DURATION,
  BG_TRANSITION_OPTIONS,
  resolveBgTransition,
} from "../../../shared/lib/transitions";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { FieldLabel } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { RangeInput } from "../../../shared/ui/RangeInput";
import { SelectControl } from "../../../shared/ui/Select";

function bgName(s: Record<string, unknown>): string {
  return typeof s.fileName === "string" && s.fileName
    ? s.fileName
    : "Background";
}

export function TransitionPanel({ clipId }: { clipId: string }) {
  const { clip, values, set } = useClipSettings(clipId);
  const clips = useEditorStore((s) => s.clips);
  const tr = resolveBgTransition(values);

  if (!clip || clip.type !== "background") return null;
  const prev = clips
    .filter(
      (c) =>
        c.type === "background" &&
        c.id !== clip.id &&
        c.start + c.duration <= clip.start + 0.25,
    )
    .sort((a, b) => b.start - a.start)[0];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900 p-5">
      <div className="mb-5 flex flex-none items-center justify-between">
        <div className="animate-in fade-in flex flex-1 items-center gap-2 overflow-hidden duration-200">
          <i className="icon-[ri--arrow-left-right-line] h-4 w-4 shrink-0 text-blue-500" />
          <span className="truncate text-[10px] font-bold tracking-wider text-neutral-200 uppercase">
            {prev
              ? `${bgName(prev.settings)} → ${bgName(clip.settings)}`
              : `Black → ${bgName(clip.settings)}`}
          </span>
        </div>
        <button
          type="button"
          aria-label="Back to clip properties"
          title="Back to clip properties"
          onClick={() =>
            useEditorStore.setState({ selectedTransitionClipId: null })
          }
          className="ml-2 flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 p-1.5 text-[10px] font-bold text-neutral-400 uppercase transition-all outline-none hover:bg-neutral-700 hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <i className="icon-[ri--arrow-go-back-line] h-4 w-4" />
          Clip
        </button>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        <InspectorRoot>
          <Card title="Boundary Blend" spacing="sm">
            <FieldLabel>Transition</FieldLabel>
            <SelectControl
              value={tr.type}
              options={BG_TRANSITION_OPTIONS}
              onChange={(v) => set("transitionType", v)}
              size="md"
              ariaLabel="Boundary transition type"
            />
            <div className="mt-3">
              <label className="mb-1.5 flex justify-between text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                <span>Duration</span>
                <span className="font-mono text-[10px] text-blue-400">{`${tr.duration.toFixed(1)}s`}</span>
              </label>
              <div className="flex items-center gap-2">
                <RangeInput
                  value={tr.duration}
                  min={0}
                  max={BG_TRANSITION_MAX_DURATION}
                  step={0.1}
                  onChange={(v) => set("transitionDuration", v)}
                  ariaLabel="Transition duration"
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800"
                />
                <Button
                  variant="mini"
                  onClick={() => set("transitionDuration", 1)}
                >
                  Reset
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-neutral-500">
              {prev
                ? tr.type === "zoom"
                  ? "Cross-zooms from the previous clip while they abut."
                  : tr.type === "blur"
                    ? "Dissolves through blur from the previous clip."
                    : tr.type === "fold"
                      ? "Folds the previous clip away like a sheet of paper."
                      : "Crossfades from the previous clip while they abut."
                : tr.type === "zoom"
                  ? "Zooms in from black — nothing precedes this clip."
                  : tr.type === "blur"
                    ? "Sharpens in from black — nothing precedes this clip."
                    : tr.type === "fold"
                      ? "Fades in from black — nothing precedes this clip."
                      : "Fades in from black — nothing precedes this clip."}{" "}
              Fades out where the lane goes empty.
            </p>
          </Card>
        </InspectorRoot>
      </div>
    </div>
  );
}
