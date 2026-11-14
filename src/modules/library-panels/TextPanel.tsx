import { useEffect } from "react";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import { loadGoogleFont } from "../../shared/lib/fonts";
import { TEXT_TEMPLATES, type TextTemplate } from "../../shared/lib/text-templates";
import { addClipOfType } from "../dock/clip-actions";

const addTemplateText = (template: TextTemplate) => {
  addClipOfType("text", { ...template.settings, content: "Tap to Edit" });
};

const addDefaultText = () => {
  addClipOfType("text", { content: "New Text" });
};

export const TextPanel = () => {
  useEffect(() => {
    TEXT_TEMPLATES.forEach((t) => loadGoogleFont(t.settings.fontFamily as string));
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900/50 p-4">
      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="space-y-4">
          <SectionTitle className="mb-1">
            Add Text
            </SectionTitle>
          <button
            className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 p-3 transition-all hover:border-blue-500/50 hover:bg-blue-600/30"
            onClick={addDefaultText}
          >
            <i className="icon-[ri--text-spacing] h-4.5 w-4.5 text-blue-400" />
            <span className="text-xs font-bold text-neutral-200">Add Default Text</span>
          </button>
        </div>

        <div className="space-y-4">
          <SectionTitle className="mb-1">
            Text Templates
            </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {TEXT_TEMPLATES.map((t) => (
              <button
                key={t.name}
                className="hover:bg-neutral-850 group flex min-h-22.5 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-neutral-700/50 bg-neutral-800/40 p-4 text-center transition-all hover:scale-[1.02] hover:border-neutral-600"
                onClick={() => addTemplateText(t)}
              >
                <div
                  ref={(el) => {
                    if (el) el.style.cssText = t.cssStyle;
                  }}
                  className="flex h-10 w-full items-center justify-center overflow-hidden text-center text-xs leading-none"
                >
                  {t.name}
                </div>
                <span className="text-[9px] font-medium tracking-wider text-neutral-400 uppercase transition-colors group-hover:text-neutral-200">
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
