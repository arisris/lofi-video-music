import type { FieldSchema } from "../../../shared/types/clip";

/** Persistent per-layer particle stash (replaces `clip.drops` etc). */
export type VfxState = Record<string, unknown>;

export interface VfxDrawArgs {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  settings: Record<string, unknown>;
  time: number;
  state: VfxState;
}

export interface VfxDefinition {
  type: string;
  name: string;
  /** Iconify class, same convention as clips (used by library panel + timeline). */
  icon: string;
  defaultSettings: Record<string, unknown>;
  schema: FieldSchema[];
  draw: (args: VfxDrawArgs) => void;
}
