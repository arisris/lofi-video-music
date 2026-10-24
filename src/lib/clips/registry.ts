import { editorStore } from "../../store/editor-store";
import type { ClipRegistryEntry } from "../../types/clips";

export const ClipRegistry = {
  clips: [] as ClipRegistryEntry[],

  register(clip: ClipRegistryEntry) {
    if (this.clips.some((c) => c.id === clip.id)) {
      // Update existing clip reference
      const idx = this.clips.findIndex((c) => c.id === clip.id);
      this.clips[idx] = clip;
    } else {
      this.clips.push(clip);
    }

    const isDefaultDisabled = clip.id === "title" || clip.id === "playlist";
    const defaultTransform = {
      enabled: !isDefaultDisabled,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      originX: 0.5,
      originY: 0.5,
    };

    // Initialize settings if not already in state
    const state = editorStore.getState();
    const existing = state.clipSettings[clip.id];

    let nextSettings: Record<string, unknown>;
    if (!existing) {
      nextSettings = { ...defaultTransform, ...clip.settings };
      if (isDefaultDisabled) {
        nextSettings.enabled = false;
      }
    } else if (existing.enabled === undefined) {
      // Backfill enabled flag for existing settings (e.g. from HMR)
      nextSettings = { ...existing, enabled: !isDefaultDisabled };
    } else {
      nextSettings = existing;
    }

    if (nextSettings !== existing) {
      editorStore.setState({
        clipSettings: { ...state.clipSettings, [clip.id]: nextSettings },
      });
    }

    // Bind settings to the clip object for easy access (compatibility)
    clip.settings = editorStore.getState().clipSettings[clip.id];
  },

  clear() {
    this.clips = [];
    editorStore.setState({ clipSettings: {} });
  },

  get(id: string): ClipRegistryEntry | undefined {
    return this.clips.find((c) => c.id === id);
  },

  getAll(): ClipRegistryEntry[] {
    return this.clips;
  },
};
