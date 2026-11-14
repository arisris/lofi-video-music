import { SchemaFields } from "../../shared/ui";
import { useClipSettings } from "../../shared/hooks/useClipSettings";
import { clipRegistry } from "../clips";
import { LyricsStyleSettings } from "./clip-views/LyricsSettings";
import { getSettingsView } from "./clip-settings";
import { useEditorStore } from "../../store/editor-store";

function DefaultSettingsView({ clipId }: { clipId: string }) {
  const { clip, set } = useClipSettings(clipId);
  if (!clip) return null;
  const def = clipRegistry.get(clip.type);
  if (!def || def.schema.length === 0) return null;
  return (
    <SchemaFields schema={def.schema} values={clip.settings} onChange={set} />
  );
}

function PanelHeader({
  icon,
  name,
  enabled,
  showToggle = true,
  showDelete = false,
  onToggle,
  onDelete,
}: {
  icon: string;
  name: string;
  enabled: boolean;
  showToggle?: boolean;
  showDelete?: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="mb-5 flex flex-none items-center justify-between">
      <div className="animate-in fade-in flex flex-1 items-center gap-2 overflow-hidden duration-200">
        <i className={`${icon} h-4 w-4 shrink-0 text-blue-500`} />
        <span className="truncate text-[10px] font-bold tracking-wider text-neutral-200 uppercase">
          {name}
        </span>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2">
        {showToggle && (
          <button
            className={`cursor-pointer rounded-lg border p-1.5 transition-all ${enabled ? "border-blue-600/40 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" : "border-neutral-700 bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-400"}`}
            title={enabled ? "Disable layer/clip" : "Enable layer/clip"}
            onClick={onToggle}
          >
            <i
              className={`${enabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
            />
          </button>
        )}
        {showDelete && onDelete && (
          <button
            className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 p-1.5 text-neutral-500 transition-all hover:border-red-900/30 hover:bg-red-900/20 hover:text-red-400"
            title="Delete Clip"
            onClick={onDelete}
          >
            <i className="icon-[ri--delete-bin-line] h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const DisabledBanner = () => (
  <div className="mb-4 flex flex-none items-center gap-2 rounded-lg border border-amber-700/30 bg-amber-900/20 px-3 py-2 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
    <i className="icon-[ri--eye-off-line] h-3.5 w-3.5" />
    This element is currently hidden
  </div>
);

const EmptyState = () => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-900 p-8 text-center text-neutral-500">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950">
      <i className="icon-[ri--equalizer-line] h-8 w-8 text-neutral-600" />
    </div>
    <h3 className="mb-1 text-sm font-bold text-neutral-400">
      No Clip Selected
    </h3>
    <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
      Select a clip from the timeline or the left Clips Library panel to view
      and edit its properties here.
    </p>
  </div>
);

function clipDisplayName(
  type: string,
  settings: Record<string, unknown>,
  fallback: string,
): string {
  const s = settings as Record<string, unknown>;
  if (type === "text" && typeof s.content === "string")
    return `Text: "${s.content}"`;
  if (type === "background")
    return `Background: ${typeof s.fileName === "string" && s.fileName ? s.fileName : "Image/Video"}`;
  if (type === "overlay")
    return `Overlay: ${typeof s.fileName === "string" && s.fileName ? s.fileName : "Image/Video"}`;
  if (type === "music")
    return `Music: ${typeof s.name === "string" && s.name ? s.name : "Track"}`;
  return fallback;
}

/** Inspector for the global lyrics layer (legacy mirror: global branch of clips-panel).
 * Opened by selecting "lyrics" (Lyrics Properties button in the Lyrics panel).
 */
function LyricsGlobalView() {
  const enabled = useEditorStore((s) => s.lyricsSettings.enabled !== false);
  const stack = useEditorStore((s) => s.lyricsSettings.karaokeMode === true);
  const updateLyricsSettings = useEditorStore((s) => s.updateLyricsSettings);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900 p-5">
      <PanelHeader
        icon="icon-[ri--mic-line]"
        name={`Lyrics · ${stack ? "Stack" : "Single"}`}
        enabled={enabled}
        onToggle={() => updateLyricsSettings({ enabled: !enabled })}
      />
      {!enabled && <DisabledBanner />}
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        <LyricsStyleSettings />
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const selectedId = useEditorStore((s) => s.selectedClipId);
  const clips = useEditorStore((s) => s.clips);
  const updateClipSettings = useEditorStore((s) => s.updateClipSettings);
  const removeClip = useEditorStore((s) => s.removeClip);

  const clip = clips.find((c) => c.id === selectedId);
  if (!clip) {
    if (selectedId === "lyrics") return <LyricsGlobalView />;
    return <EmptyState />;
  }
  const def = clipRegistry.get(clip.type);
  // Single wiring table (clip-settings.ts). Definitions stay pure `.ts`;
  // def.SettingsView remains as a fallback for externally registered clips.
  const TypeView = getSettingsView(clip.type) ?? def?.SettingsView ?? null;
  const enabled = (clip.settings.enabled as boolean | undefined) !== false;
  const name = clipDisplayName(
    clip.type,
    clip.settings,
    def?.name ?? clip.type,
  );
  const icon = def?.icon ?? "icon-[ri--movie-2-line]";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900 p-5">
      <PanelHeader
        icon={icon}
        name={name}
        enabled={enabled}
        showToggle={clip.type !== "music"}
        showDelete
        onToggle={() => updateClipSettings(clip.id, { enabled: !enabled })}
        onDelete={() => removeClip(clip.id)}
      />
      {!enabled && <DisabledBanner />}
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        {TypeView ? (
          <TypeView clipId={clip.id} />
        ) : def && def.schema.length > 0 ? (
          <DefaultSettingsView clipId={clip.id} />
        ) : (
          <div className="text-xs text-neutral-500 italic">
            Preparing clip settings...
          </div>
        )}
      </div>
    </div>
  );
}
