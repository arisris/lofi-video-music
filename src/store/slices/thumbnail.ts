import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";
import type { ThumbnailLayer, ThumbnailState } from "../../types/clips";

const DEFAULT_THUMBNAIL_LAYERS: ThumbnailLayer[] = [
  {
    id: "default-text-1",
    type: "text",
    content: "LOFI CHILL VIBES",
    fontFamily: "'Bangers', cursive",
    fontSize: 70,
    textColor: "#ffffff",
    strokeColor: "#f43f5e",
    strokeWidth: 6,
    shadowColor: "#000000",
    shadowBlur: 10,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    x: 640,
    y: 280,
    rotation: -4,
    scale: 1,
    bgPadding: 0,
    bgRadius: 0,
    bgColor: "transparent",
  },
  {
    id: "default-text-2",
    type: "text",
    content: "Late Night Study & Code",
    fontFamily: "'Lexend', sans-serif",
    fontSize: 36,
    textColor: "#ffffff",
    strokeColor: "#0f172a",
    strokeWidth: 4,
    shadowColor: "#000000",
    shadowBlur: 5,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    x: 640,
    y: 380,
    rotation: 0,
    scale: 1,
    bgPadding: 8,
    bgRadius: 8,
    bgColor: "rgba(15, 23, 42, 0.75)",
  },
];

/** Thumbnail editor mode state (direct-composition canvas, not timeline). */
export interface ThumbnailSlice {
  thumbnail: ThumbnailState;
}

export const createThumbnailSlice: StateCreator<
  EditorStore,
  [],
  [],
  ThumbnailSlice
> = () => ({
  thumbnail: {
    layers: DEFAULT_THUMBNAIL_LAYERS.map((l) => ({ ...l })),
    selectedLayerId: "default-text-1",
  },
});
