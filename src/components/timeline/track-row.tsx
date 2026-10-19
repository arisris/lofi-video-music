import { memo } from "react";
import { ClipView } from "./clip-view";

const sameClips = (a: any[], b: any[]) =>
  a.length === b.length && a.every((clip, i) => clip === b[i]);

export const TrackRow = memo(
  function TrackRow({
    clips,
    zoom,
    selectedClipId,
  }: {
    clips: any[];
    zoom: number;
    selectedClipId: string | null;
  }) {
    return (
      <div className="relative h-12 border-b border-slate-800/30">
        {clips.map((clip) => (
          <ClipView
            key={clip.id}
            clip={clip}
            zoom={zoom}
            selected={selectedClipId === clip.id}
          />
        ))}
      </div>
    );
  },
  (prev, next) =>
    prev.zoom === next.zoom &&
    prev.selectedClipId === next.selectedClipId &&
    sameClips(prev.clips, next.clips),
);