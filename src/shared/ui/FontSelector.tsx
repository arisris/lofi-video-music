// Reusable font picker — GoogleFontsList + lazy-load of the selected font.
// Used by TypographySettings and every inspector that needs a font family.
// Built on top of SelectControl for a consistent look with other selects.
import { GoogleFontsList, loadGoogleFont } from "../lib/fonts";
import { SelectControl } from "./Select";

export function FontSelector({
  label = "Font Family",
  value,
  onUpdate,
}: {
  label?: string;
  value: string;
  onUpdate: (value: string) => void;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 flex justify-between text-[10px] text-neutral-500">
        <span>{label}</span>
      </label>
      <SelectControl
        value={value}
        options={GoogleFontsList.map((f) => ({
          value: f,
          label: f.replace(/'/g, ""),
        }))}
        onChange={(v) => {
          loadGoogleFont(v);
          onUpdate(v);
        }}
        size="md"
        optionStyle={(v) => ({
          fontFamily: v,
          padding: "10px",
          background: "#1e293b",
        })}
        ariaLabel={label}
      />
    </div>
  );
}
