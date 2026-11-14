// 1:1 text property panel of the legacy app: content editor + emoji, typography,
// stroke & shadow, background box, text effects, transform, animation.
import { useEffect, useState } from "react";
import charsData from "../../../data/chars.json";
import { loadGoogleFont } from "../../../shared/lib/fonts";
import { ENTER_TRANSITIONS, EXIT_TRANSITIONS } from "../../../shared/lib/transitions";
import { ColorInput } from "../../../shared/ui/ColorInput";
import { FieldLabel, SectionTitle } from "../../../shared/ui/FieldLabel";
import { FontSelector } from "../../../shared/ui/FontSelector";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { RangeInput } from "../../../shared/ui/RangeInput";
import { ScrubInput } from "../../../shared/ui/ScrubInput";
import { SettingRow, TogglePill } from "../../../shared/ui/SettingRow";
import { SelectControl } from "../../../shared/ui/Select";
import { ToggleControl } from "../../../shared/ui/ToggleControl";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { useEditorStore } from "../../../store/editor-store";

type Chars = { categories: Array<{ id: string; name: string; icon: string; items: string[] }> };
const CHARS = charsData as unknown as Chars;

function computeCoords(trigger: HTMLElement | null) {
  if (!trigger) return { top: 0, left: 0 };
  const rect = trigger.getBoundingClientRect();
  const boxWidth = 288;
  const boxHeight = 350;

  let left = rect.left;
  let top = rect.top - boxHeight - 8;

  if (left + boxWidth > window.innerWidth - 16) {
    left = window.innerWidth - boxWidth - 16;
  }
  if (left < 16) left = 16;
  if (top < 16) {
    top = rect.bottom + 8;
    // Trigger near the bottom: the flipped box can still overflow.
    if (top + boxHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - boxHeight - 16);
    }
  }

  return { top, left };
}

/** Floating emoji & special character picker anchored to a trigger element. */
function CharBox({
  trigger,
  onSelect,
  onClose,
}: {
  trigger: HTMLElement | null;
  onSelect: (char: string) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState(CHARS.categories[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((c) => c + 1);
    window.addEventListener("resize", bump);
    return () => window.removeEventListener("resize", bump);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (trigger && e.target instanceof Node && !trigger.contains(e.target)) {
        const box = document.getElementById("char-box-popup");
        if (!box || !box.contains(e.target as Node)) onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [trigger, onClose]);

  const coords = computeCoords(trigger);
  const categories = CHARS.categories;
  const activeCat = categories.find((c) => c.id === activeCategory);

  let items = activeCat ? activeCat.items : [];
  if (searchQuery) {
    items = categories
      .flatMap((c) => c.items)
      .filter((item) => item.includes(searchQuery))
      .slice(0, 100);
  }

  return (
    <div
      id="char-box-popup"
      className="animate-in fade-in zoom-in-95 fixed z-9999 flex flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl duration-200"
      style={{ width: "288px", maxHeight: "400px", top: `${coords.top}px`, left: `${coords.left}px` }}
    >
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/50 p-3">
        <div className="relative flex-1">
          <i className="absolute top-1/2 left-2 icon-[ri--search-line] -translate-y-1/2 text-xs text-neutral-500" />
          <input
            type="text"
            placeholder="Search characters..."
            className="w-full rounded-md border-none bg-neutral-800 py-1.5 pr-3 pl-8 text-xs text-white outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800"
          onClick={onClose}
        >
          <i className="icon-[ri--close-line] text-sm" />
        </button>
      </div>
      {!searchQuery && (
        <div className="flex min-h-11.5 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-neutral-800 bg-neutral-950/50 px-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`shrink-0 rounded-lg px-2 py-1 text-lg transition-all ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-neutral-400 hover:bg-neutral-800"
              }`}
              title={cat.name}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}
      <div className="custom-scrollbar grid flex-1 grid-cols-8 gap-1 overflow-y-auto bg-neutral-900 p-2">
        {items.map((item, i) => (
          <button
            key={`${item}-${i}`}
            className="flex aspect-square items-center justify-center rounded-lg text-xl transition-all hover:bg-neutral-800 active:scale-90"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-950/50 p-2">
        <span className="text-[10px] font-medium text-neutral-500">
          {searchQuery ? `Found ${items.length} items` : activeCat?.name}
        </span>
        <div className="flex gap-1" />
      </div>
    </div>
  );
}

export interface SettingsBinding {
  values: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}

export function TypographySettings({
  clipId,
  binding,
  hideLineHeight = false,
  hideAlign = false,
  hideTextColor = false,
}: {
  clipId?: string;
  binding?: SettingsBinding;
  /** Lyrics space vertically with Line Gap instead — Line H would be dead. */
  hideLineHeight?: boolean;
  /** Lyrics always draw centered — Align would be dead. */
  hideAlign?: boolean;
  /** Lyrics set the active color in Lyric Display — a second Text Color here would be a dead duplicate. */
  hideTextColor?: boolean;
}) {
  const clipBinding = useClipSettings(clipId ?? "");
  const { values, set } = binding ?? clipBinding;

  useEffect(() => {
    if (typeof values.fontFamily === "string" && values.fontFamily) {
      loadGoogleFont(values.fontFamily);
    }
  }, [values.fontFamily]);

  const update = (key: string, val: unknown) => {
    set(key, val);
  };

  return (
    <>
      <SectionTitle>Typography</SectionTitle>
      <FontSelector
        value={typeof values.fontFamily === "string" ? values.fontFamily : "sans-serif"}
        onUpdate={(val) => update("fontFamily", val)}
      />
      <div className={`mb-3 grid gap-3 ${hideLineHeight ? "grid-cols-1" : "grid-cols-2"}`}>
        <div>
          <FieldLabel>Size</FieldLabel>
          <ScrubInput
            label="S"
            value={typeof values.fontSize === "number" ? values.fontSize : 24}
            min={8}
            max={300}
            onUpdate={(val) => update("fontSize", val)}
          />
        </div>
        {!hideLineHeight && (
        <div>
          <FieldLabel>Line H</FieldLabel>
          <ScrubInput
            label="LH"
            value={typeof values.lineHeight === "number" ? values.lineHeight : 1.2}
            step={0.1}
            min={0.5}
            max={3}
            onUpdate={(val) => update("lineHeight", val)}
          />
        </div>
        )}
      </div>
      <div className={`mb-3 grid gap-3 ${hideAlign ? "grid-cols-1" : "grid-cols-2"}`}>
        <div>
          <FieldLabel>Weight</FieldLabel>
          <SelectControl
            value={typeof values.fontWeight === "string" ? values.fontWeight : "normal"}
            options={["100", "200", "300", "400", "500", "600", "700", "800", "900", "normal", "bold"]}
            onChange={(v) => update("fontWeight", v)}
            size="sm"
          />
        </div>
        {!hideAlign && (
        <div>
          <FieldLabel>Align</FieldLabel>
          <SelectControl
            value={typeof values.textAlign === "string" ? values.textAlign : "center"}
            options={["left", "center", "right"]}
            onChange={(v) => update("textAlign", v)}
            size="sm"
          />
        </div>
        )}
      </div>
      {!hideTextColor && (
      <ColorInput
        label="Text Color"
        value={typeof values.textColor === "string" ? values.textColor : "#ffffff"}
        onUpdate={(val) => update("textColor", val)}
      />
      )}
    </>
  );
}

export function StrokeShadowSettings({ clipId, binding }: { clipId?: string; binding?: SettingsBinding }) {
  const clipBinding = useClipSettings(clipId ?? "");
  const { values, set } = binding ?? clipBinding;
  const update = (key: string, val: unknown) => set(key, val);

  return (
    <div className="mt-6 border-t border-neutral-800/50 pt-4">
      <SectionTitle>Stroke &amp; Shadow</SectionTitle>
      <ColorInput
        label="Stroke Color"
        value={typeof values.strokeColor === "string" ? values.strokeColor : "#000000"}
        onUpdate={(val) => update("strokeColor", val)}
      />
      <div className="mb-4">
        <FieldLabel>Stroke Width</FieldLabel>
        <ScrubInput
          label="W"
          value={typeof values.strokeWidth === "number" ? values.strokeWidth : 0}
          min={0}
          max={20}
          onUpdate={(val) => update("strokeWidth", val)}
        />
      </div>
      <ColorInput
        label="Shadow Color"
        value={typeof values.shadowColor === "string" ? values.shadowColor : "rgba(0,0,0,0.8)"}
        onUpdate={(val) => update("shadowColor", val)}
      />
      <div className="mb-3 grid grid-cols-3 gap-3">
        <div>
          <FieldLabel>Blur</FieldLabel>
          <ScrubInput
            label="B"
            value={typeof values.shadowBlur === "number" ? values.shadowBlur : 0}
            min={0}
            max={50}
            onUpdate={(val) => update("shadowBlur", val)}
          />
        </div>
        <div>
          <FieldLabel>Offset X</FieldLabel>
          <ScrubInput
            label="OX"
            value={typeof values.shadowOffsetX === "number" ? values.shadowOffsetX : 0}
            onUpdate={(val) => update("shadowOffsetX", val)}
          />
        </div>
        <div>
          <FieldLabel>Offset Y</FieldLabel>
          <ScrubInput
            label="OY"
            value={typeof values.shadowOffsetY === "number" ? values.shadowOffsetY : 0}
            onUpdate={(val) => update("shadowOffsetY", val)}
          />
        </div>
      </div>
    </div>
  );
}

export function BackgroundBoxSettings({ clipId, binding }: { clipId?: string; binding?: SettingsBinding }) {
  const clipBinding = useClipSettings(clipId ?? "");
  const { values, set } = binding ?? clipBinding;
  const update = (key: string, val: unknown) => set(key, val);

  return (
    <div className="mt-6 border-t border-neutral-800/50 pt-4">
      <SectionTitle>Background Box</SectionTitle>
      <ColorInput
        label="BG Color (use transparent for none)"
        value={typeof values.bgColor === "string" ? values.bgColor : "transparent"}
        onUpdate={(val) => update("bgColor", val)}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Padding</FieldLabel>
          <ScrubInput
            label="P"
            value={typeof values.bgPadding === "number" ? values.bgPadding : 10}
            min={0}
            max={100}
            onUpdate={(val) => update("bgPadding", val)}
          />
        </div>
        <div>
          <FieldLabel>Radius</FieldLabel>
          <ScrubInput
            label="R"
            value={typeof values.bgRadius === "number" ? values.bgRadius : 8}
            min={0}
            max={50}
            onUpdate={(val) => update("bgRadius", val)}
          />
        </div>
      </div>
    </div>
  );
}

export function TextEffectsSettings({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const update = (key: string, val: unknown) => set(key, val);
  const effect = typeof values.textEffect === "string" ? values.textEffect : "none";

  return (
    <div className="mt-6 border-t border-neutral-800/50 pt-4">
      <SectionTitle>Text Effects</SectionTitle>
      <div className="mb-3">
        <FieldLabel>Effect Type</FieldLabel>
        <SelectControl
          value={effect}
          options={[
            { value: "none", label: "None" },
            { value: "typewriter", label: "Typewriter" },
            { value: "wavy", label: "Wavy" },
          ]}
          onChange={(v) => update("textEffect", v)}
          size="md"
        />
      </div>
      {effect === "typewriter" && (
        <>
          <div className="mb-3">
            <FieldLabel
              value={
                <span className="font-mono text-[10px] text-blue-400">
                {`${typeof values.typewriterSpeed === "number" ? values.typewriterSpeed : 15} char/s`}
              </span>
              }
            >
              Typing Speed
            </FieldLabel>
            <ScrubInput
              label="Speed"
              value={typeof values.typewriterSpeed === "number" ? values.typewriterSpeed : 15}
              min={1}
              max={100}
              onUpdate={(val) => update("typewriterSpeed", val)}
            />
          </div>
          <div className="mb-3">
            <SettingRow
              padding="sm"
              title="Type Out (Backspace)"
              description="Backspace at the end of the clip"
              control={
                <TogglePill
                  value={values.typewriterOut !== false}
                  onToggle={() => update("typewriterOut", values.typewriterOut === false)}
                />
              }
            />
          </div>
        </>
      )}
      {effect === "wavy" && (
        <>
          <div className="mb-3">
            <FieldLabel
              value={
                <span className="font-mono text-[10px] text-blue-400">
                {`${typeof values.wavyAmplitude === "number" ? values.wavyAmplitude : 6} px`}
              </span>
              }
            >
              Wave Amplitude
            </FieldLabel>
            <ScrubInput
              label="Amp"
              value={typeof values.wavyAmplitude === "number" ? values.wavyAmplitude : 6}
              min={0}
              max={50}
              onUpdate={(val) => update("wavyAmplitude", val)}
            />
          </div>
          <div className="mb-3">
            <FieldLabel
              value={
                <span className="font-mono text-[10px] text-blue-400">
                {`${typeof values.wavyFrequency === "number" ? values.wavyFrequency : 4} Hz`}
              </span>
              }
            >
              Wave Speed
            </FieldLabel>
            <ScrubInput
              label="Speed"
              value={typeof values.wavyFrequency === "number" ? values.wavyFrequency : 4}
              step={0.1}
              min={0.1}
              max={20}
              onUpdate={(val) => update("wavyFrequency", val)}
            />
          </div>
          <div className="mb-3">
            <FieldLabel
              value={
                <span className="font-mono text-[10px] text-blue-400">
                {`${typeof values.wavySpacing === "number" ? values.wavySpacing : 0.15}`}
              </span>
              }
            >
              Wave Letter Spacing
            </FieldLabel>
            <ScrubInput
              label="Spacing"
              value={typeof values.wavySpacing === "number" ? values.wavySpacing : 0.15}
              step={0.01}
              min={0}
              max={2}
              onUpdate={(val) => update("wavySpacing", val)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function TransformSettings({ clipId, binding }: { clipId?: string; binding?: SettingsBinding }) {
  const clipBinding = useClipSettings(clipId ?? "");
  const { values, set } = binding ?? clipBinding;
  const update = (key: string, val: unknown) => set(key, val);
  const num = (v: unknown, fb: number) => (typeof v === "number" ? v : fb);

  return (
    <div className="mt-6 border-t border-neutral-800/50 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Transform</h4>
        <button
          className="flex items-center gap-1 text-[9px] text-neutral-500 transition-colors hover:text-blue-400"
          onClick={() => {
            set("x", 0);
            set("y", 0);
            set("scaleX", 1);
            set("scaleY", 1);
            set("rotation", 0);
          }}
        >
          <i className="icon-[ri--restart-line] h-2.5 w-2.5" />
          Reset
        </button>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <ScrubInput label="X" value={num(values.x, 0)} step={1} onUpdate={(val) => update("x", val)} />
        <ScrubInput label="Y" value={num(values.y, 0)} step={1} onUpdate={(val) => update("y", val)} />
      </div>
      <div className="mt-1 mb-3 rounded border border-neutral-800/40 bg-neutral-950/20 p-2.5">
        <label className="mb-1.5 flex justify-between text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
          <span>Uniform Size / Scale</span>
          <span className="font-mono text-[10px] text-blue-400">{`${Math.round(num(values.scaleX, 1) * 100)}%`}</span>
        </label>
        <div className="flex items-center gap-2">
          <RangeInput
            value={num(values.scaleX, 1)}
            min={0.05}
            max={5}
            step={0.05}
            onChange={(val) => {
              set("scaleX", val);
              set("scaleY", val);
            }}
            ariaLabel="Uniform Size"
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-800"
          />
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 p-1 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            title="Reset Scale"
            onClick={() => {
              set("scaleX", 1);
              set("scaleY", 1);
            }}
          >
            <i className="icon-[ri--aspect-ratio-line] h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <ScrubInput
          label="SX"
          value={num(values.scaleX, 1)}
          step={0.01}
          min={0.01}
          max={10}
          onUpdate={(val) => update("scaleX", val)}
        />
        <ScrubInput
          label="SY"
          value={num(values.scaleY, 1)}
          step={0.01}
          min={0.01}
          max={10}
          onUpdate={(val) => update("scaleY", val)}
        />
      </div>
      <div className="w-full">
        <ScrubInput
          label="R"
          value={num(values.rotation, 0)}
          step={1}
          onUpdate={(val) => update("rotation", val)}
        />
      </div>
    </div>
  );
}

export function AnimationSettings({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const anim =
    values.animations && typeof values.animations === "object"
      ? (values.animations as Record<string, unknown>)
      : {};
  const update = (key: string, val: unknown) =>
    set("animations", { ...anim, [key]: val });

  return (
    <div className="mt-6 border-t border-neutral-800/50 pt-4">
      <SectionTitle>Animations</SectionTitle>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>In Effect</FieldLabel>
          <SelectControl
            value={typeof anim.inType === "string" ? anim.inType : "fade"}
            options={ENTER_TRANSITIONS.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => update("inType", v)}
            size="sm"
          />
        </div>
        <div>
          <FieldLabel>Out Effect</FieldLabel>
          <SelectControl
            value={typeof anim.outType === "string" ? anim.outType : "fade"}
            options={EXIT_TRANSITIONS.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => update("outType", v)}
            size="sm"
          />
        </div>
      </div>
      <div className="mb-4">
        <FieldLabel>Continuous Loop</FieldLabel>
        <SelectControl
          value={typeof anim.type === "string" ? anim.type : "none"}
          options={["none", "pulse", "float", "shake", "swing"]}
          onChange={(v) => update("type", v)}
          size="sm"
        />
      </div>
      <SettingRow
        title="Audio Reactive"
        description="Sync effect to music beat"
        control={
          <TogglePill value={anim.audioReactive === true} onToggle={() => update("audioReactive", !(anim.audioReactive === true))} />
        }
      />
    </div>
  );
}

function TextContentEditor({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const [showCharBox, setShowCharBox] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);

  const insertChar = (char: string) => {
    const el = document.getElementById(`text-editor-${clipId}`) as HTMLTextAreaElement | null;
    setShowCharBox(false);
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const text = el.value;
      const next = text.substring(0, start) + char + text.substring(end);
      el.value = next;
      set("content", next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + char.length, start + char.length);
      }, 0);
    } else {
      set("content", `${typeof values.content === "string" ? values.content : ""}${char}`);
    }
  };

  return (
    <div className="relative">
      <textarea
        id={`text-editor-${clipId}`}
        key={`textarea-${clipId}`}
        defaultValue={typeof values.content === "string" ? values.content : ""}
        className="min-h-15 w-full resize-y rounded border border-neutral-700 bg-neutral-800 p-2 text-xs text-white outline-none focus:border-blue-500"
        onInput={(e) => set("content", e.currentTarget.value)}
      />
      <div className="mt-1.5 flex items-center justify-between">
        <div className="relative">
          <button
            ref={(el) => setTriggerEl(el)}
            className={`flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400 transition-all hover:bg-neutral-700 ${
              showCharBox ? "border-blue-500/30 text-blue-400" : ""
            }`}
            onClick={() => setShowCharBox((v) => !v)}
          >
            <i className="icon-[ri--chat-smile-2-line] h-3 w-3" />
            Emoji &amp; Chars
          </button>
          {showCharBox && (
            <CharBox
              trigger={triggerEl}
              onSelect={insertChar}
              onClose={() => setShowCharBox(false)}
            />
          )}
        </div>
        <p className="text-[10px] text-neutral-500">Use \n for multiple lines</p>
      </div>
    </div>
  );
}

export function TextLayoutSettings({ clipId, binding }: { clipId?: string; binding?: SettingsBinding }) {
  const clipBinding = useClipSettings(clipId ?? "");
  const { values, set } = binding ?? clipBinding;
  const num = (v: unknown, fb: number) => (typeof v === "number" ? v : fb);

  return (
    <div className="mt-6 border-t border-neutral-800/50 pt-4">
      <SectionTitle>Layout &amp; Opacity</SectionTitle>
      <div className="mb-3">
        <FieldLabel>Base Y offset</FieldLabel>
        <ScrubInput
          label="BY"
          value={num(values.offsetY, -100)}
          min={-500}
          max={500}
          step={1}
          onUpdate={(val) => set("offsetY", val)}
        />
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
          Base vertical position before drag (X/Y). Use drag on canvas for fine placement.
        </p>
      </div>
      <div className="mb-3">
        <FieldLabel>Opacity</FieldLabel>
        <ScrubInput
          label="O"
          value={num(values.opacity, 1)}
          min={0}
          max={1}
          step={0.05}
          onUpdate={(val) => set("opacity", Math.max(0, Math.min(1, val)))}
        />
      </div>
    </div>
  );
}

/** Text clip property panel — mirrors the legacy TextSettingsView. */
export function TextSettingsView({ clipId }: { clipId: string }) {
  const isThumbnailMode = useEditorStore((s) => s.route) === "/image";
  return (
    <InspectorRoot>
      <TextContentEditor clipId={clipId} />
      <div className="mt-6 border-t border-neutral-800/50 pt-4">
        <TypographySettings clipId={clipId} />
        <StrokeShadowSettings clipId={clipId} />
        <BackgroundBoxSettings clipId={clipId} />
        <TextLayoutSettings clipId={clipId} />
        {!isThumbnailMode && <TextEffectsSettings clipId={clipId} />}
      </div>
      <TransformSettings clipId={clipId} />
      {!isThumbnailMode && <AnimationSettings clipId={clipId} />}
    </InspectorRoot>
  );
}

/** Title clip property panel — mirrors the legacy TitleSettingsView. */
export function TitleSettingsView({ clipId }: { clipId: string }) {
  const isThumbnailMode = useEditorStore((s) => s.route) === "/image";
  const { values, set } = useClipSettings(clipId);
  const auto = (values.autoTrackName as boolean | undefined) !== false;
  return (
    <InspectorRoot>
      <ToggleControl
        label="Auto track name"
        value={auto}
        onChange={(v) => set("autoTrackName", v)}
      />
      {!auto && <TextContentEditor clipId={clipId} />}
      {auto && (
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Title follows the music clip name under the playhead (as in the legacy app);
          when no track is active, the title is hidden. Turn off for manual
          text.
        </p>
      )}
      <div className="mt-6 border-t border-neutral-800/50 pt-4">
        <TypographySettings clipId={clipId} />
        <StrokeShadowSettings clipId={clipId} />
        <BackgroundBoxSettings clipId={clipId} />
        <TextLayoutSettings clipId={clipId} />
        {!isThumbnailMode && <TextEffectsSettings clipId={clipId} />}
      </div>
      <TransformSettings clipId={clipId} />
      {!isThumbnailMode && <AnimationSettings clipId={clipId} />}
    </InspectorRoot>
  );
}
