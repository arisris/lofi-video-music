import { useRef, useState } from "react";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import { useEditorStore } from "../../store/editor-store";
import { addClipOfType } from "../dock/clip-actions";
import { downloadBlob, exportProjectBundle, importProjectBundle } from "../project";

type TransitionStyle = "fade" | "slide" | "zoom";

const TRANSITION_STYLES: Array<[TransitionStyle, string]> = [
  ["fade", "Fade"],
  ["slide", "Slide"],
  ["zoom", "Zoom"],
];

export const GlobalSettingsPanel = () => {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const select = useEditorStore((s) => s.select);
  const clips = useEditorStore((s) => s.clips);
  const updateClipSettings = useEditorStore((s) => s.updateClipSettings);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>("fade");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const titleClip = clips.find((c) => c.type === "title");
  const playlistClip = clips.find((c) => c.type === "playlist");

  const toggleGlobalLayer = (e: React.MouseEvent, id: "title" | "playlist") => {
    e.stopPropagation();
    const target = id === "title" ? titleClip : playlistClip;
    setHidden((h) => {
      const next = { ...h, [id]: !h[id] };
      if (target) updateClipSettings(target.id, { opacity: next[id] ? 0 : 1 });
      return next;
    });
  };

  const selectLayer = (id: "title" | "playlist") => {
    const target = id === "title" ? titleClip : playlistClip;
    if (target) select(target.id);
    else addClipOfType(id, {});
  };

  const titleEnabled = !hidden.title;
  const playlistEnabled = !hidden.playlist;

  const handleExport = async () => {
    setProjectBusy(true);
    setProjectStatus("Preparing bundle…");
    try {
      const { blob, filename, remoteKept } = await exportProjectBundle(projectName);
      downloadBlob(blob, filename);
      setProjectStatus(
        remoteKept.length > 0
          ? `Exported: ${filename} (kept remote: ${remoteKept.join(", ")})`
          : `Exported: ${filename}`,
      );
    } catch (e) {
      setProjectStatus(`Export failed: ${(e as Error).message}`);
    } finally {
      setProjectBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setProjectBusy(true);
    setProjectStatus("Importing bundle…");
    try {
      const res = await importProjectBundle(file);
      setProjectName(res.project.meta.name);
      const warn = res.mediaFailed.length > 0 ? ` (failed: ${res.mediaFailed.join(", ")})` : "";
      setProjectStatus(`Imported "${res.project.meta.name}" — ${res.mediaLoaded} media${warn}`);
    } catch (e) {
      setProjectStatus(`Import failed: ${(e as Error).message}`);
    } finally {
      setProjectBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900 p-5">
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
        <div className="mb-6">
          <SectionTitle className="mb-3">
            Project
            </SectionTitle>
          <label className="mb-2 block text-xs text-neutral-400">Project name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="mb-2 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-40"
              disabled={projectBusy}
              onClick={handleExport}
            >
              <i className="icon-[ri--download-line] h-3.5 w-3.5" />
              Export
            </button>
            <button
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-40"
              disabled={projectBusy}
              onClick={() => fileRef.current?.click()}
            >
              <i className="icon-[ri--upload-line] h-3.5 w-3.5" />
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.lofi.zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleImportFile(f);
              }}
            />
          </div>
          {projectStatus && (
            <p className="mt-2 text-[10px] leading-relaxed text-neutral-400">{projectStatus}</p>
          )}
        </div>
        <div className="mb-4">
          <label className="mb-2 block text-xs text-neutral-400">Transition Style</label>
          <div className="flex gap-2">
            {TRANSITION_STYLES.map(([style, label]) => (
              <button
                key={style}
                className={`flex-1 rounded py-1.5 text-xs transition ${transitionStyle === style ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}
                onClick={() => setTransitionStyle(style)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <SectionTitle className="mb-3">
            Global Overlays
            </SectionTitle>
          <div className="space-y-2">
            <div
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${selectedClipId === titleClip?.id ? "border-blue-500/50 bg-blue-600/20" : "border-neutral-700/50 bg-neutral-800/40 hover:bg-neutral-800/60"}`}
              onClick={() => selectLayer("title")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--heading] h-4 w-4 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-200">Track Title overlay</span>
              </div>
              <button
                className={`rounded-md p-1 transition-colors ${titleEnabled ? "text-blue-400 hover:text-blue-300" : "text-neutral-600 hover:text-neutral-500"}`}
                onClick={(e) => toggleGlobalLayer(e, "title")}
              >
                <i
                  className={`${titleEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
                />
              </button>
            </div>

            <div
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${selectedClipId === playlistClip?.id ? "border-blue-500/50 bg-blue-600/20" : "border-neutral-700/50 bg-neutral-800/40 hover:bg-neutral-800/60"}`}
              onClick={() => selectLayer("playlist")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--list-unordered] h-4 w-4 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-200">Playlist Overlay</span>
              </div>
              <button
                className={`rounded-md p-1 transition-colors ${playlistEnabled ? "text-blue-400 hover:text-blue-300" : "text-neutral-600 hover:text-neutral-500"}`}
                onClick={(e) => toggleGlobalLayer(e, "playlist")}
              >
                <i
                  className={`${playlistEnabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-blue-900/30 bg-blue-900/10 p-3">
          <p className="text-[10px] leading-relaxed text-blue-300 italic">
            <i className="mr-1 icon-[ri--information-line] inline h-3 w-3" />
            Tip: You can drag the image/video in the preview to adjust its composition.
          </p>
        </div>
      </div>
    </div>
  );
};
