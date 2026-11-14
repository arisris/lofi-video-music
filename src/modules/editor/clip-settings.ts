import type { ClipType } from "../../shared/types/clip";
import { BackgroundSettingsView } from "./clip-views/BackgroundSettings";
import { GlvizSettingsView } from "./clip-views/GlvizSettings";
import { MusicSettingsView } from "./clip-views/MusicSettings";
import { OverlaySettingsView } from "./clip-views/OverlaySettings";
import { PlaylistSettingsView } from "./clip-views/PlaylistSettings";
import { ShapeSettingsView } from "./clip-views/ShapeSettings";
import { TextSettingsView, TitleSettingsView } from "./clip-views/TextSettings";

export type SettingsViewProps = { clipId: string };
export type SettingsViewComponent = (
  props: SettingsViewProps,
) => React.JSX.Element | null;

/**
 * Single wiring table for clip inspectors.
 * Clip definitions stay pure (draw + schema in `.ts`); React panels live here.
 * VFX + lyrics fall through to the schema-driven DefaultSettingsView.
 */
const SETTINGS_VIEWS: Partial<Record<ClipType, SettingsViewComponent>> = {
  text: TextSettingsView,
  title: TitleSettingsView,
  background: BackgroundSettingsView,
  overlay: OverlaySettingsView,
  shape: ShapeSettingsView,
  music: MusicSettingsView,
  playlist: PlaylistSettingsView,
  glviz: GlvizSettingsView,
};

export function getSettingsView(type: ClipType): SettingsViewComponent | null {
  return SETTINGS_VIEWS[type] ?? null;
}
