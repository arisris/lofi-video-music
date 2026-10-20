import { useEffect, useMemo, useRef, useState } from "react";
import { editorStore, useEditorStore } from "../store/editor-store";
import { updateTimelineClipSettings } from "../store/actions/timeline-actions";
import { updateClipSettings } from "../store/actions/clip-settings";
import { loadGoogleFont } from "../lib/fonts";
import { TEXT_TEMPLATES, templateStyle } from "../lib/text-templates";
import {
  EMPTY_LYRICS,
  countSunoTags,
  createLyricLine,
  endsByLine,
  formatLrcTime,
  parseLyricText,
  parseLyricsFile,
  resolveActiveLineIndex,
  serializeLrc,
  serializeLyricText,
  stampEnd,
  stampStart,
  type LyricLine,
  type LyricsData,
} from "../lib/lyrics";
import { TimeInput } from "./ui/time-input";

const CLOCK_INTERVAL_MS = 250;

/** Matches the renderer's default so a derived tail end reads the same. */
const FALLBACK_LINE_DURATION = 4;

/**
 * The three ways lyrics reach a track, which is what the panel is a switch
 * between. They answer different questions - where do the words come from, or
 * where do the timings come from - so keeping them on one scrolling column just
 * meant every track looked like all three were unfinished at once.
 */
type InputTab = "sync" | "raw" | "lrc";

const INPUT_TABS: { id: InputTab; label: string; icon: string }[] = [
  { id: "sync", label: "Sync", icon: "icon-[ri--timer-line]" },
  { id: "raw", label: "Raw", icon: "icon-[ri--align-left]" },
  { id: "lrc", label: "LRC", icon: "icon-[ri--file-music-line]" },
];

interface Clock {
  /** Seconds into the audio file, or null when the playhead is elsewhere. */
  time: number | null;
  playing: boolean;
  activeLineId: string | null;
}

/** Seconds into the target clip's audio, i.e. the axis LRC timestamps use. */
const readTrackTime = (clipId: string | null): number | null => {
  if (!clipId) return null;
  const state = editorStore.getState();
  const clip = state.timelineClips.find((c) => c.id === clipId);
  if (!clip) return null;
  const { currentTime } = state;
  if (currentTime < clip.start || currentTime > clip.start + clip.duration) {
    return null;
  }
  return currentTime - clip.start + ((clip.settings.startOffset as number) || 0);
};

/** Reads the lyrics off a clip without ever holding a stale copy. */
const readLyrics = (clipId: string | null): LyricsData => {
  if (!clipId) return EMPTY_LYRICS;
  const clip = editorStore.getState().timelineClips.find((c) => c.id === clipId);
  return (clip?.settings?.lyrics as LyricsData | undefined) ?? EMPTY_LYRICS;
};

const writeLyrics = (clipId: string, lyrics: LyricsData) => {
  updateTimelineClipSettings(clipId, { lyrics });
};

/** Patch transform of the line array, re-read from the store on every call. */
const writeLines = (
  clipId: string,
  transform: (lines: LyricLine[]) => LyricLine[],
) => {
  const current = readLyrics(clipId);
  writeLyrics(clipId, { ...current, lines: transform(current.lines) });
};

const fileBaseName = (clip: { settings?: Record<string, unknown> }) => {
  const lyrics = clip.settings?.lyrics as LyricsData | undefined;
  const raw = String(clip.settings?.name || lyrics?.sourceName || "lyrics");
  return (
    raw
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w\-. ]+/g, "")
      .trim() || "lyrics"
  );
};

interface LineRowProps {
  line: LyricLine;
  /** Where this line actually stops, derived when `line.end` is null. */
  derivedEnd: number;
  active: boolean;
  /** The line the stamp pass is currently working on. */
  isSyncTarget?: boolean;
  /** Music running and the playhead over this track, so a tap can land. */
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

/**
 * One button, two taps: the first records where the line starts, the second
 * where it stops.
 *
 * Deliberately not a transport. The music is already playing from the transport
 * bar and a stamp must never interrupt it - pausing to record a time made the
 * panel and the timeline fight over who owned playback.
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
  /**
   * Flashes when a tap was refused.
   *
   * The only refusal is an end that has not passed the line's own start, and a
   * tap that does nothing looks exactly like a broken button - the music keeps
   * playing, so there is no other cue that the moment was rejected.
   */
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
            ? "border-transparent text-slate-700"
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
          : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60"
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
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-slate-600 focus:bg-slate-900"
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
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition-colors hover:bg-blue-900/30 hover:text-blue-400 disabled:cursor-default disabled:text-slate-700 disabled:hover:bg-transparent"
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
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
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
        // quietly accepting a value that does nothing. Once there is a start
        // the field is always live and always shows a number.
        disabled={line.start === null}
        onActivate={() => onFocus(line.id)}
        onUpdate={(v) => onEndChange(line.id, v)}
      />
    </div>
  </div>
  );
};

/** Left dock tab: import, style and time one music clip's lyric lines. */
export const LyricsPanel = () => {
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const lyricsClipId = useEditorStore((s) => s.lyricsClipId);
  const layerSettings = useEditorStore((s) => s.clipSettings.lyrics);
  const currentRoute = useEditorStore((s) => s.currentRoute);
  const [inputTab, setInputTab] = useState<InputTab>("sync");
  // Collapsed by default: it is a finishing pass over one global layer, not
  // part of putting lyrics on a track, and fourteen template tiles push the
  // tab content off the panel entirely.
  const [styleOpen, setStyleOpen] = useState(false);

  const musicClips = useMemo(
    () => timelineClips.filter((c) => c.type === "music"),
    [timelineClips],
  );

  // The pinned clip wins, so opening the layer's properties (which steals the
  // selection) does not move the panel off the track being edited.
  const targetClip = useMemo(() => {
    if (musicClips.length === 0) return null;
    const pinned = musicClips.find((c) => c.id === lyricsClipId);
    if (pinned) return pinned;
    const { currentTime } = editorStore.getState();
    return (
      musicClips.find(
        (c) => currentTime >= c.start && currentTime <= c.start + c.duration,
      ) ?? musicClips[0]
    );
  }, [musicClips, lyricsClipId]);

  const targetId = targetClip?.id ?? null;
  const lyrics = (targetClip?.settings?.lyrics as LyricsData | undefined) ??
    EMPTY_LYRICS;
  const lines = lyrics.lines;

  const tailDuration =
    (layerSettings?.fallbackLineDuration as number) || FALLBACK_LINE_DURATION;
  // Derived per line so a null `end` still shows where the line really stops.
  const ends = useMemo(() => endsByLine(lines), [lines]);

  // Polled, never subscribed: the store rewrites currentTime every animation
  // frame, and a selector on it would re-render this panel 60 times a second.
  const [clock, setClock] = useState<Clock>({
    time: null,
    playing: false,
    activeLineId: null,
  });
  useEffect(() => {
    const tick = () => {
      const time = readTrackTime(targetId);
      const current = readLyrics(targetId);
      const index = resolveActiveLineIndex(current.lines, time ?? 0, {
        fallbackLineDuration: tailDuration,
        autoAdvanceUnstamped: layerSettings?.unstampedAutoAdvance === true,
      });
      setClock({
        time,
        playing: editorStore.getState().isPlaying,
        activeLineId: index >= 0 ? current.lines[index].id : null,
      });
    };
    tick();
    const id = setInterval(tick, CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [
    targetId,
    layerSettings?.offsetSeconds,
    layerSettings?.unstampedAutoAdvance,
    tailDuration,
  ]);

  /**
   * Whether the lyrics layer is actually drawing.
   *
   * Deliberately `=== true` rather than `!== false`. The layer has no settings
   * entry in the store until something writes one, and the render loop skips a
   * global clip that has none at all - so "not configured yet" has to read as
   * off. Treating it as on meant the first stamp believed it had nothing to do,
   * skipped the enable, and left the layer permanently invisible.
   */
  const layerEnabled = layerSettings?.enabled === true;

  /**
   * Manual stamping, driven by the button beside "Add Line" and one button per
   * row.
   *
   * The music plays from the transport bar; the panel only records moments.
   * Each line takes two taps - one where it starts, one where it stops - and
   * nothing here ever calls playAudio/pauseAudio, so listening is never
   * interrupted to write a number down. `readTrackTime` reads the same clock the
   * renderer and the LRC export use, so the second that gets written is the
   * second that was heard.
   */
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
   *
   * An earlier version resolved this to "the next line that still needs a
   * time", which looked right until a track was fully timed: there was then
   * nothing to point at, the marker vanished, and clicking a line did not seem
   * to do anything at all. The marker is a position now, not a work item.
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
    if (!targetId || line.start === null) return;
    const clip = editorStore
      .getState()
      .timelineClips.find((c) => c.id === targetId);
    if (!clip) return;
    // readTrackTime counts forward from the clip's own head trim, so undo it.
    editorStore.setState({
      currentTime: clip.start + line.start - ((clip.settings.startOffset as number) || 0),
    });
  };

  /**
   * Points the marker at a line.
   *
   * It only brings the playhead along while the transport is stopped. During a
   * pass the playhead is the clock being stamped from, so seeking because
   * somebody clicked a row would move the very thing they are timing.
   */
  const focusLine = (id: string) => {
    setFocusLineId(id);
    if (editorStore.getState().isPlaying) return;
    const line = lines.find((l) => l.id === id);
    if (line) seekToLine(line);
  };

  /** Whether a tap can land at all: music running, playhead over this track. */
  const canStamp = clock.playing && clock.time !== null;

  /** What a line is waiting for: its start, then its end, then nothing. */
  const nextStampFor = (l: LyricLine): "start" | "end" | null =>
    l.start === null ? "start" : l.end === null ? "end" : null;

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
    if (!targetId || !editorStore.getState().isPlaying) return false;
    const time = readTrackTime(targetId);
    if (time === null) return false;

    const current = readLyrics(targetId).lines;
    const before = current.find((l) => l.id === lineId);
    if (!before) return false;

    const next =
      field === "start"
        ? stampStart(current, lineId, time)
        : stampEnd(current, lineId, time);
    const after = next.find((l) => l.id === lineId);
    if (!after) return false;
    if (after.start === before.start && after.end === before.end) return false;

    writeLines(targetId, () => next);
    // A manual pass never touches the import button, so without this the very
    // first stamped line would stay invisible and read as a broken button.
    if (!layerEnabled) updateClipSettings("lyrics", { enabled: true });
    return true;
  };

  /** Stamps one line's next missing time, leaving the transport alone. */
  const stampLine = (line: LyricLine): boolean => {
    if (!targetId) return false;
    const fresh = readLyrics(targetId).lines.find((l) => l.id === line.id);
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
   * second records its end and the marker moves on. It no longer plays or
   * pauses anything - playback belongs to the transport bar, and a stamp must
   * never stop the music being listened to.
   */
  const stampNext = (): boolean => {
    if (!targetId) return false;
    const current = readLyrics(targetId).lines;
    const work = findWorkLine(current, focusId);
    if (!work) return false;
    const field = nextStampFor(work);
    if (field === null) return false;
    setFocusLineId(work.id);
    const ok = stampAt(work.id, field);
    if (ok && field === "end") {
      advanceMarker(readLyrics(targetId).lines, work.id);
    }
    return ok;
  };

  const handleUpload = () => {
    if (!targetId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lrc,.txt,text/plain";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseLyricsFile(
          file.name,
          String(reader.result ?? ""),
          stripOptions,
        );
        if (parsed.lines.length === 0) return;
        writeLyrics(targetId, {
          ...parsed,
          title: parsed.title ?? (targetClip?.settings?.name as string) ?? "",
          sourceName: file.name,
        });
        // Importing lyrics and then seeing nothing would read as a broken
        // button, so turn the layer on at the same time.
        if (!layerEnabled) updateClipSettings("lyrics", { enabled: true });
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    if (!targetClip || lines.length === 0) return;
    const blob = new Blob([serializeLrc(lyrics)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileBaseName(targetClip)}.lrc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  /**
   * The paste box.
   *
   * It opens holding the current lyrics, so it doubles as a bulk editor - a
   * whole verse reworded in one place beats 16 single-line inputs. The draft
   * carries the id signature it was typed against; once the line set changes
   * underneath it (a paste, a delete, a clear) that signature is stale and the
   * box falls back to showing the store, so an abandoned draft can never be
   * applied over lyrics it was never written against.
   */
  const signature = lines.map((l) => l.id).join("|");
  const [draft, setDraft] = useState<{ sig: string; text: string } | null>(null);
  const draftIsLive = draft !== null && draft.sig === signature;
  const rawText = draftIsLive ? draft.text : serializeLyricText(lines);
  /**
   * Parentheses off by default: `(verse)` and `(kendang percussion)` are as
   * common in pasted lyrics as real ad-libs, and a direction drawn on the
   * canvas reads as a sung line. Keeping them is the opt-in.
   */
  const keepParenTags = layerSettings?.keepParenTags === true;
  const stripOptions = useMemo(() => ({ keepParenTags }), [keepParenTags]);
  const parsedDraft = useMemo(
    () => parseLyricText(rawText, stripOptions),
    [rawText, stripOptions],
  );
  const draftLines = parsedDraft.lines.length;
  // Timestamps are not stage directions, and an LRC paste has neither.
  const draftIsLrc = parsedDraft.lines.some((l) => l.start !== null);
  const draftTags = useMemo(
    () => (draftIsLrc ? 0 : countSunoTags(rawText, stripOptions)),
    [rawText, draftIsLrc, stripOptions],
  );

  const applyRawText = (mode: "replace" | "append") => {
    if (!targetId || draftLines === 0) return;
    const parsed = parsedDraft;
    writeLyrics(targetId, {
      ...parsed,
      lines:
        mode === "replace" ? parsed.lines : [...lines, ...parsed.lines],
      title: parsed.title ?? (targetClip?.settings?.name as string) ?? "",
      sourceName: mode === "replace" ? "Pasted text" : lyrics.sourceName,
    });
    setDraft(null);
    // Pasted words and then seeing nothing would read as a broken box.
    if (!layerEnabled) updateClipSettings("lyrics", { enabled: true });
  };

  if (currentRoute === "/image") return null;

  if (musicClips.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900/50 p-8 text-center">
        <i className="icon-[ri--mic-line] h-8 w-8 text-slate-700" />
        <p className="text-xs font-medium text-slate-500">
          Add a track to the timeline first
        </p>
        <p className="text-[10px] leading-relaxed text-slate-600">
          Lyrics are attached per music clip, so each track keeps its own words.
        </p>
      </div>
    );
  }

return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900/50 p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Which track. A precondition for all three tabs, so it sits above
            them - switching tabs must never change whose lyrics are on screen. */}
        <div className="flex-none space-y-1.5">
          <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            Lyrics For
          </h3>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <select
                className="w-full cursor-pointer appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-8 text-xs text-slate-200 outline-none hover:bg-slate-700/50 focus:border-blue-500/50"
                value={targetId ?? ""}
                onChange={(e) =>
                  editorStore.setState({ lyricsClipId: e.target.value })
                }
              >
                {musicClips.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {(c.settings?.name as string) || `Track ${i + 1}`}
                  </option>
                ))}
              </select>
              <i className="pointer-events-none absolute top-1/2 right-2 icon-[ri--arrow-down-s-line] h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
            <button
              onClick={() => editorStore.setState({ selectedClipId: "lyrics" })}
              title="Open the lyrics layer's properties"
              className="flex w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-blue-600/15 hover:text-blue-400"
            >
              <i className="icon-[ri--settings-3-line] h-4 w-4" />
            </button>
          </div>
        </div>

        {/* SYNC | RAW | LRC - three ways lyrics reach a track. */}
        <div className="flex flex-none gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
          {INPUT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setInputTab(tab.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                inputTab === tab.id
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
              }`}
            >
              <i className={`${tab.icon} h-3.5 w-3.5`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {/* SYNC - timing by ear. */}
          {inputTab === "sync" && (
            <div className="space-y-3">
              {/* Pinned to the top of the tab: a pasted lyric can run to
                  dozens of rows, and the control that walks the pass is the
                  one thing that must never scroll out of reach. */}
              <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl bg-slate-900/95 px-1.5 py-1.5 backdrop-blur-sm">
                {/* The global stamp. Two taps per line - start, then end - and
                    it never touches playback; the transport bar owns that. */}
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
                      : "border-slate-700/50 bg-slate-800/40 text-slate-600"
                  }`}
                >
                  <i className="icon-[ri--timer-line] h-5 w-5 shrink-0" />
                  Stamp
                  {canStamp && workLine && (
                    <span className="shrink-0 rounded bg-black/20 px-1 font-mono text-[10px] tracking-normal">
                      {nextStampFor(workLine) === "end" ? "E" : "S"}
                    </span>
                  )}
                  {/* Counter before the pointer, so the two numbers never
                      read as one run of digits. */}
                  <span className="ml-auto shrink-0 font-mono text-[10px] tracking-normal normal-case opacity-80">
                    {stampedCount}/{lines.length}
                  </span>
                  {focusNo > 0 && (
                    <span className="shrink-0 font-mono text-[10px] font-normal tracking-normal normal-case opacity-60">
                      →{focusNo}
                    </span>
                  )}
                </button>

                <button
                  onClick={() =>
                    writeLines(targetId!, (prev) => [
                      ...prev,
                      // Deliberately unstamped. Handing it the playhead here
                      // would skip its first tap: the button would offer "E"
                      // before the line had ever been heard from the start.
                      createLyricLine(""),
                    ])
                  }
                  title="Add a blank line"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/40 text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-blue-600/15 hover:text-blue-400"
                >
                  <i className="icon-[ri--add-line] h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-blue-400">
                  {clock.time === null ? "--:--.--" : formatLrcTime(clock.time)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                    clock.playing && clock.time !== null
                      ? "bg-blue-600/20 text-blue-400"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {clock.playing ? "Live" : "Idle"}
                </span>
                {lines.length > 0 && (
                  <button
                    onClick={() => writeLyrics(targetId!, EMPTY_LYRICS)}
                    title="Remove all lyrics from this track"
                    className="flex cursor-pointer items-center gap-1 text-[9px] text-slate-500 transition-colors hover:text-red-400"
                  >
                    <i className="icon-[ri--eraser-line] h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>

              {lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 p-6 text-center">
                  <i className="icon-[ri--folder-music-line] h-7 w-7 text-slate-700" />
                  <p className="text-xs font-medium text-slate-500">
                    No lyrics on this track
                  </p>
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    Paste them in on the Raw tab, or load an{" "}
                    <span className="font-mono">.lrc</span>.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      derivedEnd={ends[i]}
                      active={clock.activeLineId === line.id}
                      isSyncTarget={line.id === focusId}
                      canStamp={canStamp}
                      onTextChange={(id, text) =>
                        writeLines(targetId!, (prev) =>
                          prev.map((l) => (l.id === id ? { ...l, text } : l)),
                        )
                      }
                      onStartChange={(id, time) =>
                        writeLines(targetId!, (prev) =>
                          time === null
                            ? prev.map((l) =>
                                l.id === id ? { ...l, start: null } : l,
                              )
                            : stampStart(prev, id, time),
                        )
                      }
                      onEndChange={(id, time) =>
                        // stampEnd refuses an end at or before this line's own
                        // start, and clears one the new start has overtaken.
                        writeLines(targetId!, (prev) =>
                          stampEnd(prev, id, time),
                        )
                      }
                      onDelete={(id) =>
                        writeLines(targetId!, (prev) =>
                          prev.filter((l) => l.id !== id),
                        )
                      }
                      onResetTiming={(id) => {
                        // Words stay, timing goes. The line is marked straight
                        // after so the next two taps re-time this one rather
                        // than whatever the pass happened to be on.
                        writeLines(targetId!, (prev) =>
                          prev.map((l) =>
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

              <p className="text-[9px] leading-relaxed text-slate-500">
                {clock.time === null
                  ? "Move the playhead over this track to stamp timings."
                  : !clock.playing
                    ? "Press play on the transport bar. The stamp buttons wake up while the music runs."
                    : stampedCount === 0
                      ? "Tap a line's button when it starts, and again when it ends. The music never stops."
                      : workLine
                        ? `Line ${focusNo} is waiting for its ${nextStampFor(workLine)}. Tap Stamp or that line's button at the right moment.`
                        : "Every line is timed. Click an S or E field to correct one, or clear a line to stamp it again."}
              </p>
            </div>
          )}

          {/* RAW - the words, pasted in one go. */}
          {inputTab === "raw" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  Raw Text
                </h3>
                {draftIsLive && (
                  <button
                    onClick={() => setDraft(null)}
                    title="Discard this edit and reload the saved lyrics"
                    className="flex cursor-pointer items-center gap-1 text-[9px] text-slate-500 transition-colors hover:text-slate-300"
                  >
                    <i className="icon-[ri--arrow-go-back-line] h-3 w-3" />
                    Revert
                  </button>
                )}
              </div>

              <textarea
                value={rawText}
                onChange={(e) =>
                  setDraft({ sig: signature, text: e.currentTarget.value })
                }
                spellCheck={false}
                placeholder={
                  "Paste the raw lyric here, one line each.\n\nSuno tags like [Verse 1], [Chorus]\nor (verse) are removed on apply."
                }
                className="custom-scrollbar h-72 w-full resize-y rounded-lg border border-slate-700/50 bg-slate-950/50 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
              />

              {/* Parentheses are a judgement call: usually sung asides, often
                  directions like (verse) or (kendang percussion). Off by
                  default, and the switch sits where the paste lands so the
                  choice is visible instead of buried in the inspector. */}
              <button
                onClick={() =>
                  updateClipSettings("lyrics", {
                    keepParenTags: !keepParenTags,
                  })
                }
                title={
                  keepParenTags
                    ? "Parentheses are kept, including sung asides like (oh yeah!)"
                    : "Parentheses are removed too, including directions like (verse) or (kendang percussion)"
                }
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 px-2.5 py-1.5 transition-colors hover:bg-slate-700/40"
              >
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                  <i className="icon-[ri--chat-quote-line] h-3 w-3 text-slate-500" />
                  Keep ( ) text
                </span>
                <span
                  className={`h-3 w-3 shrink-0 rounded-full transition-all ${
                    keepParenTags ? "bg-blue-400" : "bg-slate-600"
                  }`}
                />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => applyRawText("replace")}
                  disabled={draftLines === 0}
                  title="Swap every line on this track for the text above, dropping [Verse] / [Chorus] style tags"
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="icon-[ri--file-edit-line] h-3 w-3" />
                  Replace
                </button>
                <button
                  onClick={() => applyRawText("append")}
                  disabled={draftLines === 0 || lines.length === 0}
                  title="Keep the existing lines and add the text above after them"
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2 text-[10px] font-bold tracking-wider text-slate-300 uppercase transition-colors hover:bg-slate-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="icon-[ri--add-line] h-3 w-3" />
                  Append
                </button>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {draftLines}
                </span>
              </div>

              {draftTags > 0 && (
                <p className="flex items-center gap-1 text-[9px] text-amber-400/80">
                  <i className="icon-[ri--scissors-cut-line] h-3 w-3 shrink-0" />
                  {draftTags} tag{draftTags === 1 ? "" : "s"} will be dropped.
                </p>
              )}

              <p className="text-[9px] leading-relaxed text-slate-500">
                Every line lands unstamped, ready to be timed on the Sync tab.
                Square brackets are Suno directions and go; parentheses go too
                unless Keep ( ) text is on. Existing timings survive — the box
                writes <span className="font-mono">[00:00.00]</span> stamps back
                once every line has one.
              </p>
            </div>
          )}

          {/* LRC - timings from a file. */}
          {inputTab === "lrc" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500"
                >
                  <i className="icon-[ri--upload-2-fill] h-3 w-3" />
                  Upload
                </button>
                <button
                  onClick={handleExport}
                  disabled={lines.length === 0}
                  title="Download these lyrics as an .lrc file"
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2 px-3 text-[10px] font-bold tracking-wider text-slate-300 uppercase transition-colors hover:bg-slate-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="icon-[ri--download-2-line] h-3 w-3" />
                  Export
                </button>
              </div>

              {lines.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-[10px]">
                  <span className="truncate text-slate-500">
                    {lyrics.sourceName || "Unsourced"}
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-slate-400">
                    {stampedCount}/{lines.length} timed
                  </span>
                </div>
              )}

              <p className="text-[9px] leading-relaxed text-slate-500">
                Reads{" "}
                <span className="font-mono">.lrc</span> with{" "}
                <span className="font-mono">[00:12.34]</span> timestamps, and
                plain <span className="font-mono">.txt</span> — a plain file
                arrives unstamped, ready for the Sync tab. Export writes an{" "}
                <span className="font-mono">.lrc</span>, so a gap you carved
                into a line comes back out as an empty marker.
              </p>
            </div>
          )}

          {/* Style - shared across the tabs, and folded away because it is a
              finishing pass over one global layer rather than a way in. */}
          <div className="border-t border-slate-800 pt-3">
            <button
              onClick={() => setStyleOpen((v) => !v)}
              title={styleOpen ? "Hide the style templates" : "Show the style templates"}
              aria-expanded={styleOpen}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase transition-colors hover:text-slate-300"
            >
              Style
              <i
                className={`h-3.5 w-3.5 transition-transform ${
                  styleOpen ? "icon-[ri--arrow-up-s-line]" : "icon-[ri--arrow-down-s-line]"
                }`}
              />
            </button>

            {styleOpen && (
              <div className="mt-2 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {TEXT_TEMPLATES.map((template) => (
                    <button
                      key={template.name}
                      title={template.name}
                      onClick={() => {
                        loadGoogleFont(template.settings.fontFamily as string);
                        updateClipSettings("lyrics", {
                          ...templateStyle(template),
                          enabled: true,
                        });
                      }}
                      className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/40 px-1 transition-all hover:scale-[1.02] hover:border-blue-500/30 hover:bg-blue-600/10"
                    >
                      <div
                        ref={(el) => {
                          if (el) el.style.cssText = template.cssStyle;
                        }}
                        className="flex h-full w-full items-center justify-center overflow-hidden text-center text-[11px] leading-none"
                      >
                        {template.name}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[9px] leading-relaxed text-slate-500">
                  Applies to every track. Fine-tune font, stroke, shadow and line
                  transitions in Lyrics Properties.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};