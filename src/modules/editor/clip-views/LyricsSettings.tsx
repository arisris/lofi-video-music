// Global lyrics styling — mirrors src_old/components/clip-settings/lyrics.tsx.
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
import { loadGoogleFont } from "../../../shared/lib/fonts";
import { TEXT_TEMPLATES, templateStyle } from "../../../shared/lib/text-templates";
import { ChoiceGrid } from "../../../shared/ui/ChoiceGrid";
import { ColorInput } from "../../../shared/ui/ColorInput";
import { FieldLabel, SectionTitle } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { ScrubInput } from "../../../shared/ui/ScrubInput";
import {
  BackgroundBoxSettings,
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

function LyricDisplaySettingsView({ binding }: { binding: SettingsBinding }) {
  const { values, set } = binding;
  const enterType = resolveEnterTransition(values.lineTransitionIn ?? values.lineTransition);
  const exitType = resolveExitTransition(values.lineTransitionOut);
  const seconds = typeof values.lineTransitionDuration === "number" ? values.lineTransitionDuration : 0.3;
  const off = enterType === "none" && exitType === "none";

  return (
    <div>
      <SectionTitle>Lyric Display</SectionTitle>

      <ColorInput
        label="Active Line Color"
        value={typeof values.activeColor === "string" ? values.activeColor : (typeof values.color === "string" ? values.color : "#ffffff")}
        onUpdate={(val) => set("activeColor", val)}
      />
      <ColorInput
        label="Inactive Line Color"
        value={typeof values.inactiveColor === "string" ? values.inactiveColor : "#94a3b8"}
        onUpdate={(val) => set("inactiveColor", val)}
      />

      <div className="mb-4">
        <FieldLabel
          value={<span className="font-mono text-[10px] text-blue-400">{off ? "off" : `${seconds.toFixed(2)} s`}</span>}
        >
          Line Transition
        </FieldLabel>

        <p className="mb-1 text-[9px] font-bold tracking-wider text-neutral-500 uppercase">In (S)</p>
        <ChoiceGrid
          options={ENTER_TRANSITIONS.map((option) => ({ value: option.id, label: option.label }))}
          value={enterType}
          onChange={(v) => set("lineTransitionIn", v)}
        />

        <p className="mt-2.5 mb-1 text-[9px] font-bold tracking-wider text-neutral-500 uppercase">Out (E)</p>
        <ChoiceGrid
          options={EXIT_TRANSITIONS.map((option) => ({ value: option.id, label: option.label }))}
          value={exitType}
          onChange={(v) => set("lineTransitionOut", v)}
        />

        <div className={`mt-2 ${off ? "pointer-events-none opacity-40" : ""}`}>
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
          In eases a line in as it takes over; Out eases it away before its own end. A line that runs to the
          end of the track stays put, since there is nothing after it to clear the way for.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel
            value={<span className="font-mono text-[10px] text-blue-400">{typeof values.contextLines === "number" ? values.contextLines : 0}</span>}
          >
            Context Lines
          </FieldLabel>
          <ScrubInput
            label="N"
            value={typeof values.contextLines === "number" ? values.contextLines : 0}
            min={0}
            max={5}
            onUpdate={(val) => set("contextLines", Math.round(val))}
          />
        </div>
        <div>
          <FieldLabel
            value={
              <span className="font-mono text-[10px] text-blue-400">
                {`${Math.round((typeof values.activeSizeBoost === "number" ? values.activeSizeBoost : 1) * 100)}%`}
              </span>
            }
          >
            Active Size Boost
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
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel
            value={<span className="font-mono text-[10px] text-blue-400">{`${typeof values.lineGap === "number" ? values.lineGap : 8} px`}</span>}
          >
            Line Gap
          </FieldLabel>
          <ScrubInput
            label="G"
            value={typeof values.lineGap === "number" ? values.lineGap : 8}
            min={0}
            max={80}
            onUpdate={(val) => set("lineGap", val)}
          />
        </div>
        <div>
          <FieldLabel
            value={
              <span className="font-mono text-[10px] text-blue-400">
                {`${Math.round((typeof values.inactiveOpacity === "number" ? values.inactiveOpacity : 0.45) * 100)}%`}
              </span>
            }
          >
            Inactive Opacity
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

      <SectionTitle className="mt-6 mb-4">Timing</SectionTitle>
      <div className="mb-3">
        <FieldLabel
          value={
            <span className="font-mono text-[10px] text-blue-400">
              {`${(typeof values.offsetSeconds === "number" ? values.offsetSeconds : 0).toFixed(2)} s`}
            </span>
          }
        >
          Offset
        </FieldLabel>
        <ScrubInput
          label="O"
          value={typeof values.offsetSeconds === "number" ? values.offsetSeconds : 0}
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
        <FieldLabel
          value={
            <span className="font-mono text-[10px] text-blue-400">
              {`${typeof values.fallbackLineDuration === "number" ? values.fallbackLineDuration : 4} s`}
            </span>
          }
        >
          Default Line Length
        </FieldLabel>
        <button
          onClick={() => set("unstampedAutoAdvance", values.unstampedAutoAdvance !== true)}
          className="mb-1.5 flex w-full cursor-pointer items-center justify-between rounded-lg border border-neutral-700/50 bg-neutral-800/40 p-2.5 transition-colors hover:bg-neutral-700/40"
        >
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-neutral-300">Auto-Advance Unstamped Lines</span>
            <span className="text-[9px] text-neutral-500">Show lines that have no timing yet</span>
          </div>
          <div className={`h-3 w-3 shrink-0 rounded-full transition-all ${values.unstampedAutoAdvance === true ? "bg-blue-400" : "bg-neutral-600"}`} />
        </button>
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
  );
}

/** All global lyrics styling (no Sync — Sync lives in the panel tab). */
export function LyricsStyleSettings() {
  const binding = useGlobalLyricsBinding();
  const updateLyricsSettings = useEditorStore((s) => s.updateLyricsSettings);
  return (
    <InspectorRoot>
      <div>
        <SectionTitle>Templates</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {TEXT_TEMPLATES.map((template) => (
            <button
              key={template.name}
              title={template.name}
              onClick={() => {
                const style = templateStyle(template) as Record<string, unknown>;
                // Template uses `textColor`; lyrics drawing reads
                // `activeColor`/`color` — map so it shows.
                const patch: Record<string, unknown> = { ...style };
                if (typeof style.textColor === "string") {
                  patch.activeColor = style.textColor;
                  patch.color = style.textColor;
                }
                if (typeof style.fontFamily === "string") {
                  loadGoogleFont(style.fontFamily as string);
                }
                updateLyricsSettings(patch);
              }}
              className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-neutral-700/50 bg-neutral-800/40 px-1 transition-all hover:scale-[1.02] hover:border-blue-500/30 hover:bg-blue-600/10"
            >
              <div
                ref={(el) => {
                  if (el) el.style.cssText = template.cssStyle;
                }}
                className="flex h-full w-full items-center justify-center overflow-hidden text-center text-[11px] leading-none"
              >
                {template.name}
              </div>
            </button>
          ))}
        </div>
      </div>
      <TypographySettings binding={binding} />
      <StrokeShadowSettings binding={binding} />
      <BackgroundBoxSettings binding={binding} />
      <div className="mt-6 border-t border-neutral-800/50 pt-4">
        <LyricDisplaySettingsView binding={binding} />
      </div>
      <TransformSettings binding={binding} />
    </InspectorRoot>
  );
}
