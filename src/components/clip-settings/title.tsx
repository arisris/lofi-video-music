import { editorStore } from "../../store/editor-store";
import { updateClipSettings } from "../../store/actions/clip-settings";
import { SharedTextSettingsView, SharedTransformSettingsView } from "./shared";

/** Settings panel for the global "title" overlay layer. */
export const TitleSettingsView = (_props: { clip?: Record<string, any> }) => {
  const settings = editorStore.getState().clipSettings["title"] as
    Record<string, any> | undefined;

  if (!settings) return null;

  const update = (patch: Record<string, unknown>) =>
    updateClipSettings("title", patch);

  return (
    <>
      <SharedTextSettingsView settings={settings} updateSettings={update} />
      <SharedTransformSettingsView
        settings={settings}
        updateSettings={update}
      />
    </>
  );
};
