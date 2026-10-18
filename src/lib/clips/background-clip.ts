
import { BackgroundSettingsView } from "../../components/clip-settings/background";

export const triggerFilePicker = (onSelect: (file: File) => void) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files![0];
    if (file) {
      onSelect(file);
    }
  };
  input.click();
};

export const BackgroundClip = {
  id: "background",
  name: "Background",
  icon: "icon-[ri--image-line]",

  settings: {},

  getItemBoundingBox(_ctx: CanvasRenderingContext2D, w: number, h: number, _settings: Record<string, any>) {
    return {
      x: 0,
      y: 0,
      width: w,
      height: h,
    };
  },

  drawItem(_ctx: CanvasRenderingContext2D, _w: number, _h: number, _settings: Record<string, any>) {},

  onSettings: BackgroundSettingsView,
};
