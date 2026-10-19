import { memo } from "react";
import { beginClipDrag, showContextMenu } from "./drag";

export const ClipView = memo(function ClipView({
  clip,
  zoom,
  selected,
}: {
  clip: any;
  zoom: number;
  selected: boolean;
}) {
  const isDurationLocked =
    clip.type === "overlay" &&
    clip.settings.mediaType === "video" &&
    clip.settings.loop === false;

  const clipClass = selected
    ? clip.type === "music"
      ? "bg-emerald-600/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      : "bg-blue-600/40 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
    : clip.type === "music"
      ? "bg-emerald-800/40 border-emerald-700/50 hover:bg-emerald-800/60 hover:border-emerald-600"
      : "bg-slate-700/60 border-slate-600 hover:bg-slate-700 hover:border-slate-500";

  const isVideo =
    (clip.type === "background" && clip.settings.bgType === "video") ||
    (clip.type === "overlay" && clip.settings.mediaType === "video");
  const videoDuration = clip.settings.videoDuration || 0;
  const speed = clip.settings.speed || 1.0;
  const visualVideoDuration = videoDuration / speed;

  const markers: number[] = [];
  if (
    isVideo &&
    typeof videoDuration === "number" &&
    videoDuration > 0 &&
    typeof visualVideoDuration === "number" &&
    visualVideoDuration > 0.05
  ) {
    const shouldLoop = clip.settings.loop !== false;
    if (shouldLoop) {
      const maxMarkers = 500;
      let count = 0;
      for (
        let time = visualVideoDuration;
        time < clip.duration - 0.05 && count < maxMarkers;
        time += visualVideoDuration
      ) {
        markers.push(time);
        count++;
      }
    } else if (visualVideoDuration < clip.duration - 0.05) {
      markers.push(visualVideoDuration);
    }
  }

  return (
    <div
      className={`absolute top-2 bottom-2 rounded border transition-colors ${clipClass}`}
      style={{
        left: `${clip.start * zoom}px`,
        width: `${clip.duration * zoom}px`,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e, clip.id);
      }}
      onMouseDown={(e) => beginClipDrag(e, clip, "move")}
    >
      {markers.map((time) => (
        <div
          key={`marker-${time}`}
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-px border-l border-dashed border-cyan-400/60"
          style={{ left: `${time * zoom}px` }}
        />
      ))}
      {!isDurationLocked && (
        <div
          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize rounded-l transition-colors hover:bg-blue-400/50"
          onMouseDown={(e) => beginClipDrag(e, clip, "resize-start")}
        />
      )}
      {!isDurationLocked && (
        <div
          className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize rounded-r transition-colors hover:bg-blue-400/50"
          onMouseDown={(e) => beginClipDrag(e, clip, "resize-end")}
        />
      )}
      <div className="pointer-events-none flex h-full w-full items-center gap-2 overflow-hidden px-2">
        {clip.type === "music" ? (
          <i className="icon-[ri--music-2-line] h-3 w-3 shrink-0 text-emerald-400" />
        ) : (clip.type === "background" || clip.type === "overlay") &&
          clip.settings?.thumbnail ? (
          <img
            src={clip.settings.thumbnail}
            className="h-4 w-4 shrink-0 rounded border border-slate-600 object-cover"
          />
        ) : (
          <i
            className={`${
              clip.type === "text"
                ? "icon-[ri--text-spacing]"
                : clip.type === "visualizer"
                  ? "icon-[ri--pulse-line]"
                  : clip.type === "glviz"
                    ? "icon-[ri--shapes-line]"
                    : "icon-[ri--image-line]"
            } h-3 w-3 shrink-0 text-slate-300`}
          />
        )}
        <span className="truncate text-[9px] font-medium text-white">
          {clip.type === "music"
            ? clip.settings?.name || "Music"
            : clip.type === "background" || clip.type === "overlay"
              ? clip.settings?.fileName ||
                (clip.type === "background" ? "Background" : "Overlay")
              : clip.type === "visualizer"
                ? `Visualizer (${clip.settings?.style || "bars"})`
                : clip.type === "glviz"
                  ? `Shader (${clip.settings?.style || "bars"})`
                  : clip.settings?.content || clip.type}
        </span>
      </div>
    </div>
  );
});