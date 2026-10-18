import { useEffect } from "react";
import { loadGoogleFont, GoogleFontsList } from "../../lib/fonts";
import { useEditorStore } from "../../store/editor-store";
import { ScrubInput } from "../ui/scrub-input";
import { ColorInput } from "../ui/color-input";

export interface SharedSettingsProps {
  /** Settings object being edited (from a timeline clip or a registry layer). */
  settings: Record<string, any> | undefined;
  /** Immutable patch callback — the parent decides which store slice changes. */
  updateSettings: (patch: Record<string, unknown>) => void;
}

/** Whether the app is currently in thumbnail (/image) mode. */
export const useThumbnailMode = () =>
  useEditorStore((s) => s.currentRoute === "/image");

/**
 * Typography + stroke/shadow/background + text effects editor, shared by the
 * text/timeline, global "title" and "playlist" layers.
 */
export const SharedTextSettingsView = ({
  settings,
  updateSettings,
}: SharedSettingsProps) => {
  const isThumbnailMode = useThumbnailMode();

  // Load the current font on mount / change
  useEffect(() => {
    if (settings?.fontFamily) loadGoogleFont(settings.fontFamily as string);
  }, [settings?.fontFamily]);

  if (!settings) return null;

  const update = (key: string, val: unknown) => {
    if (key === "fontFamily") loadGoogleFont(val as string);
    updateSettings({ [key]: val });
  };

  return (
    <div className="mt-6 border-t border-slate-800/50 pt-4">
      <h4 className="mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
        Typography
      </h4>

      {/* Font Family */}
      <div className="mb-3">
        <label className="mb-1.5 block text-[10px] text-slate-500">
          Font Family
        </label>
        <div className="relative">
          <select
            className="w-full cursor-pointer appearance-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors outline-none hover:bg-slate-700/50 focus:border-blue-500/50"
            onChange={(e) => update("fontFamily", e.target.value)}
            onFocus={() => GoogleFontsList.forEach((f) => loadGoogleFont(f))}
            value={(settings.fontFamily as string) || "sans-serif"}
          >
            {GoogleFontsList.map((f) => (
              <option
                key={f}
                value={f}
                style={{
                  fontFamily: f,
                  padding: "10px",
                  background: "#1e293b",
                }}
              >
                {f.replace(/'/g, "")}
              </option>
            ))}
          </select>
          <i className="pointer-events-none absolute top-1/2 right-2 icon-[ri--arrow-down-s-line] -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        {/* Font Size */}
        <div>
          <label className="mb-1.5 block text-[10px] text-slate-500">
            Size
          </label>
          <ScrubInput
            label="S"
            value={(settings.fontSize as number) || 24}
            min={8}
            max={300}
            onUpdate={(val) => update("fontSize", val)}
          />
        </div>
        {/* Line Height */}
        <div>
          <label className="mb-1.5 block text-[10px] text-slate-500">
            Line H
          </label>
          <ScrubInput
            label="LH"
            value={(settings.lineHeight as number) || 1.2}
            step={0.1}
            min={0.5}
            max={3}
            onUpdate={(val) => update("lineHeight", val)}
          />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        {/* Font Weight */}
        <div>
          <label className="mb-1.5 block text-[10px] text-slate-500">
            Weight
          </label>
          <select
            className="h-7 w-full rounded border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300 outline-none"
            onChange={(e) => update("fontWeight", e.target.value)}
            value={(settings.fontWeight as string) || "normal"}
          >
            {[
              "100",
              "200",
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
              "normal",
              "bold",
            ].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        {/* Alignment */}
        <div>
          <label className="mb-1.5 block text-[10px] text-slate-500">
            Align
          </label>
          <select
            className="h-7 w-full rounded border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300 outline-none"
            onChange={(e) => update("textAlign", e.target.value)}
            value={(settings.textAlign as string) || "center"}
          >
            {["left", "center", "right"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Color */}
      <ColorInput
        label="Text Color"
        value={(settings.textColor as string) || "#ffffff"}
        onUpdate={(val) => update("textColor", val)}
      />

      {/* Stroke & Shadow */}
      <div className="mt-6 border-t border-slate-800/50 pt-4">
        <h4 className="mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          Stroke &amp; Shadow
        </h4>

        <ColorInput
          label="Stroke Color"
          value={(settings.strokeColor as string) || "#000000"}
          onUpdate={(val) => update("strokeColor", val)}
        />

        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] text-slate-500">
            Stroke Width
          </label>
          <ScrubInput
            label="W"
            value={(settings.strokeWidth as number) || 0}
            min={0}
            max={20}
            onUpdate={(val) => update("strokeWidth", val)}
          />
        </div>

        <ColorInput
          label="Shadow Color"
          value={(settings.shadowColor as string) || "rgba(0,0,0,0.8)"}
          onUpdate={(val) => update("shadowColor", val)}
        />

        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] text-slate-500">
              Blur
            </label>
            <ScrubInput
              label="B"
              value={(settings.shadowBlur as number) || 0}
              min={0}
              max={50}
              onUpdate={(val) => update("shadowBlur", val)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] text-slate-500">
              Offset X
            </label>
            <ScrubInput
              label="OX"
              value={(settings.shadowOffsetX as number) || 0}
              onUpdate={(val) => update("shadowOffsetX", val)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] text-slate-500">
              Offset Y
            </label>
            <ScrubInput
              label="OY"
              value={(settings.shadowOffsetY as number) || 0}
              onUpdate={(val) => update("shadowOffsetY", val)}
            />
          </div>
        </div>
      </div>

      {/* Background */}
      <div className="mt-6 border-t border-slate-800/50 pt-4">
        <h4 className="mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          Background Box
        </h4>
        <ColorInput
          label="BG Color (use transparent for none)"
          value={(settings.bgColor as string) || "transparent"}
          onUpdate={(val) => update("bgColor", val)}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] text-slate-500">
              Padding
            </label>
            <ScrubInput
              label="P"
              value={(settings.bgPadding as number) || 10}
              min={0}
              max={100}
              onUpdate={(val) => update("bgPadding", val)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] text-slate-500">
              Radius
            </label>
            <ScrubInput
              label="R"
              value={(settings.bgRadius as number) || 8}
              min={0}
              max={50}
              onUpdate={(val) => update("bgRadius", val)}
            />
          </div>
        </div>
      </div>

      {/* Text Effects (hidden in thumbnail mode) */}
      {!isThumbnailMode && (
        <div className="mt-6 border-t border-slate-800/50 pt-4">
          <h4 className="mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            Text Effects
          </h4>

          {/* Effect Selector */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[10px] text-slate-500">
              Effect Type
            </label>
            <div className="relative">
              <select
                className="w-full cursor-pointer appearance-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors outline-none hover:bg-slate-700/50 focus:border-blue-500/50"
                onChange={(e) => update("textEffect", e.target.value)}
                value={(settings.textEffect as string) || "none"}
              >
                <option value="none">None</option>
                <option value="typewriter">Typewriter</option>
                <option value="wavy">Wavy</option>
              </select>
              <i className="pointer-events-none absolute top-1/2 right-2 icon-[ri--arrow-down-s-line] -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Typewriter Settings */}
          {settings.textEffect === "typewriter" && (
            <>
              <div className="mb-3">
                <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>Typing Speed</span>
                  <span className="font-mono text-[10px] text-blue-400">
                    {`${(settings.typewriterSpeed as number) || 15} char/s`}
                  </span>
                </label>
                <ScrubInput
                  label="Speed"
                  value={(settings.typewriterSpeed as number) || 15}
                  min={1}
                  max={100}
                  onUpdate={(val) => update("typewriterSpeed", val)}
                />
              </div>
              <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 p-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-300">
                    Type Out (Backspace)
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Backspace at the end of the clip
                  </span>
                </div>
                <button
                  className={`relative h-4 w-8 rounded-full transition-colors ${
                    settings.typewriterOut !== false
                      ? "bg-blue-600"
                      : "bg-slate-700"
                  }`}
                  onClick={() =>
                    update(
                      "typewriterOut",
                      settings.typewriterOut === false ? true : false,
                    )
                  }
                >
                  <div
                    className={`absolute top-0.5 bottom-0.5 w-3 rounded-full bg-white transition-all ${
                      settings.typewriterOut !== false
                        ? "right-0.5"
                        : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </>
          )}

          {/* Wavy Text Settings */}
          {settings.textEffect === "wavy" && (
            <>
              <div className="mb-3">
                <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>Wave Amplitude</span>
                  <span className="font-mono text-[10px] text-blue-400">
                    {`${settings.wavyAmplitude !== undefined ? settings.wavyAmplitude : 6} px`}
                  </span>
                </label>
                <ScrubInput
                  label="Amp"
                  value={
                    settings.wavyAmplitude !== undefined
                      ? (settings.wavyAmplitude as number)
                      : 6
                  }
                  min={0}
                  max={50}
                  onUpdate={(val) => update("wavyAmplitude", val)}
                />
              </div>
              <div className="mb-3">
                <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>Wave Speed</span>
                  <span className="font-mono text-[10px] text-blue-400">
                    {`${settings.wavyFrequency !== undefined ? settings.wavyFrequency : 4} Hz`}
                  </span>
                </label>
                <ScrubInput
                  label="Speed"
                  value={
                    settings.wavyFrequency !== undefined
                      ? (settings.wavyFrequency as number)
                      : 4
                  }
                  step={0.1}
                  min={0.1}
                  max={20}
                  onUpdate={(val) => update("wavyFrequency", val)}
                />
              </div>
              <div className="mb-3">
                <label className="mb-1.5 flex justify-between text-[10px] text-slate-500">
                  <span>Wave Letter Spacing</span>
                  <span className="font-mono text-[10px] text-blue-400">
                    {`${settings.wavySpacing !== undefined ? settings.wavySpacing : 0.15}`}
                  </span>
                </label>
                <ScrubInput
                  label="Spacing"
                  value={
                    settings.wavySpacing !== undefined
                      ? (settings.wavySpacing as number)
                      : 0.15
                  }
                  step={0.01}
                  min={0}
                  max={2}
                  onUpdate={(val) => update("wavySpacing", val)}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Position / scale / rotation editor, shared by nearly every clip renderer. */
export const SharedTransformSettingsView = ({
  settings,
  updateSettings,
}: SharedSettingsProps) => {
  if (!settings) return null;

  const update = (key: string, val: unknown) => updateSettings({ [key]: val });

  return (
    <div className="mt-6 border-t border-slate-800/50 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
          Transform
        </h4>
        <button
          className="flex items-center gap-1 text-[9px] text-slate-500 transition-colors hover:text-blue-400"
          onClick={() =>
            updateSettings({
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
            })
          }
        >
          <i className="icon-[ri--restart-line] h-2.5 w-2.5" />
          Reset
        </button>
      </div>

      {/* Row 1: Position */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <ScrubInput
          label="X"
          value={(settings.x as number) || 0}
          step={1}
          onUpdate={(val) => update("x", val)}
        />
        <ScrubInput
          label="Y"
          value={(settings.y as number) || 0}
          step={1}
          onUpdate={(val) => update("y", val)}
        />
      </div>

      {/* Uniform Size/Scale Slider */}
      <div className="mt-1 mb-3 rounded border border-slate-800/40 bg-slate-950/20 p-2.5">
        <label className="mb-1.5 flex justify-between text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          <span>Uniform Size / Scale</span>
          <span className="font-mono text-[10px] text-blue-400">{`${Math.round((settings.scaleX ?? 1) * 100)}%`}</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.05}
            max={5}
            step={0.05}
            value={settings.scaleX ?? 1}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateSettings({ scaleX: val, scaleY: val });
            }}
          />
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            title="Reset Scale"
            onClick={() => updateSettings({ scaleX: 1, scaleY: 1 })}
          >
            <i className="icon-[ri--aspect-ratio-line] h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Row 2: Scale */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        <ScrubInput
          label="SX"
          value={(settings.scaleX as number) || 1}
          step={0.01}
          min={0.01}
          max={10}
          onUpdate={(val) => update("scaleX", val)}
        />
        <ScrubInput
          label="SY"
          value={(settings.scaleY as number) || 1}
          step={0.01}
          min={0.01}
          max={10}
          onUpdate={(val) => update("scaleY", val)}
        />
      </div>

      {/* Row 3: Rotation */}
      <div className="w-full">
        <ScrubInput
          label="R"
          value={(settings.rotation as number) || 0}
          step={1}
          onUpdate={(val) => update("rotation", val)}
        />
      </div>
    </div>
  );
};

/** In/out/loop animation presets + audio-reactive toggle editor. */
export const SharedAnimationSettingsView = ({
  settings,
  updateSettings,
}: SharedSettingsProps) => {
  // Ensure the animations object exists so defaults are readable before any edit.
  useEffect(() => {
    if (settings && !settings.animations) {
      updateSettings({
        animations: { inType: "fade", outType: "fade", type: "none" },
      });
    }
  });

  if (!settings || !settings.animations) return null;

  const animations = settings.animations as Record<string, any>;
  const update = (key: string, val: unknown) =>
    updateSettings({ animations: { ...animations, [key]: val } });

  return (
    <div className="mt-6 border-t border-slate-800/50 pt-4">
      <h4 className="mb-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
        Animations
      </h4>

      {/* In/Out Presets */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] text-slate-500">
            In Effect
          </label>
          <select
            className="h-7 w-full rounded border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300 outline-none"
            onChange={(e) => update("inType", e.target.value)}
            value={animations.inType}
          >
            {[
              "none",
              "fade",
              "slide-up",
              "slide-down",
              "zoom-in",
              "bounce",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] text-slate-500">
            Out Effect
          </label>
          <select
            className="h-7 w-full rounded border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300 outline-none"
            onChange={(e) => update("outType", e.target.value)}
            value={animations.outType}
          >
            {["none", "fade", "slide-up", "slide-down", "zoom-out"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Continuous Animation */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[10px] text-slate-500">
          Continuous Loop
        </label>
        <select
          className="h-7 w-full rounded border border-slate-700 bg-slate-800 px-2 text-[10px] text-slate-300 outline-none"
          onChange={(e) => update("type", e.target.value)}
          value={animations.type}
        >
          {["none", "pulse", "float", "shake", "swing"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Audio Reactive Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-300">
            Audio Reactive
          </span>
          <span className="text-[9px] text-slate-500">
            Sync effect to music beat
          </span>
        </div>
        <button
          className={`relative h-4 w-8 rounded-full transition-colors ${
            animations.audioReactive ? "bg-blue-600" : "bg-slate-700"
          }`}
          onClick={() => update("audioReactive", !animations.audioReactive)}
        >
          <div
            className={`absolute top-0.5 bottom-0.5 w-3 rounded-full bg-white transition-all ${
              animations.audioReactive ? "right-0.5" : "left-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
};
