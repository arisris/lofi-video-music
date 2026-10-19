import { memo } from "react";
import { formatTime } from "../../utils/helpers";

export const RulerTicks = memo(function RulerTicks({
  totalDuration,
  zoom,
  scrollLeft,
}: {
  totalDuration: number;
  zoom: number;
  scrollLeft: number;
}) {
  const span = { left: `${-scrollLeft}px`, width: `${totalDuration * zoom}px` };
  const valid =
    !isNaN(totalDuration) && isFinite(totalDuration) && totalDuration > 0;

  return (
    <>
      <div className="absolute top-0 flex h-full items-end" style={span}>
        {Array.from({
          length: valid ? Math.ceil(totalDuration / 10) + 1 : 7,
        }).map((_, i) => (
          <div
            key={`ruler-${i * 10}`}
            className="absolute flex h-3 flex-col justify-end border-l border-slate-700 px-1 pb-1"
            style={{ left: `${i * 10 * zoom}px` }}
          >
            <span className="font-mono text-[8px] text-slate-500">
              {formatTime(i * 10)}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute top-0 flex h-full items-end" style={span}>
        {Array.from({
          length: valid ? Math.ceil(totalDuration / 2) + 1 : 31,
        }).map((_, i) => {
          const time = i * 2;
          if (time % 10 === 0) return null;
          return (
            <div
              key={`sub-${time}`}
              className="absolute h-1.5 border-l border-slate-800"
              style={{ left: `${time * zoom}px` }}
            />
          );
        })}
      </div>
    </>
  );
});