import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";

/** Window/panel layout state. */
export interface LayoutSlice {
  aspectRatio: string;
  mediaPoolWidth: number;
  inspectorWidth: number;
  leftPanelCollapsed: boolean;
}

/** Default sidebar width, in pixels. */
const initialPanelWidth = (min: number, ratio: number): number =>
  typeof window !== "undefined" ? Math.max(min, Math.floor(window.innerWidth * ratio)) : min;

export const createLayoutSlice: StateCreator<EditorStore, [], [], LayoutSlice> = () => ({
  aspectRatio: "16:9",
  mediaPoolWidth: initialPanelWidth(300, 0.22),
  inspectorWidth: initialPanelWidth(320, 0.22),
  leftPanelCollapsed: false,
});
