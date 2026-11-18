// Playlist clip inspector
// Max Tracks + Truncate, then typography/stroke/background + Transform.
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { RangeInput } from "../../../shared/ui/RangeInput";
import {
  BackgroundBoxSettings,
  StrokeShadowSettings,
  TransformSettings,
  TypographySettings,
} from "./TextSettings";

export function PlaylistSettingsView({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const maxItems = typeof values.maxItems === "number" ? values.maxItems : 12;
  const truncate = values.truncateText === true;

  return (
    <InspectorRoot>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-xs text-neutral-400">
            Max Tracks
          </label>
          <RangeInput
            value={Math.min(15, Math.max(3, maxItems))}
            min={3}
            max={15}
            step={1}
            onChange={(v) => set("maxItems", Math.round(v))}
            ariaLabel="Max Tracks"
            className="w-full"
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            className={`flex h-8 items-center justify-between rounded-lg px-3 transition-colors ${
              truncate
                ? "border border-blue-600/30 bg-blue-600/20 text-blue-400"
                : "border border-neutral-700 bg-neutral-800 text-neutral-400"
            }`}
            onClick={() => set("truncateText", !truncate)}
          >
            <span className="text-[10px] font-bold uppercase">Truncate</span>
            <div
              className={`h-3 w-3 rounded-full transition-all ${truncate ? "bg-blue-400" : "bg-neutral-600"}`}
            />
          </button>
        </div>
      </div>
      <TypographySettings clipId={clipId} />
      <StrokeShadowSettings clipId={clipId} />
      <BackgroundBoxSettings clipId={clipId} />
      <TransformSettings clipId={clipId} />
    </InspectorRoot>
  );
}
