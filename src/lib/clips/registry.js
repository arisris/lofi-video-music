import { State } from "../state";

export const ClipRegistry = {
  clips: [],

  register(clip) {
    if (this.clips.some(c => c.id === clip.id)) {
      // Update existing clip reference
      const idx = this.clips.findIndex(c => c.id === clip.id);
      this.clips[idx] = clip;
    } else {
      this.clips.push(clip);
    }

    const isDefaultDisabled = (clip.id === "title" || clip.id === "playlist");
    const defaultTransform = {
      enabled: !isDefaultDisabled,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      originX: 0.5,
      originY: 0.5
    };

    // Initialize settings if not already in state
    if (!State.clipSettings[clip.id]) {
      State.clipSettings[clip.id] = { ...defaultTransform, ...clip.settings };
      if (isDefaultDisabled) {
        State.clipSettings[clip.id].enabled = false;
      }
    } else if (State.clipSettings[clip.id].enabled === undefined) {
      // Backfill enabled flag for existing settings (e.g. from HMR)
      State.clipSettings[clip.id].enabled = !isDefaultDisabled;
    }
    
    // Bind settings to the clip object for easy access (compatibility)
    clip.settings = State.clipSettings[clip.id];
  },

  clear() {
    this.clips = [];
  },

  get(id) {
    return this.clips.find(c => c.id === id);
  },

  getAll() {
    return this.clips;
  }
};
