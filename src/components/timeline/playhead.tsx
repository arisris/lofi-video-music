import { memo } from "react";

export const Playhead = memo(function Playhead({
  time,
  zoom,
  scrollLeft,
}: {
  time: number;
  zoom: number;
  scrollLeft: number;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
      style={{ left: `${time * zoom - scrollLeft}px` }}
    >
      <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-blue-500" />
    </div>
  );
});