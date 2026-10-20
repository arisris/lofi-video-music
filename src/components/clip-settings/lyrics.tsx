import { editorStore } from "../../store/editor-store";
import { updateClipSettings } from "../../store/actions/clip-settings";
import {
  ENTER_TRANSITIONS,
  EXIT_TRANSITIONS,
  resolveEnterTransition,
  resolveExitTransition,
} from "../../lib/transitions";
import { ScrubInput } from "../ui/scrub-input";
import { ColorInput } from "../ui/color-input";
import { SharedTextSettingsView, SharedTransformSettingsView } from "./shared";

/** Lyric-only controls: which line is on screen and how the rest fade back. */
const LyricDisplaySettingsView = ({
  settings,
  update,
}: {
  settings: Record<string, any>;
  update: (patch: Record<string, unknown>) => void;
}) => {
  // `lineTransition` on its own is the pre-split key and only ever drove the
  // entrance, so it stands in for the missing In choice.
  const enterTransitionType = resolveEnterTransition(
    settings.lineTransitionIn ?? settings.lineTransition,
  );
  const exitTransitionType = resolveExitTransition(settings.lineTransitionOut);
  const transitionSeconds = (settings.lineTransitionDuration as number) ?? 0.3;
  const transitionsOff =
    enterTransitionType === "none" && exitTransitionType === "none";

  const transitionButton = (selected: boolean) =>
    `cursor-pointer rounded border px-1 py-1.5 text-[9px] font-bold transition-colors ${
      selected
        ? "border-blue-600/40 bg-blue-600/20 text-blue-400"
        : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700/50"
    }`;

  return (
    <div>
      <h4 className="mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
        Lyric Display
      </h4>

      <ColorInput
        label="Active Line Color"
        value={(settings.activeColor as string) ?? "#ffffff"}
        onUpdate={(val) => update({ activeColor: val })}
      />
      <ColorInput
        label="Inactive Line Color"
        value={(settings.inactiveColor as string) ?? "#94a3b8"}
        onUpdate={(val) => update({ inactiveColor: val })}
      />

      <div className="mb-4">
        <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
          <span>Line Transition</span>
          <span className="font-mono text-[10px] text-blue-400">
            {transitionsOff ? "off" : `${transitionSeconds.toFixed(2)} s`}
          </span>
        </label>

        <p className="mb-1 text-[9px] font-bold tracking-wider text-slate-500 uppercase">
          In (S)
        </p>
        <div className="grid grid-cols-3 gap-1">
          {ENTER_TRANSITIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => update({ lineTransitionIn: option.id })}
              className={transitionButton(enterTransitionType === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mt-2.5 mb-1 text-[9px] font-bold tracking-wider text-slate-500 uppercase">
          Out (E)
        </p>
        <div className="grid grid-cols-3 gap-1">
          {EXIT_TRANSITIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => update({ lineTransitionOut: option.id })}
              className={transitionButton(exitTransitionType === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={`mt-2 ${transitionsOff ? "pointer-events-none opacity-40" : ""}`}
        >
          <ScrubInput
            label="T"
            value={transitionSeconds}
            step={0.05}
            min={0.05}
            max={2}
            onUpdate={(val) => update({ lineTransitionDuration: val })}
          />
        </div>
        <p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">
          In eases a line in as it takes over; Out eases it away before its own
          end. A line that runs to the end of the track stays put, since there
          is nothing after it to clear the way for.
        </p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
            <span>Context Lines</span>
            <span className="font-mono text-[10px] text-blue-400">
              {settings.contextLines ?? 0}
            </span>
          </label>
          <ScrubInput
            label="N"
            value={(settings.contextLines as number) ?? 0}
            min={0}
            max={5}
            onUpdate={(val) => update({ contextLines: Math.round(val) })}
          />
        </div>
        <div>
          <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
            <span>Active Size Boost</span>
            <span className="font-mono text-[10px] text-blue-400">
              {`${Math.round(((settings.activeSizeBoost as number) ?? 1) * 100)}%`}
            </span>
          </label>
          <ScrubInput
            label="X"
            value={(settings.activeSizeBoost as number) ?? 1}
            step={0.05}
            min={0.5}
            max={2}
            onUpdate={(val) => update({ activeSizeBoost: val })}
          />
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
            <span>Line Gap</span>
            <span className="font-mono text-[10px] text-blue-400">
              {`${settings.lineGap ?? 8} px`}
            </span>
          </label>
          <ScrubInput
            label="G"
            value={(settings.lineGap as number) ?? 8}
            min={0}
            max={80}
            onUpdate={(val) => update({ lineGap: val })}
          />
        </div>
        <div>
          <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
            <span>Inactive Opacity</span>
            <span className="font-mono text-[10px] text-blue-400">
              {`${Math.round(((settings.inactiveOpacity as number) ?? 0.45) * 100)}%`}
            </span>
          </label>
          <ScrubInput
            label="A"
            value={(settings.inactiveOpacity as number) ?? 0.45}
            step={0.01}
            min={0}
            max={1}
            onUpdate={(val) => update({ inactiveOpacity: val })}
          />
        </div>
      </div>

      <h4 className="mt-6 mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
        Timing
      </h4>
      <div className="mb-3">
        <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
          <span>Offset</span>
          <span className="font-mono text-[10px] text-blue-400">
            {`${((settings.offsetSeconds as number) ?? 0).toFixed(2)} s`}
          </span>
        </label>
        <ScrubInput
          label="O"
          value={(settings.offsetSeconds as number) ?? 0}
          step={0.05}
          min={-60}
          max={60}
          onUpdate={(val) => update({ offsetSeconds: val })}
        />
        <p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">
          Shifts every line earlier (negative) or later (positive). Use it to
          nudge an imported .lrc onto the beat.
        </p>
      </div>
      <div>
        <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
          <span>Default Line Length</span>
          <span className="font-mono text-[10px] text-blue-400">
            {`${settings.fallbackLineDuration ?? 4} s`}
          </span>
        </label>
        <button
          onClick={() =>
            update({
              unstampedAutoAdvance: settings.unstampedAutoAdvance !== true,
            })
          }
          className="mb-1.5 flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 transition-colors hover:bg-slate-700/40"
        >
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-slate-300">
              Auto-Advance Unstamped Lines
            </span>
            <span className="text-[9px] text-slate-500">
              Show lines that have no timing yet
            </span>
          </div>
          <div
            className={`h-3 w-3 shrink-0 rounded-full transition-all ${
              settings.unstampedAutoAdvance === true
                ? "bg-blue-400"
                : "bg-slate-600"
            }`}
          />
        </button>
        <ScrubInput
          label="S"
          value={(settings.fallbackLineDuration as number) ?? 4}
          step={0.5}
          min={0.5}
          max={20}
          onUpdate={(val) => update({ fallbackLineDuration: val })}
        />
        <p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">
          Only used while auto-advance is on, for lines with no timing at all. A
          stamped line with no end of its own runs until the next line - or until
          the track ends.
        </p>
      </div>
    </div>
  );
};

/** Settings panel for the global "lyrics" overlay layer. */
export const LyricsSettingsView = (_props: { clip?: Record<string, any> }) => {
  const settings = editorStore.getState().clipSettings["lyrics"] as
    | Record<string, any>
    | undefined;

  if (!settings) return null;

  const update = (patch: Record<string, unknown>) =>
    updateClipSettings("lyrics", patch);

  const enabled = settings.enabled !== false;

  return (
    <>
      <button
        className={`mb-5 flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
          enabled
            ? "border-blue-600/40 bg-blue-600/20 text-blue-400"
            : "border-slate-700 bg-slate-800 text-slate-400"
        }`}
        onClick={() => update({ enabled: !enabled })}
      >
        <span className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase">
          <i
            className={`${enabled ? "icon-[ri--eye-line]" : "icon-[ri--eye-off-line]"} h-4 w-4`}
          />
          Lyrics Visible
        </span>
        <div
          className={`h-3 w-3 rounded-full transition-all ${
            enabled ? "bg-blue-400" : "bg-slate-600"
          }`}
        />
      </button>

      <SharedTextSettingsView
        settings={settings}
        updateSettings={update}
        // No textEffects: typewriter/wavy are per-clip animations and have no
        // meaning for a line that changes every few seconds.
        sections={["typography", "strokeShadow", "background"]}
      />
      <LyricDisplaySettingsView settings={settings} update={update} />
      <SharedTransformSettingsView
        settings={settings}
        updateSettings={update}
      />
    </>
  );
};