// Global lyrics styling
// One global layer (lyricsSettings store), not per clip: typography,
// stroke/shadow, background box, display controls + Transform.
import { useMemo } from "react";
import {
  ENTER_TRANSITIONS,
  EXIT_TRANSITIONS,
  resolveEnterTransition,
  resolveExitTransition,
} from "../../../shared/lib/transitions";
import { useEditorStore } from "../../../store/editor-store";
import { ColorInput } from "../../../shared/ui/ColorInput";
import { FieldLabel, SectionTitle } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { ScrubInput } from "../../../shared/ui/ScrubInput";
import { SelectControl } from "../../../shared/ui/Select";
import { SettingRow, TogglePill } from "../../../shared/ui/SettingRow";
import {
  StrokeShadowSettings,
  TransformSettings,
  TypographySettings,
  type SettingsBinding,
} from "./TextSettings";

/** Global lyricsSettings binding for the shared sections. */
export function useGlobalLyricsBinding(): SettingsBinding {
  const values = useEditorStore((s) => s.lyricsSettings);
  const update = useEditorStore((s) => s.updateLyricsSettings);
  return useMemo(
    () => ({
      values,
      set: (key: string, value: unknown) => update({ [key]: value }),
    }),
    [values, update],
  );
}

function StackOnlyChip() {
  return (
    <span className="ml-1 rounded bg-neutral-800 px-1 py-px align-middle text-[8px] font-bold tracking-wider text-neutral-500 uppercase">
      Stack only
    </span>
  );
}

function LyricDisplaySettingsView({ binding }: { binding: SettingsBinding }) {
  const { values, set } = binding;
  const karaoke = values.karaokeMode === true;
  const enterType = resolveEnterTransition(values.lineTransitionIn ?? values.lineTransition);
  const exitType = resolveExitTransition(values.lineTransitionOut);
  const seconds = typeof values.lineTransitionDuration === "number" ? values.lineTransitionDuration : 0.3;
  // Explicit master switch (defaults on); the pickers underneath still select
  // the curves for when it is re-enabled. Both-none also reads as off.
  const transOn = values.lineTransitionEnabled !== false;
  const off = !transOn || (enterType === "none" && exitType === "none");
  const rawContext = typeof values.contextLines === "number" ? Math.round(values.contextLines) : 1;
  // Same fallback as the renderer (stackCounts): legacy `contextLines`
  // feeds both sides, floored at one; explicit before/after win.
  const legacyFallback = Math.max(1, rawContext);
  const beforeShown =
    typeof values.contextBefore === "number" ? Math.round(values.contextBefore) : legacyFallback;
  const afterShown =
    typeof values.contextAfter === "number" ? Math.round(values.contextAfter) : legacyFallback;
  const autoAdvance = values.unstampedAutoAdvance === true;
  const offset = typeof values.offsetSeconds === "number" ? values.offsetSeconds : 0;

  const modeCard = (active: boolean) =>
    active
      ? "border-blue-500/50 bg-blue-600/10"
      : "border-neutral-700/50 bg-neutral-800/40 hover:border-neutral-600 hover:bg-neutral-700/40";

  return (
    <div>
      <SectionTitle>Lyric Display</SectionTitle>

      <div className="mb-1 grid grid-cols-2 gap-2">
        <button
          onClick={() => set("karaokeMode", false)}
          aria-pressed={!karaoke}
          className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${modeCard(!karaoke)}`}
        >
          <div className="flex h-8 flex-col items-center justify-center gap-1" aria-hidden>
            <div className="h-1.5 w-3/4 rounded-full bg-white" />
            <div className="h-1 w-1/2 rounded-full border border-dashed border-neutral-700" />
            <div className="h-1 w-1/2 rounded-full border border-dashed border-neutral-700" />
          </div>
          <div className={`mt-1.5 text-[10px] font-bold ${!karaoke ? "text-blue-400" : "text-neutral-300"}`}>
            Single line
          </div>
          <div className="text-[9px] leading-snug text-neutral-500">
            One line at a time; gaps stay empty.
          </div>
        </button>
        <button
          onClick={() => set("karaokeMode", true)}
          aria-pressed={karaoke}
          className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${modeCard(karaoke)}`}
        >
          <div className="flex h-8 flex-col items-center justify-center gap-1" aria-hidden>
            <div className="h-1 w-1/2 rounded-full bg-neutral-500" />
            <div className="h-1.5 w-3/4 rounded-full bg-white" />
            <div className="h-1 w-1/2 rounded-full bg-neutral-500" />
          </div>
          <div className={`mt-1.5 text-[10px] font-bold ${karaoke ? "text-blue-400" : "text-neutral-300"}`}>
            Stack (Karaoke)
          </div>
          <div className="text-[9px] leading-snug text-neutral-500">
            Neighbours stay on screen; holds the last line through gaps.
          </div>
        </button>
      </div>
      <p className="mb-4 text-[9px] leading-relaxed text-neutral-500">
        {karaoke
          ? "Stack shows neighbouring lines dimmed around the active one."
          : "Single shows only the active line — neighbour controls below are parked until you switch to Stack."}
      </p>

      <SectionTitle className="mb-3">Colors</SectionTitle>
      <ColorInput
        label="Active Line Color"
        value={typeof values.activeColor === "string" ? values.activeColor : (typeof values.color === "string" ? values.color : "#ffffff")}
        onUpdate={(val) => set("activeColor", val)}
      />
      <div className={karaoke ? "" : "pointer-events-none opacity-40"}>
        <ColorInput
          label={<span>Inactive Line Color {!karaoke && <StackOnlyChip />}</span>}
          value={typeof values.inactiveColor === "string" ? values.inactiveColor : "#94a3b8"}
          onUpdate={(val) => set("inactiveColor", val)}
        />
      </div>

      <SectionTitle className="mt-6 mb-3">Layout</SectionTitle>
      <div className={`mb-1 grid grid-cols-2 gap-3 ${karaoke ? "" : "pointer-events-none opacity-40"}`}>
        <div>
          <FieldLabel
            value={<span className="font-mono text-[10px] text-blue-400">{beforeShown}</span>}
          >
            Lines Before {!karaoke && <StackOnlyChip />}
          </FieldLabel>
          <ScrubInput
            label="B"
            value={beforeShown}
            min={0}
            max={5}
            onUpdate={(val) => set("contextBefore", Math.round(val))}
          />
        </div>
        <div>
          <FieldLabel
            value={<span className="font-mono text-[10px] text-blue-400">{afterShown}</span>}
          >
            Lines After {!karaoke && <StackOnlyChip />}
          </FieldLabel>
          <ScrubInput
            label="A"
            value={afterShown}
            min={0}
            max={5}
            onUpdate={(val) => set("contextAfter", Math.round(val))}
          />
        </div>
      </div>
      <p className="mb-4 text-[9px] leading-relaxed text-neutral-500">
        {karaoke && beforeShown === 0 && afterShown === 0
          ? "0 + 0 keeps a single persistent line (hold only, no neighbours)."
          : "Lines after the active one extend downward — keep that number small so the stack stays inside the canvas."}
      </p>
      <div className="mb-4">
        <FieldLabel
          value={
            <span className="font-mono text-[10px] text-blue-400">
              {`${Math.round((typeof values.activeSizeBoost === "number" ? values.activeSizeBoost : 1) * 100)}%`}
            </span>
          }
        >
          Active Line Scale
        </FieldLabel>
        <ScrubInput
          label="X"
          value={typeof values.activeSizeBoost === "number" ? values.activeSizeBoost : 1}
          step={0.05}
          min={0.5}
          max={2}
          onUpdate={(val) => set("activeSizeBoost", val)}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className={karaoke ? "" : "pointer-events-none opacity-40"}>
          <FieldLabel
            value={<span className="font-mono text-[10px] text-blue-400">{`${typeof values.lineGap === "number" ? values.lineGap : 8} px`}</span>}
          >
            Line Gap {!karaoke && <StackOnlyChip />}
          </FieldLabel>
          <ScrubInput
            label="G"
            value={typeof values.lineGap === "number" ? values.lineGap : 8}
            min={0}
            max={80}
            onUpdate={(val) => set("lineGap", val)}
          />
        </div>
        <div className={karaoke ? "" : "pointer-events-none opacity-40"}>
          <FieldLabel
            value={
              <span className="font-mono text-[10px] text-blue-400">
                {`${Math.round((typeof values.inactiveOpacity === "number" ? values.inactiveOpacity : 0.45) * 100)}%`}
              </span>
            }
          >
            Inactive Opacity {!karaoke && <StackOnlyChip />}
          </FieldLabel>
          <ScrubInput
            label="A"
            value={typeof values.inactiveOpacity === "number" ? values.inactiveOpacity : 0.45}
            step={0.01}
            min={0}
            max={1}
            onUpdate={(val) => set("inactiveOpacity", val)}
          />
        </div>
      </div>

      <SectionTitle className="mt-6 mb-3">Motion</SectionTitle>
      <div className="mb-4">
        <SettingRow
          padding="sm"
          title="Line Transition"
          description="Ease the active line in and out as it takes over"
          control={
            <TogglePill
              value={transOn}
              onToggle={() => set("lineTransitionEnabled", !transOn)}
            />
          }
        />

        <div className={`mt-3 ${transOn ? "" : "pointer-events-none opacity-40"}`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Enter</FieldLabel>
              <SelectControl
                value={enterType}
                options={ENTER_TRANSITIONS.map((option) => ({ value: option.id, label: option.label }))}
                onChange={(v) => set("lineTransitionIn", v)}
                size="sm"
                ariaLabel="Line enter transition"
              />
            </div>
            <div>
              <FieldLabel>Exit</FieldLabel>
              <SelectControl
                value={exitType}
                options={EXIT_TRANSITIONS.map((option) => ({ value: option.id, label: option.label }))}
                onChange={(v) => set("lineTransitionOut", v)}
                size="sm"
                ariaLabel="Line exit transition"
              />
            </div>
          </div>

          <div className={`mt-3 ${off ? "pointer-events-none opacity-40" : ""}`}>
            <FieldLabel
              value={<span className="font-mono text-[10px] text-blue-400">{off ? "off" : `${seconds.toFixed(2)} s`}</span>}
            >
              Duration
            </FieldLabel>
            <ScrubInput
              label="T"
              value={seconds}
              step={0.05}
              min={0.05}
              max={2}
              onUpdate={(val) => set("lineTransitionDuration", val)}
            />
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-neutral-500">
            A line that runs to the end of the track stays put — there is nothing after it to clear the way for.
          </p>
        </div>
      </div>

      <SectionTitle className="mt-6 mb-4">Timing</SectionTitle>
      <div className="mb-3">
        <FieldLabel
          value={
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-blue-400">
                {`${offset.toFixed(2)} s`}
              </span>
              {offset !== 0 && (
                <button
                  onClick={() => set("offsetSeconds", 0)}
                  className="cursor-pointer rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
                >
                  Reset
                </button>
              )}
            </span>
          }
        >
          Offset
        </FieldLabel>
        <ScrubInput
          label="O"
          value={offset}
          step={0.05}
          min={-60}
          max={60}
          onUpdate={(val) => set("offsetSeconds", val)}
        />
        <p className="mt-1.5 text-[9px] leading-relaxed text-neutral-500">
          Shifts every line earlier (negative) or later (positive). Use it to nudge an imported .lrc onto the beat.
        </p>
      </div>
      <div>
        <SettingRow
          padding="sm"
          title="Auto-Advance Unstamped Lines"
          description="Show lines that have no timing yet"
          control={
            <TogglePill
              value={autoAdvance}
              onToggle={() => set("unstampedAutoAdvance", !autoAdvance)}
            />
          }
        />
        <div className={`mt-3 ${autoAdvance ? "" : "pointer-events-none opacity-40"}`}>
          <FieldLabel
            value={
              <span className="font-mono text-[10px] text-blue-400">
                {`${typeof values.fallbackLineDuration === "number" ? values.fallbackLineDuration : 4} s`}
              </span>
            }
          >
            Default Line Length
          </FieldLabel>
          <ScrubInput
            label="S"
            value={typeof values.fallbackLineDuration === "number" ? values.fallbackLineDuration : 4}
            step={0.5}
            min={0.5}
            max={20}
            onUpdate={(val) => set("fallbackLineDuration", val)}
          />
          <p className="mt-1.5 text-[9px] leading-relaxed text-neutral-500">
            Only used while auto-advance is on, for lines with no timing at all. A stamped line with no end of its
            own runs until the next line - or until the track ends.
          </p>
        </div>
      </div>
    </div>
  );
}

/** All global lyrics styling (no Sync — Sync lives in the panel tab). */
export function LyricsStyleSettings() {
  const binding = useGlobalLyricsBinding();
  const updateLyricsSettings = useEditorStore((s) => s.updateLyricsSettings);
  // The shared Typography section reads/writes `textColor`, but the lyrics
  // renderer keys the active line off `activeColor` (`color` = legacy alias).
  // Map them so the top-level Text Color control repaints lyrics instead of
  // silently diverging (defaults seed all three to #ffffff, so without this
  // the dedicated Active Line Color always won over Typography edits).
  const typographyBinding: SettingsBinding = useMemo(
    () => ({
      values: {
        ...binding.values,
        textColor:
          typeof binding.values.activeColor === "string"
            ? binding.values.activeColor
            : typeof binding.values.color === "string"
              ? binding.values.color
              : binding.values.textColor,
      },
      set: (key: string, value: unknown) => {
        if (key === "textColor") {
          updateLyricsSettings({ textColor: value, activeColor: value, color: value });
        } else {
          binding.set(key, value);
        }
      },
    }),
    [binding, updateLyricsSettings],
  );
  return (
    <InspectorRoot>
      <TypographySettings binding={typographyBinding} hideLineHeight hideAlign hideTextColor />
      <StrokeShadowSettings binding={binding} />
      {/* No BackgroundBox: the lyrics renderer draws bare centered lines and
        reads no bg* keys, so the shared section would be a dead control. */}
      <div className="mt-6 border-t border-neutral-800/50 pt-4">
        <LyricDisplaySettingsView binding={binding} />
      </div>
      <TransformSettings binding={binding} />
    </InspectorRoot>
  );
}
