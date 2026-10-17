import { ClipRegistry } from "./registry";
import { VisualizerClip } from "./vis-main";
import { TextClip } from "./text-clip";
import { PlaylistClip } from "./playlist-clip";
import { TitleClip } from "./title-clip";
import { BackgroundClip } from "./background-clip";
import { OverlayClip } from "./overlay-clip";
import { MusicClip } from "./music-clip";
import { ShapeClip } from "./shape-clip";
import { VFXRegistry } from "../vfx";

// Register all clips
ClipRegistry.register(VisualizerClip);
ClipRegistry.register(TextClip);
ClipRegistry.register(PlaylistClip);
ClipRegistry.register(TitleClip);
ClipRegistry.register(BackgroundClip);
ClipRegistry.register(OverlayClip);
ClipRegistry.register(MusicClip);
ClipRegistry.register(ShapeClip);

// Register VFX clips
VFXRegistry.forEach(vfx => ClipRegistry.register(vfx));

export { ClipRegistry };
