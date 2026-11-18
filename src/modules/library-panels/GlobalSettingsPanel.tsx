import { useRef, useState } from "react";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import { useEditorStore } from "../../store/editor-store";
import { addClipOfType } from "../dock/clip-actions";
import {
  PEXELS_KEY_URL,
  PIXABAY_KEY_URL,
  getPexelsKey,
  getPixabayKey,
  setPexelsKey,
  setPixabayKey,
} from "../media/stock/api-keys";
import { searchPexelsDirect } from "../media/stock/pexels-client";
import { searchPixabayDirect } from "../media/stock/pixabay-client";
// Project bundle IO (fflate) loads on demand so it stays out of the main chunk.

export const GlobalSettingsPanel = () => {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const select = useEditorStore((s) => s.select);
  const clips = useEditorStore((s) => s.clips);
  const updateClipSettings = useEditorStore((s) => s.updateClipSettings);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [pexelsKey, setPexelsKeyState] = useState(getPexelsKey);
  const [pixabayKey, setPixabayKeyState] = useState(getPixabayKey);
  const [showPexelsKey, setShowPexelsKey] = useState(false);
  const [showPixabayKey, setShowPixabayKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<"pexels" | "pixabay" | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const titleClip = clips.find((c) => c.type === "title");
  const playlistClip = clips.find((c) => c.type === "playlist");

  const saveKeys = () => {
    setPexelsKey(pexelsKey);
    setPixabayKey(pixabayKey);
    setPexelsKeyState(getPexelsKey());
    setPixabayKeyState(getPixabayKey());
    setKeyStatus("Keys saved in this browser.");
  };

  const clearKeys = () => {
    setPexelsKey("");
    setPixabayKey("");
    setPexelsKeyState("");
    setPixabayKeyState("");
    setKeyStatus("Keys cleared.");
  };

  const testKey = (provider: "pexels" | "pixabay") => {
    const key = provider === "pexels" ? pexelsKey.trim() : pixabayKey.trim();
    if (!key) {
      setKeyStatus(
        `Enter a ${provider === "pexels" ? "Pexels" : "Pixabay"} key first.`,
      );
      return;
    }
    setTestingKey(provider);
    setKeyStatus(null);
    const attempt =
      provider === "pexels"
        ? searchPexelsDirect({
            key,
            query: "nature",
            type: "photo",
            per_page: 1,
          }).then(() => {})
        : searchPixabayDirect({
            key,
            query: "nature",
            type: "photo",
            per_page: 3,
          }).then(() => {});
    attempt.then(
      () => {
        setKeyStatus(
          `${provider === "pexels" ? "Pexels" : "Pixabay"} key works.`,
        );
        setTestingKey(null);
      },
      (err) => {
        setKeyStatus(`Test failed: ${(err as Error).message}`);
        setTestingKey(null);
      },
    );
  };

  const toggleGlobalLayer = (e: React.MouseEvent, id: "title" | "playlist") => {
    e.stopPropagation();
    const target = id === "title" ? titleClip : playlistClip;
    // Toggle `enabled` (not opacity) so this matches the Inspector eye and
    // the renderer, which both key off enabled !== false.
    if (target) {
      const enabled =
        (target.settings.enabled as boolean | undefined) !== false;
      updateClipSettings(target.id, { enabled: !enabled });
    }
  };

  const selectLayer = (id: "title" | "playlist") => {
    const target = id === "title" ? titleClip : playlistClip;
    if (target) select(target.id);
    else addClipOfType(id, {});
  };

  const titleEnabled =
    (titleClip?.settings.enabled as boolean | undefined) !== false;
  const playlistEnabled =
    (playlistClip?.settings.enabled as boolean | undefined) !== false;

  const handleExport = async () => {
    setProjectBusy(true);
    setProjectStatus("Preparing bundle…");
    try {
      const { downloadBlob, exportProjectBundle } =
        await import("../project/store-io");
      const { blob, filename, remoteKept } =
        await exportProjectBundle(projectName);
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
      const { importProjectBundle } = await import("../project/store-io");
      const res = await importProjectBundle(file);
      setProjectName(res.project.meta.name);
      const warn =
        res.mediaFailed.length > 0
          ? ` (failed: ${res.mediaFailed.join(", ")})`
          : "";
      setProjectStatus(
        `Imported "${res.project.meta.name}" — ${res.mediaLoaded} media${warn}`,
      );
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
          <SectionTitle className="mb-3">Project</SectionTitle>
          <label className="mb-2 block text-xs text-neutral-400">
            Project name
          </label>
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
            <p className="mt-2 text-[10px] leading-relaxed text-neutral-400">
              {projectStatus}
            </p>
          )}
        </div>
        <div className="mb-6">
          <SectionTitle className="mb-3">Stock API Keys</SectionTitle>
          <p className="mb-3 text-[10px] leading-relaxed text-neutral-500">
            Search Pixabay and Pexels directly with your own free keys. Keys
            stay in this browser only.
          </p>
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs text-neutral-400">Pexels key</label>
                <a
                  href={PEXELS_KEY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  <i className="icon-[ri--external-link-line] h-3 w-3" />
                  Get free key
                </a>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPexelsKey ? "text" : "password"}
                    value={pexelsKey}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste Pexels API key…"
                    onChange={(e) => setPexelsKeyState(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 pr-9 text-xs text-neutral-200 outline-none focus:border-blue-500"
                  />
                  <button
                    title={showPexelsKey ? "Hide key" : "Show key"}
                    className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-neutral-500 hover:text-neutral-300"
                    onClick={() => setShowPexelsKey((v) => !v)}
                  >
                    <i
                      className={`${showPexelsKey ? "icon-[ri--eye-off-line]" : "icon-[ri--eye-line]"} h-4 w-4`}
                    />
                  </button>
                </div>
                <button
                  className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-40"
                  disabled={testingKey !== null}
                  onClick={() => testKey("pexels")}
                >
                  {testingKey === "pexels" ? "Testing…" : "Test"}
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs text-neutral-400">Pixabay key</label>
                <a
                  href={PIXABAY_KEY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  <i className="icon-[ri--external-link-line] h-3 w-3" />
                  Get free key
                </a>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPixabayKey ? "text" : "password"}
                    value={pixabayKey}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste Pixabay API key…"
                    onChange={(e) => setPixabayKeyState(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 pr-9 text-xs text-neutral-200 outline-none focus:border-blue-500"
                  />
                  <button
                    title={showPixabayKey ? "Hide key" : "Show key"}
                    className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-neutral-500 hover:text-neutral-300"
                    onClick={() => setShowPixabayKey((v) => !v)}
                  >
                    <i
                      className={`${showPixabayKey ? "icon-[ri--eye-off-line]" : "icon-[ri--eye-line]"} h-4 w-4`}
                    />
                  </button>
                </div>
                <button
                  className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-200 transition hover:bg-neutral-700 disabled:opacity-40"
                  disabled={testingKey !== null}
                  onClick={() => testKey("pixabay")}
                >
                  {testingKey === "pixabay" ? "Testing…" : "Test"}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500"
                onClick={saveKeys}
              >
                <i className="icon-[ri--save-line] h-3.5 w-3.5" />
                Save Keys
              </button>
              <button
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-200 transition hover:bg-neutral-700"
                onClick={clearKeys}
              >
                <i className="icon-[ri--delete-bin-line] h-3.5 w-3.5" />
                Clear
              </button>
            </div>
            {keyStatus && (
              <p className="text-[10px] leading-relaxed text-neutral-400">
                {keyStatus}
              </p>
            )}
          </div>
        </div>
        <div className="mb-6">
          <SectionTitle className="mb-3">Global Overlays</SectionTitle>
          <div className="space-y-2">
            <div
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all ${selectedClipId === titleClip?.id ? "border-blue-500/50 bg-blue-600/20" : "border-neutral-700/50 bg-neutral-800/40 hover:bg-neutral-800/60"}`}
              onClick={() => selectLayer("title")}
            >
              <div className="flex items-center gap-3">
                <i className="icon-[ri--heading] h-4 w-4 text-neutral-400" />
                <span className="text-xs font-bold text-neutral-200">
                  Track Title overlay
                </span>
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
                <span className="text-xs font-bold text-neutral-200">
                  Playlist Overlay
                </span>
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
            Tip: You can drag the image/video in the preview to adjust its
            composition.
          </p>
        </div>
      </div>
    </div>
  );
};
