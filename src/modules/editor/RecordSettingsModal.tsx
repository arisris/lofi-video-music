import type { RecordResolution } from "../../shared/lib/canvas-space";
import { startRecording } from "../recorder/recorder";
import { activeMusicClipIn, clipsForAudio } from "../audio/audio-engine";
import { formatTime } from "../../shared/lib/format";
import { getTotalDuration, useEditorStore } from "../../store/editor-store";

interface ResolutionOption {
  id: RecordResolution;
  label: string;
  desc: string;
  recommended: boolean;
}

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    id: "720p",
    label: "720p HD",
    desc: "Standard quality, fast rendering",
    recommended: false,
  },
  {
    id: "1080p",
    label: "1080p Full HD",
    desc: "High quality, standard choice",
    recommended: true,
  },
  {
    id: "1440p",
    label: "1440p 2K QHD",
    desc: "Very high quality, needs a powerful computer",
    recommended: false,
  },
];

const FPS_OPTIONS: Array<{ value: number; label: string; desc: string }> = [
  { value: 30, label: "30 FPS", desc: "Standard smoothness" },
  { value: 60, label: "60 FPS", desc: "Ultra smooth motion" },
];

const closeModal = () =>
  useEditorStore.setState({ showRecordSettingsModal: false });

const DIMENSIONS: Record<string, Record<RecordResolution, string>> = {
  landscape: {
    "720p": "1280 × 720",
    "1080p": "1920 × 1080",
    "1440p": "2560 × 1440",
  },
  portrait: {
    "720p": "720 × 1280",
    "1080p": "1080 × 1920",
    "1440p": "1440 × 2560",
  },
};

interface ResolutionCard extends ResolutionOption {
  dimensions: string;
}

const buildResolutionOptions = (aspectRatio: string): ResolutionCard[] => {
  const orientation =
    aspectRatio === "16:9" ? DIMENSIONS.landscape : DIMENSIONS.portrait;
  return RESOLUTION_OPTIONS.map((r) => ({
    ...r,
    dimensions: orientation[r.id],
  }));
};

/** Export/settings modal for video recording. */
export const RecordSettingsModal = () => {
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const pendingRecordMode = useEditorStore((s) => s.pendingRecordMode);
  const recordResolution = useEditorStore((s) => s.recordResolution);
  const recordFps = useEditorStore((s) => s.recordFps);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.currentTime);
  const durationVal = getTotalDuration(clips);
  const formattedDur = formatTime(Math.floor(durationVal));
  const activeMusic =
    pendingRecordMode === "clip"
      ? activeMusicClipIn(clipsForAudio(), currentTime)
      : undefined;

  const resolutions = buildResolutionOptions(aspectRatio);

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm duration-200"
      onClick={closeModal}
    >
      <div
        className="animate-in zoom-in-95 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60 px-6 py-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <i className="icon-[ri--settings-4-line] h-5 w-5 text-blue-500" />
              Export Video Settings
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              Configure quality and performance for rendering
            </p>
          </div>
          <button
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
            onClick={closeModal}
          >
            <i className="icon-[ri--close-line] h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto p-6">
          {/* Info Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3.5 text-xs text-neutral-300">
            <i className="mt-0.5 icon-[ri--information-line] h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <span className="font-semibold text-neutral-200">
                Recording Mode:{" "}
              </span>
              {pendingRecordMode === "clip"
                ? "Single Music Clip"
                : "Full Timeline"}
              <br />
              <span className="font-semibold text-neutral-200">
                Estimated Duration:{" "}
              </span>
              {pendingRecordMode === "clip"
                ? activeMusic
                  ? formatTime(Math.floor(activeMusic.duration))
                  : "No active track under playhead"
                : formattedDur}
            </div>
          </div>

          {/* Resolution Selectors */}
          <div>
            <label className="mb-3 block text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Select Resolution
            </label>
            <div className="flex flex-col gap-2.5">
              {resolutions.map((res) => {
                const isSelected = recordResolution === res.id;
                return (
                  <button
                    key={res.id}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-600/15 text-white"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-300 hover:border-neutral-700"
                    }`}
                    onClick={() =>
                      useEditorStore.setState({ recordResolution: res.id })
                    }
                  >
                    <div className="flex flex-col gap-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{res.label}</span>
                        {res.recommended && (
                          <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-blue-400 uppercase">
                            Recommended
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        {res.desc}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-300">
                        {res.dimensions}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frame Rate Selector */}
          <div>
            <label className="mb-3 block text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Frame Rate (FPS)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {FPS_OPTIONS.map((fps) => {
                const isSelected = recordFps === fps.value;
                return (
                  <button
                    key={fps.value}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-600/15 text-white"
                        : "border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-neutral-700"
                    }`}
                    onClick={() =>
                      useEditorStore.setState({ recordFps: fps.value })
                    }
                  >
                    <span className="text-sm font-bold">{fps.label}</span>
                    <span className="text-[10px] text-neutral-500">
                      {fps.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Warning / Notice */}
          <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-[11px] leading-relaxed text-neutral-400">
            <i className="mt-0.5 icon-[ri--alert-line] h-5 w-5 shrink-0 text-amber-500" />
            <p>
              <strong className="text-amber-400">Performance warning: </strong>
              Recording happens in real time directly in the browser. Choosing
              high quality (such as 1080p/1440p) and 60 FPS requires a capable
              computer. Keep the browser tab active during recording to avoid
              lag or broken audio-video synchronization.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 bg-neutral-900/60 px-6 py-4">
          <button
            className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
            onClick={closeModal}
          >
            Cancel
          </button>
          <button
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-blue-500/35 bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-blue-500"
            onClick={() => {
              closeModal();
              startRecording();
            }}
          >
            <i className="icon-[ri--movie-2-line] h-4 w-4" />
            Start Video Recording
          </button>
        </div>
      </div>
    </div>
  );
};
