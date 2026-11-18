// Shape clip inspector
// shape type grid + conditional params, solid/gradient fill, dimensions,
// stroke & shadow + opacity, then Transform + Animations (animations hidden
// on the thumbnail route like the legacy app).
import { useEffect, useState } from "react";
import { getIconData } from "../../../shared/lib/icon-cache";
import { useEditorStore } from "../../../store/editor-store";
import { useClipSettings } from "../../../shared/hooks/useClipSettings";
import { Card } from "../../../shared/ui/Card";
import { ChoiceGrid } from "../../../shared/ui/ChoiceGrid";
import { ColorInput } from "../../../shared/ui/ColorInput";
import { FieldLabel, SectionTitle } from "../../../shared/ui/FieldLabel";
import { InspectorRoot } from "../../../shared/ui/InspectorRoot";
import { ScrubInput } from "../../../shared/ui/ScrubInput";
import { SegmentedTabs } from "../../../shared/ui/SegmentedTabs";
import { SliderControl } from "../../../shared/ui/SliderControl";
import { AnimationSettings, TransformSettings } from "./TextSettings";

const SHAPE_TYPES: { id: string; label: string; icon: string }[] = [
  { id: "rectangle", label: "Rect", icon: "icon-[ri--rectangle-line]" },
  {
    id: "circle",
    label: "Circle",
    icon: "icon-[ri--checkbox-blank-circle-line]",
  },
  { id: "triangle", label: "Triangle", icon: "icon-[ri--triangle-line]" },
  { id: "star", label: "Star", icon: "icon-[ri--star-line]" },
  { id: "polygon", label: "Polygon", icon: "icon-[ri--hexagon-line]" },
  { id: "heart", label: "Heart", icon: "icon-[ri--heart-line]" },
  { id: "icon", label: "Icon", icon: "icon-[ri--emotion-line]" },
];

function IconPreviewInline({ iconName }: { iconName: string }) {
  const [svgText, setSvgText] = useState("");
  useEffect(() => {
    let alive = true;
    (getIconData(iconName) as Promise<unknown>).then((data: unknown) => {
      if (!alive) return;
      const d = data as { body: string; width: number; height: number } | null;
      setSvgText(
        d
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.width} ${d.height}" class="w-4.5 h-4.5 text-neutral-350" fill="currentColor">${d.body}</svg>`
          : "",
      );
    });
    return () => {
      alive = false;
    };
  }, [iconName]);

  if (!svgText)
    return <i className="icon-[ri--image-line] h-4 w-4 text-neutral-600" />;
  return <span dangerouslySetInnerHTML={{ __html: svgText }} />;
}

export function ShapeSettingsView({ clipId }: { clipId: string }) {
  const { values, set } = useClipSettings(clipId);
  const isThumbnailMode = useEditorStore((s) => s.route) === "/image";
  const shapeType =
    typeof values.shapeType === "string" ? values.shapeType : "rectangle";
  const fillType =
    typeof values.fillType === "string" ? values.fillType : "solid";
  const opacity = typeof values.opacity === "number" ? values.opacity : 1.0;

  return (
    <InspectorRoot>
      <Card title="Shape Type" spacing="sm">
        <ChoiceGrid
          tone="card"
          columns={4}
          options={SHAPE_TYPES.map((shape) => ({
            value: shape.id,
            label: shape.label,
            icon: shape.icon,
          }))}
          value={shapeType}
          onChange={(v) => set("shapeType", v)}
        />

        {shapeType === "rectangle" && (
          <div className="mt-3">
            <FieldLabel>Corner Radius</FieldLabel>
            <ScrubInput
              label="R"
              value={
                typeof values.cornerRadius === "number"
                  ? values.cornerRadius
                  : 0
              }
              min={0}
              max={100}
              onUpdate={(val) => set("cornerRadius", val)}
            />
          </div>
        )}

        {shapeType === "star" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Spikes</FieldLabel>
              <ScrubInput
                label="S"
                value={
                  typeof values.starSpikes === "number" ? values.starSpikes : 5
                }
                min={3}
                max={30}
                onUpdate={(val) => set("starSpikes", Math.round(val))}
              />
            </div>
            <div>
              <FieldLabel>Inner Ratio</FieldLabel>
              <ScrubInput
                label="IR"
                value={
                  typeof values.starInnerRatio === "number"
                    ? values.starInnerRatio
                    : 0.4
                }
                step={0.05}
                min={0.1}
                max={0.9}
                onUpdate={(val) => set("starInnerRatio", val)}
              />
            </div>
          </div>
        )}

        {shapeType === "polygon" && (
          <div className="mt-3">
            <FieldLabel>Sides</FieldLabel>
            <ScrubInput
              label="S"
              value={
                typeof values.polygonSides === "number"
                  ? values.polygonSides
                  : 6
              }
              min={3}
              max={20}
              onUpdate={(val) => set("polygonSides", Math.round(val))}
            />
          </div>
        )}

        {shapeType === "icon" && (
          <div className="mt-3 space-y-2">
            <FieldLabel className="mb-1">Icon ID</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 rounded border border-neutral-700/60 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-blue-500"
                defaultValue={
                  typeof values.iconName === "string" ? values.iconName : ""
                }
                key={typeof values.iconName === "string" ? values.iconName : ""}
                onBlur={(e) => set("iconName", e.target.value)}
              />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-800 bg-neutral-950">
                {typeof values.iconName === "string" && values.iconName ? (
                  <IconPreviewInline iconName={values.iconName} />
                ) : null}
              </div>
            </div>
            <p className="text-[9px] text-neutral-500">
              Format: prefix:name (e.g. ri:music-2-fill or mdi:laptop)
            </p>
          </div>
        )}
      </Card>

      <Card
        title="Fill Settings"
        spacing="md"
        action={
          <SegmentedTabs
            size="xs"
            options={[
              { value: "solid", label: "Solid" },
              { value: "gradient", label: "Gradient" },
            ]}
            value={fillType}
            onChange={(v) => set("fillType", v)}
          />
        }
      >
        <ColorInput
          label={fillType === "gradient" ? "Start Color" : "Fill Color"}
          value={
            typeof values.fillColor === "string" ? values.fillColor : "#3b82f6"
          }
          onUpdate={(val) => set("fillColor", val)}
        />

        {fillType === "gradient" && (
          <ColorInput
            label="End Color"
            value={
              typeof values.fillColor2 === "string"
                ? values.fillColor2
                : "#8b5cf6"
            }
            onUpdate={(val) => set("fillColor2", val)}
          />
        )}
      </Card>

      <Card title="Dimensions" spacing="sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Width</FieldLabel>
            <ScrubInput
              label="W"
              value={typeof values.width === "number" ? values.width : 150}
              min={10}
              max={2000}
              onUpdate={(val) => set("width", val)}
            />
          </div>
          <div>
            <FieldLabel>Height</FieldLabel>
            <ScrubInput
              label="H"
              value={typeof values.height === "number" ? values.height : 150}
              min={10}
              max={2000}
              onUpdate={(val) => set("height", val)}
            />
          </div>
        </div>
      </Card>

      <Card spacing="md">
        <SectionTitle className="">Stroke &amp; Shadow</SectionTitle>

        <ColorInput
          label="Stroke Color"
          value={
            typeof values.strokeColor === "string"
              ? values.strokeColor
              : "#ffffff"
          }
          onUpdate={(val) => set("strokeColor", val)}
        />

        <div>
          <FieldLabel>Stroke Width</FieldLabel>
          <ScrubInput
            label="SW"
            value={
              typeof values.strokeWidth === "number" ? values.strokeWidth : 0
            }
            min={0}
            max={50}
            onUpdate={(val) => set("strokeWidth", val)}
          />
        </div>

        <ColorInput
          label="Shadow Color"
          value={
            typeof values.shadowColor === "string"
              ? values.shadowColor
              : "rgba(0,0,0,0.5)"
          }
          onUpdate={(val) => set("shadowColor", val)}
        />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel>Blur</FieldLabel>
            <ScrubInput
              label="B"
              value={
                typeof values.shadowBlur === "number" ? values.shadowBlur : 0
              }
              min={0}
              max={50}
              onUpdate={(val) => set("shadowBlur", val)}
            />
          </div>
          <div>
            <FieldLabel>Offset X</FieldLabel>
            <ScrubInput
              label="OX"
              value={
                typeof values.shadowOffsetX === "number"
                  ? values.shadowOffsetX
                  : 0
              }
              onUpdate={(val) => set("shadowOffsetX", val)}
            />
          </div>
          <div>
            <FieldLabel>Offset Y</FieldLabel>
            <ScrubInput
              label="OY"
              value={
                typeof values.shadowOffsetY === "number"
                  ? values.shadowOffsetY
                  : 0
              }
              onUpdate={(val) => set("shadowOffsetY", val)}
            />
          </div>
        </div>

        <SliderControl
          label="Opacity"
          value={opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set("opacity", v)}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Card>

      <TransformSettings clipId={clipId} />
      {!isThumbnailMode && <AnimationSettings clipId={clipId} />}
    </InspectorRoot>
  );
}
