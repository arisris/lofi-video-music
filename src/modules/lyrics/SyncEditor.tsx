import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../../store/editor-store";
import { Button } from "../../shared/ui/Button";
import { TimeInput } from "../../shared/ui/TimeInput";
import {
  createLyricLine,
  endsByLine,
  formatLrcTime,
  resolveActiveLineIndex,
  stampEnd,
  stampStart,
  type LyricLine,
} from "./lyrics";

const CLOCK_INTERVAL_MS = 250;

/** Seconds into the target clip, i.e. the axis LRC timestamps use. */
function readClipTime(clipId: string): number | null {
  const st = useEditorStore.getState();
  const clip = st.clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const { currentTime } = st;
  if (currentTime < clip.start || currentTime > clip.start + clip.duration) {
    return null;
  }
  return currentTime - clip.start;
}

interface Clock {
  /** Seconds into the clip, or null when the playhead is elsewhere. */
  time: number | null;
  playing: boolean;
  activeLineId: string | null;
}

/**
 * One button, two taps: the first records where the line starts, the second
 * where it stops. Never touches the transport - the music is already playing
 * from the transport bar and a stamp must never interrupt it.
 */
const StampButton = ({
  field,
  canStamp,
  onTap,
}: {
  field: "start" | "end" | null;
  canStamp: boolean;
  onTap: () => boolean;
}) => {
  /** Flashes when a tap was refused (end at/before its own start). */
  const [refused, setRefused] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const enabled = canStamp && field !== null;

  const tap = () => {
    if (onTap()) return;
    setRefused(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRefused(false), 450);
  };

  return (
    <button
      title={
        !canStamp
          ? "Play the track and keep the playhead over it to stamp"
          : field === "start"
            ? "Stamp this line's start at the playhead"
            : field === "end"
              ? "Stamp this line's end at the playhead"
              : "This line is timed - clear it to stamp again"
      }
      disabled={!enabled}
      onClick={(e) => {
        e.stopPropagation();
        tap();
      }}
      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border font-mono text-[10px] font-bold transition-colors disabled:cursor-default ${
        refused
          ? "border-red-500/60 bg-red-600/20 text-red-400"
          : !enabled
            ? "border-transparent text-neutral-700"
            : field === "start"
              ? "border-blue-600/30 bg-blue-600/10 text-blue-400 hover:bg-blue-600/25"
              : "border-amber-600/30 bg-amber-600/10 text-amber-400 hover:bg-amber-600/25"
      }`}
    >
      {field === null ? (
        <i className="icon-[ri--check-line] h-3.5 w-3.5" />
      ) : field === "start" ? (
        "S"
      ) : (
        "E"
      )}
    </button>
  );
};

interface LineRowProps {
  line: LyricLine;
  /** Where this line actually stops, derived when `line.end` is null. */
  derivedEnd: number;
  active: boolean;
  isSyncTarget: boolean;
  canStamp: boolean;
  onTextChange: (id: string, text: string) => void;
  onStartChange: (id: string, time: number | null) => void;
  onEndChange: (id: string, time: number | null) => void;
  onDelete: (id: string) => void;
  /** Drops this line's timing but keeps its words, ready to be stamped again. */
  onResetTiming: (id: string) => void;
  /** Moves the pass to this line, for lyrics that do not start at the top. */
  onFocus: (id: string) => void;
  /** Stamps this line's next missing time at the playhead; false if refused. */
  onStamp: (line: LyricLine) => boolean;
}

const LineRow = ({
  line,
  derivedEnd,
  active,
  isSyncTarget,
  canStamp,
  onTextChange,
  onStartChange,
  onEndChange,
  onDelete,
  onResetTiming,
  onFocus,
  onStamp,
}: LineRowProps) => {
  /** What the single stamp button will record on the next tap. */
  const nextField: "start" | "end" | null =
    line.start === null ? "start" : line.end === null ? "end" : null;

  return (
    <div
      onClick={() => onFocus(line.id)}
      title="Mark this line for the stamp pass"
      className={`cursor-pointer rounded-lg border px-1.5 py-1.5 transition-colors ${
        isSyncTarget
          ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/20"
          : active
            ? "border-blue-500/40 bg-blue-600/15"
            : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 hover:bg-neutral-900/60"
      }`}
    >
      {/* Every way of touching this line lands on the same thing: the pass now
          waits here. Clicking the row, putting the cursor in the text, or
          editing either time field all mean "I am working on this one". */}
      <div className="flex items-center gap-1.5">
        {/* Per-line stamp. Two taps: start, then end. The shared button walks
            the whole list; this one is for the single line that came out wrong. */}
        <StampButton
          field={nextField}
          canStamp={canStamp}
          onTap={() => {
            onFocus(line.id);
            return onStamp(line);
          }}
        />
        <input
          type="text"
          defaultValue={line.text}
          placeholder={line.start === null ? "Unstamped line…" : ""}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus:bg-neutral-900"
          onFocus={() => onFocus(line.id)}
          onChange={(e) => onTextChange(line.id, e.currentTarget.value)}
        />
        {/* Re-times this line alone. The words stay - only the timing goes, so
            the next two taps land on this line instead. */}
        <button
          title={
            line.start === null && line.end === null
              ? "No timing to clear"
              : "Clear this line's timing so it can be synced again"
          }
          disabled={line.start === null && line.end === null}
          onClick={(e) => {
            e.stopPropagation();
            onResetTiming(line.id);
          }}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-500 transition-colors hover:bg-blue-900/30 hover:text-blue-400 disabled:cursor-default disabled:text-neutral-700 disabled:hover:bg-transparent"
        >
          <i className="icon-[ri--restart-line] h-3.5 w-3.5" />
        </button>
        <button
          title="Delete line"
          onClick={(e) => {
            // Without this the row's own handler would point the pass at a line
            // that is no longer there.
            e.stopPropagation();
            onDelete(line.id);
          }}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
        >
          <i className="icon-[ri--delete-bin-line] h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <TimeInput
          label="S"
          value={line.start}
          onActivate={() => onFocus(line.id)}
          onUpdate={(v) => onStartChange(line.id, v)}
        />
        <TimeInput
          label="E"
          value={line.end}
          autoFrom={line.start === null ? undefined : derivedEnd}
          // An end with no start is a window that never opens - the renderer
          // skips the line entirely - so the field is refused rather than
          // quietly accepting a value that does nothing.
          disabled={line.start === null}
          onActivate={() => onFocus(line.id)}
          onUpdate={(v) => onEndChange(line.id, v)}
        />
      </div>
    </div>
  );
};

function linesOfClip(clipId: string): LyricLine[] {
  const clip = useEditorStore.getState().clips.find((c) => c.id === clipId);
  const lines = clip?.settings?.lines;
  return Array.isArray(lines) ? (lines as LyricLine[]) : [];
}

/**
 * Per-clip sync editor — timing by ear.
 *
 * Adapted from the old Sync tab (music-clip model;
 * attached to the music clip + global layer; new model: lines on the lyrics
 * clip itself). Music runs from the transport bar; the panel only records
 * moments: two taps per line (start, then end), and nothing ever calls
 * play/pause so listening is never interrupted.
 */
export function SyncEditor({ clipId }: { clipId: string }) {
  const clip = useEditorStore((s) => s.clips.find((c) => c.id === clipId));
  const updateClipSettings = useEditorStore((s) => s.updateClipSettings);
  if (!clip) return null;
  const lines = linesOfClip(clipId);
  const settings = (clip.settings ?? {}) as Record<string, unknown>;
  const tailDuration =
    typeof settings.fallbackLineDuration === "number"
      ? settings.fallbackLineDuration
      : 4;
  const offset =
    typeof settings.offsetSeconds === "number" ? settings.offsetSeconds : 0;
  const autoAdvance = settings.unstampedAutoAdvance === true;
  // Derived per line so a null `end` still shows where the line really stops.
  const ends = useMemo(() => endsByLine(lines), [lines]);

  // Polled, never subscribed: the store rewrites currentTime every animation
  // frame, and a selector on it would re-render this editor 60 times a second.
  const [clock, setClock] = useState<Clock>({
    time: null,
    playing: false,
    activeLineId: null,
  });
  useEffect(() => {
    const tick = () => {
      const time = readClipTime(clipId);
      const current = linesOfClip(clipId);
      const index = resolveActiveLineIndex(current, (time ?? 0) - offset, {
        fallbackLineDuration: tailDuration,
        autoAdvanceUnstamped: autoAdvance,
      });
      setClock({
        time,
        playing: useEditorStore.getState().playing,
        activeLineId: index >= 0 ? current[index].id : null,
      });
    };
    tick();
    const id = setInterval(tick, CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [clipId, offset, tailDuration, autoAdvance]);

  const stampedCount = lines.filter((l) => l.start !== null).length;
  /**
   * Where the user wants the pass to start.
   *
   * Left null the pass begins at the top, but a lyric does not always need
   * timing from its first line - an instrumental intro, or lines someone has
   * already placed by hand - so clicking any row moves the starting point.
   */
  const [focusLineId, setFocusLineId] = useState<string | null>(null);

  /**
   * A line the pass still has a job on.
   *
   * Two taps per line, so the start landing does not finish the line - the
   * marker has to stay put until the end is recorded too. Blank rows are never
   * work: they exist to be typed into, and stamping one would only carve an
   * invisible gap into the track.
   */
  const needsWork = (l: LyricLine) =>
    l.text.trim() !== "" && (l.start === null || l.end === null);

  /**
   * The line the marker sits on, which is simply where the user pointed.
   * The marker is a position, not a work item: with a fully timed track
   * there is nothing to point at, yet clicking a line must still respond.
   */
  const focusId = useMemo(() => {
    if (focusLineId && lines.some((l) => l.id === focusLineId)) {
      return focusLineId;
    }
    return lines.find(needsWork)?.id ?? lines[0]?.id ?? null;
  }, [lines, focusLineId]);

  /** 1-based position of the marked line, for the counter beside it. */
  const focusNo = useMemo(() => {
    const i = lines.findIndex((l) => l.id === focusId);
    return i < 0 ? 0 : i + 1;
  }, [lines, focusId]);

  /**
   * Parks the playhead where a line's words land.
   *
   * Focus is a way of looking at one line, so it should take the playhead
   * there too - otherwise focusing a line says nothing about whether the
   * timing is any good. Lines with no start yet have nowhere to go, so the
   * playhead stays where it is.
   */
  const seekToLine = (line: LyricLine) => {
    if (line.start === null) return;
    const target = useEditorStore.getState().clips.find((c) => c.id === clipId);
    if (!target) return;
    useEditorStore.getState().setTime(target.start + line.start);
  };

  /**
   * Points the marker at a line.
   *
   * It only brings the playhead along while the transport is stopped. During
   * a pass the playhead is the clock being stamped from, so seeking because
   * somebody clicked a row would move the very thing they are timing.
   */
  const focusLine = (id: string) => {
    setFocusLineId(id);
    if (useEditorStore.getState().playing) return;
    const line = linesOfClip(clipId).find((l) => l.id === id);
    if (line) seekToLine(line);
  };

  /** Whether a tap can land at all: music running, playhead over this clip. */
  const canStamp = clock.playing && clock.time !== null;

  /** What a line is waiting for: its start, then its end, then nothing. */
  const nextStampFor = (l: LyricLine): "start" | "end" | null =>
    l.start === null ? "start" : l.end === null ? "end" : null;

  const writeLines = (next: LyricLine[]) =>
    updateClipSettings(clipId, { lines: next });

  /**
   * Writes one moment onto one field of one line.
   *
   * Everything goes through `stampStart` / `stampEnd`, which already know what
   * a valid window looks like: an end at or before the start is refused, and a
   * start that overtakes its own end drops the end so it derives again. Returns
   * whether the line actually changed, so a refused tap can say so instead of
   * looking like a dead button.
   */
  const stampAt = (lineId: string, field: "start" | "end"): boolean => {
    if (!useEditorStore.getState().playing) return false;
    const time = readClipTime(clipId);
    if (time === null) return false;

    const current = linesOfClip(clipId);
    const before = current.find((l) => l.id === lineId);
    if (!before) return false;

    const next =
      field === "start"
        ? stampStart(current, lineId, time)
        : stampEnd(current, lineId, time);
    const after = next.find((l) => l.id === lineId);
    if (!after) return false;
    if (after.start === before.start && after.end === before.end) return false;

    writeLines(next);
    return true;
  };

  /** Stamps one line's next missing time, leaving the transport alone. */
  const stampLine = (line: LyricLine): boolean => {
    const fresh = linesOfClip(clipId).find((l) => l.id === line.id);
    if (!fresh) return false;
    const field = nextStampFor(fresh);
    if (field === null) return false;
    setFocusLineId(line.id);
    return stampAt(line.id, field);
  };

  /** Steps the marker to the next line that still needs a tap, wrapping once. */
  const advanceMarker = (list: LyricLine[], fromId: string) => {
    const at = list.findIndex((l) => l.id === fromId);
    const after = at < 0 ? list : [...list.slice(at + 1), ...list.slice(0, at)];
    setFocusLineId(after.find(needsWork)?.id ?? null);
  };

  /**
   * The next line that still needs a tap, scanning from `fromId` and wrapping.
   *
   * Takes the list rather than closing over it, because the button that acts on
   * it reads the store again at click time - a second tap can arrive before the
   * render that would have refreshed a memoised copy.
   */
  const findWorkLine = (list: LyricLine[], fromId: string | null) => {
    const at = fromId ? list.findIndex((l) => l.id === fromId) : -1;
    const order = at < 0 ? list : [...list.slice(at), ...list.slice(0, at)];
    return order.find(needsWork);
  };

  /** The line the global button would stamp next, following the marker. */
  const workLine = useMemo(() => findWorkLine(lines, focusId), [lines, focusId]);

  /**
   * The global button: the same two taps, walking the list from the marker.
   *
   * The first tap on a line records its start and the marker stays put; the
   * second records its end and the marker moves on. It never plays or pauses
   * anything - playback belongs to the transport bar, and a stamp must never
   * stop the music being listened to.
   */
  const stampNext = (): boolean => {
    const current = linesOfClip(clipId);
    const work = findWorkLine(current, focusId);
    if (!work) return false;
    const field = nextStampFor(work);
    if (field === null) return false;
    setFocusLineId(work.id);
    const ok = stampAt(work.id, field);
    if (ok && field === "end") {
      advanceMarker(linesOfClip(clipId), work.id);
    }
    return ok;
  };

  return (
    <div className="space-y-3">
      {/* Pinned to the top of the tab: a pasted lyric can run to dozens of
          rows, and the control that walks the pass is the one thing that must
          never scroll out of reach. */}
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl bg-neutral-900/95 px-1.5 py-1.5 backdrop-blur-sm">
        {/* The global stamp. Two taps per line - start, then end - and it
            never touches playback; the transport bar owns that. */}
        <button
          onClick={() => stampNext()}
          disabled={!canStamp || !workLine}
          title={
            !canStamp
              ? "Play the track from the transport bar and keep the playhead over it"
              : !workLine
                ? "Every line is timed"
                : "Stamp the marked line - once for its start, again for its end"
          }
          className={`flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[11px] font-bold tracking-wider uppercase transition-colors disabled:cursor-not-allowed ${
            canStamp && workLine
              ? nextStampFor(workLine) === "end"
                ? "border-amber-500/40 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
                : "border-emerald-500/40 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
              : "border-neutral-700/50 bg-neutral-800/40 text-neutral-600"
          }`}
        >
          <i className="icon-[ri--timer-line] h-5 w-5 shrink-0" />
          Stamp
          {canStamp && workLine && (
            <span className="shrink-0 rounded bg-black/20 px-1 font-mono text-[10px] tracking-normal">
              {nextStampFor(workLine) === "end" ? "E" : "S"}
            </span>
          )}
          {/* Counter before the pointer, so the two numbers never read as one
              run of digits. */}
          <span className="ml-auto shrink-0 font-mono text-[10px] tracking-normal normal-case opacity-80">
            {stampedCount}/{lines.length}
          </span>
          {focusNo > 0 && (
            <span className="shrink-0 font-mono text-[10px] font-normal tracking-normal normal-case opacity-60">
              →{focusNo}
            </span>
          )}
        </button>

        <Button
          variant="icon"
          size="md"
          title="Add a blank line"
          onClick={() =>
            writeLines([
              ...linesOfClip(clipId),
              // Deliberately unstamped. Handing it the playhead here would
              // skip its first tap: the button would offer "E" before the
              // line had ever been heard from the start.
              createLyricLine(""),
            ])
          }
        >
          <i className="icon-[ri--add-line] h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-blue-400">
          {clock.time === null ? "--:--.--" : formatLrcTime(clock.time)}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
            clock.playing && clock.time !== null
              ? "bg-blue-600/20 text-blue-400"
              : "bg-neutral-800 text-neutral-500"
          }`}
        >
          {clock.playing ? "Live" : "Idle"}
        </span>
        {lines.length > 0 && (
          <button
            onClick={() => writeLines([])}
            title="Remove all lyrics from this clip"
            className="flex cursor-pointer items-center gap-1 text-[9px] text-neutral-500 transition-colors hover:text-red-400"
          >
            <i className="icon-[ri--eraser-line] h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 p-6 text-center">
          <i className="icon-[ri--folder-music-line] h-7 w-7 text-neutral-700" />
          <p className="text-xs font-medium text-neutral-500">
            No lyrics on this clip
          </p>
          <p className="text-[10px] leading-relaxed text-neutral-600">
            Paste them in on the Raw tab, or load an{" "}
            <span className="font-mono">.lrc</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {lines.map((line, i) => (
            <LineRow
              key={line.id ?? `line-${i}`}
              line={line}
              derivedEnd={ends[i]}
              active={clock.activeLineId === line.id}
              isSyncTarget={line.id === focusId}
              canStamp={canStamp}
              onTextChange={(id, text) =>
                writeLines(
                  linesOfClip(clipId).map((l) =>
                    l.id === id ? { ...l, text } : l,
                  ),
                )
              }
              onStartChange={(id, time) =>
                writeLines(
                  time === null
                    ? linesOfClip(clipId).map((l) =>
                        l.id === id ? { ...l, start: null } : l,
                      )
                    : stampStart(linesOfClip(clipId), id, time),
                )
              }
              onEndChange={(id, time) =>
                // stampEnd refuses an end at or before this line's own
                // start, and clears one the new start has overtaken.
                writeLines(stampEnd(linesOfClip(clipId), id, time))
              }
              onDelete={(id) =>
                writeLines(linesOfClip(clipId).filter((l) => l.id !== id))
              }
              onResetTiming={(id) => {
                // Words stay, timing goes. The line is marked straight
                // after so the next two taps re-time this one rather than
                // whatever the pass happened to be on.
                writeLines(
                  linesOfClip(clipId).map((l) =>
                    l.id === id ? { ...l, start: null, end: null } : l,
                  ),
                );
                setFocusLineId(id);
              }}
              onFocus={focusLine}
              onStamp={stampLine}
            />
          ))}
        </div>
      )}

      <p className="text-[9px] leading-relaxed text-neutral-500">
        {clock.time === null
          ? "Move the playhead over this clip to stamp timings."
          : !clock.playing
            ? "Press play on the transport bar. The stamp buttons wake up while the music runs."
            : stampedCount === 0
              ? "Tap a line's button when it starts, and again when it ends. The music never stops."
              : workLine
                ? `Line ${focusNo} is waiting for its ${nextStampFor(workLine)}. Tap Stamp or that line's button at the right moment.`
                : "Every line is timed. Click an S or E field to correct one, or clear a line to stamp it again."}
      </p>
    </div>
  );
}
