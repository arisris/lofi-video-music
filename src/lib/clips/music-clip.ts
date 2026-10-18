import { MusicSettingsView } from "../../components/clip-settings/music";

export const MusicClip = {
  id: "music",
  name: "Music",
  icon: "icon-[ri--music-2-line]",

  settings: {
    name: "Music",
    audioUrl: "",
    audioDuration: 0,
    volume: 1.0,
    playbackRate: 1.0,
    pan: 0,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    startOffset: 0,
    enabled: true
  },

  drawItem(_ctx: CanvasRenderingContext2D, _w: number, _h: number, _item: Record<string, any>, _localTime = 0, _clip = null) {
    // Music clips are audio-only and do not render on the preview canvas
  },

  onSettings: MusicSettingsView,
};
