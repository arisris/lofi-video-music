import { useRef, useState } from "react";
import { State } from "../../lib/state";
import { getIconFromDb } from "../../utils/indexed-db";
import {
  SharedAnimationSettingsView,
  SharedTransformSettingsView,
  useThumbnailMode,
} from "./shared";
import { updateTimelineClipSettings } from "../../store/actions/timeline-actions";
import { ColorInput } from "../ui/color-input";
import { ScrubInput } from "../ui/scrub-input";

interface ClipViewProps {
  clip?: Record<string, any>;
}

const SHAPE_TYPES: { id: string; label: string; icon: string }[] = [
  { id: "rectangle", label: "Rect", icon: "icon-[ri--rectangle-line]" },
  { id: "circle", label: "Circle", icon: "icon-[ri--checkbox-blank-circle-line]" },
  { id: "triangle", label: "Triangle", icon: "icon-[ri--triangle-line]" },
  { id: "star", label: "Star", icon: "icon-[ri--star-line]" },
  { id: "polygon", label: "Polygon", icon: "icon-[ri--hexagon-line]" },
  { id: "heart", label: "Heart", icon: "icon-[ri--heart-line]" },
  { id: "icon", label: "Icon", icon: "icon-[ri--emotion-line]" },
];

/** Async inline icon preview, mirrors the legacy IconPreviewInline helper. */
const IconPreviewInline = ({ iconName }: { iconName: string }) => {
  const [svgText, setSvgText] = useState("");
  const loadedName = useRef("");

  if (loadedName.current !== iconName) {
    loadedName.current = iconName;
    getIconFromDb(iconName).then((data) => {
      setSvgText(
        data
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${data.width} ${data.height}" class="w-4.5 h-4.5 text-slate-350" fill="currentColor">${data.body}</svg>`
          : "",
      );
    });
  }

  if (!svgText) return <i className="icon-[ri--image-line] text-slate-600 w-4 h-4" />;

  /* eslint-disable-next-line react/no-danger */
  return <span dangerouslySetInnerHTML={{ __html: svgText }} />;
};

/** Settings panel for the "shape" timeline clip. */
export const ShapeSettingsView = ({ clip }: ClipViewProps) => {
  const isThumbnailMode = useThumbnailMode();
  const selectedClip =
    clip || State.timelineClips.find((c: any) => c.id === State.selectedClipId && c.type === "shape");

  if (!selectedClip) {
    return <div className="text-slate-500 text-xs italic text-center py-8">Select a shape to change settings</div>;
  }

  const settings = selectedClip.settings as Record<string, any>;

  const update = (patch: Record<string, unknown>) =>
    updateTimelineClipSettings(selectedClip.id as string, patch);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* 1. Shape Type Selection */}
      <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-3">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Shape Type</label>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPE_TYPES.map((shape) => {
            const isActive = settings.shapeType === shape.id;
            return (
              <button
                key={shape.id}
                className={`py-1.5 px-1 rounded flex flex-col items-center gap-1 border text-[9px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-slate-900/45 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
                onClick={() => update({ shapeType: shape.id })}
              >
                <i className={`${shape.icon} w-3.5 h-3.5`} />
                {shape.label}
              </button>
            );
          })}
        </div>

        {/* Shape Specific Parameters */}
        {settings.shapeType === "rectangle" && (
          <div className="mt-3">
            <label className="block text-[10px] text-slate-500 mb-1.5">Corner Radius</label>
            <ScrubInput
              label="R"
              value={settings.cornerRadius || 0}
              min={0}
              max={100}
              onUpdate={(val) => update({ cornerRadius: val })}
            />
          </div>
        )}

        {settings.shapeType === "star" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5">Spikes</label>
              <ScrubInput
                label="S"
                value={settings.starSpikes || 5}
                min={3}
                max={30}
                onUpdate={(val) => update({ starSpikes: Math.round(val) })}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5">Inner Ratio</label>
              <ScrubInput
                label="IR"
                value={settings.starInnerRatio || 0.4}
                step={0.05}
                min={0.1}
                max={0.9}
                onUpdate={(val) => update({ starInnerRatio: val })}
              />
            </div>
          </div>
        )}

        {settings.shapeType === "polygon" && (
          <div className="mt-3">
            <label className="block text-[10px] text-slate-500 mb-1.5">Sides</label>
            <ScrubInput
              label="S"
              value={settings.polygonSides || 6}
              min={3}
              max={20}
              onUpdate={(val) => update({ polygonSides: Math.round(val) })}
            />
          </div>
        )}

        {settings.shapeType === "icon" && (
          <div className="mt-3 space-y-2">
            <label className="block text-[10px] text-slate-500 mb-1">Icon ID</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 bg-slate-900 border border-slate-700/60 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                value={settings.iconName || ""}
                onChange={(e) => update({ iconName: e.target.value })}
              />
              <div className="w-8 h-8 rounded border border-slate-800 bg-slate-950 flex items-center justify-center shrink-0">
                {settings.iconName ? <IconPreviewInline iconName={settings.iconName} /> : null}
              </div>
            </div>
            <p className="text-[9px] text-slate-500">Format: prefix:name (e.g. ri:music-2-fill or mdi:laptop)</p>
          </div>
        )}
      </div>

      {/* 2. Color & Fill Settings */}
      <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fill Settings</label>
          <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800">
            <button
              className={`px-2 py-0.5 text-[9px] font-semibold rounded cursor-pointer transition-all ${
                settings.fillType !== "gradient"
                  ? "bg-slate-800 text-slate-200"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => update({ fillType: "solid" })}
            >
              Solid
            </button>
            <button
              className={`px-2 py-0.5 text-[9px] font-semibold rounded cursor-pointer transition-all ${
                settings.fillType === "gradient"
                  ? "bg-slate-800 text-slate-200"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => update({ fillType: "gradient" })}
            >
              Gradient
            </button>
          </div>
        </div>

        <ColorInput
          label={settings.fillType === "gradient" ? "Start Color" : "Fill Color"}
          value={settings.fillColor || "#3b82f6"}
          onUpdate={(val) => update({ fillColor: val })}
        />

        {settings.fillType === "gradient" && (
          <ColorInput
            label="End Color"
            value={settings.fillColor2 || "#8b5cf6"}
            onUpdate={(val) => update({ fillColor2: val })}
          />
        )}
      </div>

      {/* 3. Size Settings */}
      <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-3">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dimensions</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5">Width</label>
            <ScrubInput
              label="W"
              value={settings.width || 150}
              min={10}
              max={2000}
              onUpdate={(val) => update({ width: val })}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5">Height</label>
            <ScrubInput
              label="H"
              value={settings.height || 150}
              min={10}
              max={2000}
              onUpdate={(val) => update({ height: val })}
            />
          </div>
        </div>
      </div>

      {/* 4. Stroke & Shadow */}
      <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 space-y-4">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stroke &amp; Shadow</h4>

        <ColorInput
          label="Stroke Color"
          value={settings.strokeColor || "#ffffff"}
          onUpdate={(val) => update({ strokeColor: val })}
        />

        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5">Stroke Width</label>
          <ScrubInput
            label="SW"
            value={settings.strokeWidth || 0}
            min={0}
            max={50}
            onUpdate={(val) => update({ strokeWidth: val })}
          />
        </div>

        <ColorInput
          label="Shadow Color"
          value={settings.shadowColor || "rgba(0,0,0,0.5)"}
          onUpdate={(val) => update({ shadowColor: val })}
        />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5">Blur</label>
            <ScrubInput
              label="B"
              value={settings.shadowBlur || 0}
              min={0}
              max={50}
              onUpdate={(val) => update({ shadowBlur: val })}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5">Offset X</label>
            <ScrubInput
              label="OX"
              value={settings.shadowOffsetX || 0}
              onUpdate={(val) => update({ shadowOffsetX: val })}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1.5">Offset Y</label>
            <ScrubInput
              label="OY"
              value={settings.shadowOffsetY || 0}
              onUpdate={(val) => update({ shadowOffsetY: val })}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 mb-1.5 flex justify-between">
            <span>Opacity</span>
            <span className="text-blue-400 font-mono text-[10px]">
              {`${Math.round((settings.opacity !== undefined ? settings.opacity : 1.0) * 100)}%`}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.opacity !== undefined ? settings.opacity : 1.0}
            className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-800 rounded-full appearance-none"
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <SharedTransformSettingsView settings={settings} updateSettings={update} />
      {!isThumbnailMode && <SharedAnimationSettingsView settings={settings} updateSettings={update} />}
    </div>
  );
};
