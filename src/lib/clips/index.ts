import { ClipRegistry } from "./registry";
import { GlvizClip } from "./glviz-clip";
import { TextClip } from "./text-clip";
import { LyricsClip } from "./lyrics-clip";
import { PlaylistClip } from "./playlist-clip";
import { TitleClip } from "./title-clip";
import { BackgroundClip } from "./background-clip";
import { OverlayClip } from "./overlay-clip";
import { MusicClip } from "./music-clip";
import { ShapeClip } from "./shape-clip";
import { VFXRegistry } from "../vfx";

// Register all clips
ClipRegistry.register(GlvizClip);
ClipRegistry.register(TextClip);
ClipRegistry.register(LyricsClip);
ClipRegistry.register(PlaylistClip);
ClipRegistry.register(TitleClip);
ClipRegistry.register(BackgroundClip);
ClipRegistry.register(OverlayClip);
ClipRegistry.register(MusicClip);
ClipRegistry.register(ShapeClip);

// Register VFX clips
VFXRegistry.forEach((vfx) => ClipRegistry.register(vfx));

export { ClipRegistry };
