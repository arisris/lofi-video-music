import { memo } from "react";

export const GridLines = memo(function GridLines({
  totalDuration,
  zoom,
  scrollLeft,
}: {
  totalDuration: number;
  zoom: number;
  scrollLeft: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ left: `${-scrollLeft}px`, width: `${totalDuration * zoom}px` }}
    >
      {Array.from({ length: Math.ceil(totalDuration / 10) + 1 }).map((_, i) => (
        <div
          key={`grid-${i}`}
          className="absolute h-full border-l border-slate-800/30"
          style={{ left: `${i * 10 * zoom}px` }}
        />
      ))}
    </div>
  );
});