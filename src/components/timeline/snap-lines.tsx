import { memo } from "react";

export const SnapLines = memo(function SnapLines({
  snapLines,
  zoom,
  scrollLeft,
  scrollTop,
}: {
  snapLines: any[];
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}) {
  return (
    <>
      {snapLines.map((line: any, idx: number) => {
        const snapClass = line.isVideoSnap
          ? "absolute w-px bg-cyan-400/90 z-30 pointer-events-none shadow-[0_0_8px_rgba(34,211,238,0.6)]"
          : "absolute top-0 bottom-0 w-px bg-yellow-400/80 z-30 pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.5)]";

        const style = line.isVideoSnap
          ? {
              left: `${line.time * zoom - scrollLeft}px`,
              top: `${line.trackIdx * 48 - scrollTop}px`,
              height: "48px",
            }
          : { left: `${line.time * zoom - scrollLeft}px` };

        return <div key={`snap-${idx}`} className={snapClass} style={style} />;
      })}
    </>
  );
});