// The single way to read/write a clip instance's settings.
// Guarantees immutable updates -> re-render.
import { useEditorStore } from "../../store/editor-store";

export function useClipSettings(clipId: string) {
  const clip = useEditorStore((s) =>
    s.clips.find((c) => c.id === clipId),
  );
  const update = useEditorStore((s) => s.updateClipSettings);
  return {
    clip,
    values: clip?.settings ?? {},
    set: (key: string, value: unknown) => update(clipId, { [key]: value }),
  };
}
