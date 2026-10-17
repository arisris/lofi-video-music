import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";
import type { CanvasSnap, DragPivot, SnapLine } from "../../types/clips";

/** Transient canvas interaction state (dragging, transforms, snapping). */
export interface InteractionSlice {
  isDragging: boolean;
  startDragX: number;
  startDragY: number;
  initialOffsetX: number;
  initialOffsetY: number;

  /** Rotation/scale drag anchor. */
  dragPivot: DragPivot | null;
  initialDragDistance: number;
  initialDragAngle: number;
  initialScaleX: number;
  initialScaleY: number;
  initialRotation: number;

  /** Cursor override while dragging (null = default). */
  canvasCursor: string | null;
  transformMode: string;
  interactionMode: string;

  snapLines: SnapLine[];
  canvasSnaps: CanvasSnap[];
  staticSnapTargetsX: number[] | null;
  staticSnapTargetsY: number[] | null;
}

export const createInteractionSlice: StateCreator<EditorStore, [], [], InteractionSlice> = () => ({
  isDragging: false,
  startDragX: 0,
  startDragY: 0,
  initialOffsetX: 0,
  initialOffsetY: 0,

  dragPivot: null,
  initialDragDistance: 0,
  initialDragAngle: 0,
  initialScaleX: 1,
  initialScaleY: 1,
  initialRotation: 0,

  canvasCursor: null,
  transformMode: "translate",
  interactionMode: "select",

  snapLines: [],
  canvasSnaps: [],
  staticSnapTargetsX: null,
  staticSnapTargetsY: null,
});
