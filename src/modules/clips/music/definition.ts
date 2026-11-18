import type { ClipDefinition } from "../../../shared/types/clip";

// Full music settings
// (file picker + duration info follow in MusicSettingsView).
export const musicClip: ClipDefinition = {
  type: "music",
  name: "Music",
  icon: "mdi:music",
  defaultDuration: 30,
  defaultSettings: {
    audioUrl: "",
    audioDuration: 0,
    name: "Music",
    volume: 1,
    playbackRate: 1,
    pan: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    startOffset: 0,
  },
  schema: [
    {
      key: "audioUrl",
      label: "Audio URL",
      kind: "text",
      placeholder: "https://… / blob:…",
    },
    {
      key: "volume",
      label: "Volume",
      kind: "slider",
      min: 0,
      max: 2,
      step: 0.01,
    },
    {
      key: "playbackRate",
      label: "Speed",
      kind: "slider",
      min: 0.5,
      max: 1.5,
      step: 0.05,
    },
    { key: "pan", label: "Pan", kind: "slider", min: -1, max: 1, step: 0.1 },
    { key: "startOffset", label: "Start offset (s)", kind: "number" },
  ],
  draw() {},
};
