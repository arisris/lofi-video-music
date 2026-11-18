/**
 * Lyric parsing / lookup helpers.
 *
 * Lyrics live on the music clip itself (`clip.settings.lyrics`) rather than in
 * a separate map, so they ride along with `swapRoute` snapshots and disappear
 * with `deleteClip` for free. Everything here is pure - the canvas renderer
 * calls `resolveActiveLineIndex` once per frame, the panel calls the parsers.
 *
 * Every line is a window: it runs from `start` until `end`. `end` is nullable
 * and null means "run until the next stamped line starts", which keeps a plain
 * .lrc import gapless by default while still letting the user pull an end
 * earlier to carve out an instrumental break.
 */

export interface LyricLine {
  id: string;
  /** Start time in seconds; null until the line has been stamped. */
  start: number | null;
  /** End time in seconds; null means "until the next stamped line starts". */
  end: number | null;
  text: string;
}

export interface LyricsData {
  lines: LyricLine[];
  /** `[ti:]` tag from an LRC file. */
  title?: string;
  /** `[ar:]` tag from an LRC file. */
  artist?: string;
  /** Original file name, for the export filename and the panel header. */
  sourceName?: string;
}

/** `[mm:ss.xx]`, `[mm:ss:xx]` and `[mm:ss]` are all accepted. */
const TIME_TAG = /\[(\d{1,4}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG = /^\[(ti|ar|al|by|offset):(.*)\]$/i;

/** Timestamp-looking line, used to sniff LRC content inside a .txt upload. */
const LOOKS_TIMED = /^\s*\[\d{1,4}:\d{1,2}[.:\d]*\]/m;

let lineSeq = 0;

const nextLineId = () =>
  `lyric-${Date.now().toString(36)}-${(lineSeq++).toString(36)}`;

export const createLyricLine = (
  text: string,
  start: number | null = null,
  end: number | null = null,
): LyricLine => ({ id: nextLineId(), start, end, text });

/** Fractional part is right-padded to milliseconds: `.5` -> 500ms. */
const tagToSeconds = (match: RegExpExecArray) => {
  const minutes = parseInt(match[1], 10) || 0;
  const seconds = parseInt(match[2], 10) || 0;
  const fraction = match[3]
    ? parseInt(`${match[3]}00`.slice(0, 3), 10) / 1000
    : 0;
  return minutes * 60 + seconds + fraction;
};

const byStart = (a: LyricLine, b: LyricLine) =>
  (a.start ?? Number.POSITIVE_INFINITY) - (b.start ?? Number.POSITIVE_INFINITY);

/**
 * Parse LRC content.
 *
 * A line may carry several timestamps (`[00:12.00][01:04.00] chorus`), which
 * expands into one line per stamp. LRC has no end field, so everything comes
 * back with `end: null` and derives against the following line. A timestamp
 * with no text after it is the standard empty marker for an instrumental gap
 * and is kept, since it is how a gap survives a round trip through .lrc. The
 * `[offset:]` tag shifts every stamp (milliseconds, may be negative).
 */
export function parseLrc(raw: string): LyricsData {
  const lines: LyricLine[] = [];
  let title: string | undefined;
  let artist: string | undefined;
  let offsetSeconds = 0;

  for (const rawLine of raw.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const meta = trimmed.match(META_TAG);
    if (meta) {
      const key = meta[1].toLowerCase();
      const value = meta[2].trim();
      if (key === "ti") title = value;
      else if (key === "ar") artist = value;
      else if (key === "offset")
        offsetSeconds = (parseFloat(value) || 0) / 1000;
      continue;
    }

    TIME_TAG.lastIndex = 0;
    const stamps = [...trimmed.matchAll(TIME_TAG)];
    const text = trimmed.replace(TIME_TAG, "").trim();

    if (stamps.length === 0) {
      // No timestamp at all - keep it as an unstamped line rather than dropping
      // it, so a malformed file still shows something the user can stamp.
      if (text) lines.push(createLyricLine(text));
      continue;
    }

    for (const stamp of stamps) {
      lines.push(
        createLyricLine(text, Math.max(0, tagToSeconds(stamp) - offsetSeconds)),
      );
    }
  }

  lines.sort(byStart);
  return { lines, title, artist };
}

/** A complete `[...]` span. Nested brackets resolve one level per pass. */
const TAG_SPAN = /\[[^[\]]*\]/g;
/** A complete `(...)` span, treated the same way when parens are stripped. */
const PAREN_SPAN = /\([^()]*\)/g;
/** An opening bracket that never closes - a truncated tag, not a word. */
const UNCLOSED_TAG = /\[[^[\]]*$/;
/** `[00:12.34]` and friends are LRC timestamps, not stage directions. */
const TIME_TAG_LIKE = /^\[\d{1,4}:\d{1,2}/;

export interface SunoStripOptions {
  /**
   * Leave `(...)` alone instead of removing it.
   *
   * Parentheses are supposed to be sung ad-libs, but people also use them for
   * directions - `(verse)`, `(kendang percussion)`, `(repeat 2x)` - and those
   * look like lyrics on the canvas. They are removed by default for that
   * reason; this flag is the way to keep a track that really does sing its
   * asides.
   */
  keepParenTags?: boolean;
}

const stripLineTags = (line: string, keepParens: boolean) => {
  let text = line;
  // `[Chorus [x2]]` and `((twice))` only resolve their inner span first, so
  // keep going until there is nothing left to remove.
  for (;;) {
    let next = text.replace(TAG_SPAN, " ");
    if (!keepParens) next = next.replace(PAREN_SPAN, " ");
    if (next === text) break;
    text = next;
  }
  return text.replace(UNCLOSED_TAG, " ");
};

/**
 * Suno's lyrics box, reduced to the words that are actually sung.
 *
 * Suno has a convention of its own: square brackets are instructions to the
 * model - `[Verse 1]`, `[Chorus: lift the drums]`, `[Instrumental Break]`,
 * `[Intro 4]` - and are never sung, while parentheses are real ad-libs and
 * backing vocals. A lyric copied out of Suno therefore carries a second layer
 * of stage directions that the canvas would happily draw as if somebody sang
 * them.
 *
 * Both kinds of direction go by default. Parentheses are meant to be sung
 * asides, but they are just as often written as `(verse)` or
 * `(kendang percussion)`, and the canvas cannot tell the two apart - so the
 * caller decides with `keepParenTags`, and the paste box offers the switch.
 *
 * A line that was nothing but directions turns empty and is dropped by the
 * caller, which is what turns an instrumental break into a plain gap between
 * two sung lines instead of a row reading "[Instrumental Break]".
 */
export function stripSunoTags(
  raw: string,
  options: SunoStripOptions = {},
): string {
  const keepParens = options.keepParenTags === true;
  return raw
    .split(/\r?\n/)
    .map((line) => stripLineTags(line, keepParens).replace(/\s+/g, " ").trim())
    .join("\n");
}

/** How many spans a paste would lose, for the hint under the paste box. */
export function countSunoTags(
  raw: string,
  options: SunoStripOptions = {},
): number {
  const brackets = (raw.match(TAG_SPAN) ?? []).filter(
    (tag) => !TIME_TAG_LIKE.test(tag),
  ).length;
  if (options.keepParenTags === true) return brackets;
  return brackets + (raw.match(PAREN_SPAN) ?? []).length;
}

/** Plain-text lyrics: every non-empty line, all unstamped. */
export function parsePlainLyrics(
  raw: string,
  options: SunoStripOptions = {},
): LyricsData {
  const lines = stripSunoTags(raw, options)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => createLyricLine(l));
  return { lines };
}

/** Picks the parser from the file extension, falling back to content sniffing. */
export function parseLyricsFile(
  fileName: string,
  raw: string,
  options: SunoStripOptions = {},
): LyricsData {
  const isLrc =
    fileName.toLowerCase().endsWith(".lrc") || LOOKS_TIMED.test(raw);
  return isLrc ? parseLrc(raw) : parsePlainLyrics(raw, options);
}

/**
 * Same sniff without a file name, for the paste box - a raw lyric has no
 * extension to go on, so the timestamps either are there or they are not.
 */
export function parseLyricText(
  raw: string,
  options: SunoStripOptions = {},
): LyricsData {
  return LOOKS_TIMED.test(raw) ? parseLrc(raw) : parsePlainLyrics(raw, options);
}

/**
 * The lines rendered back into the text the paste box edits.
 *
 * Timestamps only go in when every line carries one. Writing `[00:00.00]`
 * in front of the half that has not been stamped yet would claim the track
 * starts at zero, and re-applying the box would then freeze those lines there.
 */
export function serializeLyricText(lines: LyricLine[]): string {
  if (lines.length === 0) return "";
  if (!lines.every((l) => l.start !== null)) {
    return `${lines.map((l) => l.text).join("\n")}\n`;
  }
  return serializeLrc({ lines });
}

/**
 * Start time of the next stamped line after each index, Infinity at the tail.
 *
 * Measured in time rather than in list order, so a lyric stays in the order it
 * was written - which is the order it was sung in, and the order the sync pass
 * walks - while a derived end still hands off to whichever line actually comes
 * next on the timeline, even if that line sits earlier in the list.
 */
export function nextStartByLine(lines: LyricLine[]): number[] {
  const stamped = lines
    .map((l) => l.start)
    .filter((s): s is number => s !== null)
    .sort((a, b) => a - b);

  return lines.map((line) => {
    if (line.start === null) return Number.POSITIVE_INFINITY;
    // First start strictly after this one, so two lines sharing a timestamp
    // do not hand off to each other and end in a zero-length window.
    let i = 0;
    while (i < stamped.length && stamped[i] <= line.start) i++;
    return i < stamped.length ? stamped[i] : Number.POSITIVE_INFINITY;
  });
}

/**
 * The time each line actually stops at, after resolving `end: null`.
 *
 * A line with no explicit end hands off to the next stamped line's start. A
 * line with nobody to hand off to runs until the playhead leaves the track.
 *
 * That tail used to be a guessed default length, which broke live syncing: the
 * line being timed vanished four seconds after its start - long before the user
 * pressed E on it - so the canvas looked out of step while the stored timings
 * were right. The track itself is the bound here, because the renderer only
 * asks for a line while a music clip is under the playhead.
 */
export function endsByLine(lines: LyricLine[]): number[] {
  const next = nextStartByLine(lines);
  return lines.map((line, i) => {
    if (line.end !== null) return line.end;
    if (line.start === null) return Number.POSITIVE_INFINITY;
    return next[i];
  });
}

/** Even split used while a track has no stamped line at all. */
export function findFallbackIndex(
  lines: LyricLine[],
  trackTime: number,
  lineDuration: number,
): number {
  if (!Number.isFinite(lineDuration) || lineDuration <= 0) return -1;
  const index = Math.floor(Math.max(0, trackTime) / lineDuration);
  return index < lines.length ? index : -1;
}

export interface ActiveLineOptions {
  /** Seconds per line while a track has nothing stamped at all. */
  fallbackLineDuration?: number;
  /**
   * Whether unstamped lines should advance on that cadence. Off by default:
   * during a manual sync pass the line being typed must stay off the canvas
   * until the playhead pause actually stamps it.
   */
  autoAdvanceUnstamped?: boolean;
}

/**
 * Index of the line on screen right now, or -1 when there is nothing to draw.
 * A line matches when `start <= trackTime < end`, so a window that ends early
 * leaves a real gap instead of bleeding into the next line. Overlapping
 * windows resolve to the later line, which is what karaoke playback wants.
 */
export function resolveActiveLineIndex(
  lines: LyricLine[] | undefined,
  trackTime: number,
  options: ActiveLineOptions = {},
): number {
  if (!lines || lines.length === 0) return -1;

  const stamped = lines.some((l) => l.start !== null);
  if (!stamped) {
    if (!options.autoAdvanceUnstamped) return -1;
    return findFallbackIndex(
      lines,
      trackTime,
      options.fallbackLineDuration ?? 4,
    );
  }

  const ends = endsByLine(lines);
  let best = -1;
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].start;
    if (start !== null && trackTime >= start && trackTime < ends[i]) best = i;
  }
  // An empty marker line is an instrumental gap - draw nothing for it.
  if (best < 0 || !lines[best].text) return -1;
  return best;
}

/**
 * Karaoke-hold index: the latest-started non-empty line at or before
 * trackTime, or -1 when nothing has started yet.
 *
 * Unlike resolveActiveLineIndex this never blanks inside gaps, on empty
 * markers, or after the last explicit end — once the first line starts the
 * stack stays on screen. Before the first start it returns -1 so nothing
 * shows early.
 */
export function resolveHeldLineIndex(
  lines: LyricLine[] | undefined,
  trackTime: number,
): number {
  if (!lines || lines.length === 0) return -1;
  let held = -1;
  let heldStart = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].start;
    if (s === null || trackTime < s || !lines[i].text) continue;
    if (s > heldStart || (s === heldStart && i > held)) {
      held = i;
      heldStart = s;
    }
  }
  return held;
}

/**
 * Writes `start`, leaving the line where it is in the list.
 *
 * Deliberately unsorted. The list is the lyric in the order it was written, and
 * the sync pass walks it in that order from wherever the user pointed it -
 * re-sorting here moved the focused line out from under the pass the moment it
 * was stamped, and the pass jumped back to the top. Imported LRC still sorts,
 * because there the timestamps are the authority on order.
 *
 * An end the new start has overtaken is dropped rather than kept. An end behind
 * the start describes a window that never opens: the line is off screen for
 * good and neither number explains why. Moving the line is the stronger
 * intention here, so the end goes back to deriving from its neighbours.
 */
export const stampStart = (
  lines: LyricLine[],
  lineId: string,
  time: number,
): LyricLine[] =>
  lines.map((l) => {
    if (l.id !== lineId) return l;
    const start = Math.max(0, time);
    const end = l.end !== null && l.end <= start ? null : l.end;
    return { ...l, start, end };
  });

/**
 * Writes `end`. Ordering is untouched - `end` never moves a line's position,
 * and it is left untouched when null so the window keeps deriving.
 *
 * An end at or before the line's own start is refused. That combination is a
 * window containing no moment at all, so the line would drop off the canvas
 * with both numbers still on screen and nothing to explain it. Refusing leaves
 * the previous end in place, which is the only feedback a bare field can give.
 */
export const stampEnd = (
  lines: LyricLine[],
  lineId: string,
  time: number | null,
): LyricLine[] =>
  lines.map((l) => {
    if (l.id !== lineId) return l;
    if (time !== null && l.start !== null && time <= l.start) return l;
    return { ...l, end: time === null ? null : Math.max(0, time) };
  });

/** Seconds -> `mm:ss.xx`, the form LRC consumers and this UI both expect. */
export function formatLrcTime(seconds: number): string {
  // The last line of a track has no end, which arrives as Infinity; without
  // this guard it renders as "Infinity:NaN:NaN".
  if (!Number.isFinite(seconds)) return "--:--";
  const totalCs = Math.round(Math.max(0, seconds) * 100);
  const minutes = Math.floor(totalCs / 6000);
  const secs = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/** Accepts `mm:ss.xx`, `m:ss`, `ss.xx` or bare `ss`; NaN when unreadable. */
export function parseTimeInput(raw: string): number {
  const value = raw.trim();
  if (!value) return NaN;
  const match = value.match(/^(?:(\d+):)?(\d+(?:[.:]\d+)?)$/);
  if (!match) return NaN;
  const minutes = match[1] ? parseInt(match[1], 10) : 0;
  const seconds = parseFloat(match[2].replace(":", "."));
  if (!Number.isFinite(seconds)) return NaN;
  return minutes * 60 + seconds;
}

/**
 * Inverse of the parser - the export side of the upload menu.
 *
 * LRC carries no end field, so a window that was pulled in early is written
 * back as the standard empty marker at that end time. Re-importing the file
 * reproduces the same gap.
 */
export function serializeLrc(data: LyricsData): string {
  const { lines } = data;
  const next = nextStartByLine(lines);
  const out: string[] = [];
  if (data.title) out.push(`[ti:${data.title}]`);
  if (data.artist) out.push(`[ar:${data.artist}]`);

  lines.forEach((line, i) => {
    // A line nobody has timed yet has no place in LRC, and writing it at
    // 00:00.00 would be a lie that re-imports as a real timestamp - a dozen
    // untimed lines would all collapse onto the start of the track.
    if (line.start === null) return;
    out.push(`[${formatLrcTime(line.start)}]${line.text}`);
    // A later line has to exist for a gap marker to mean anything - it is what
    // stops this line from simply running on into the next one's window.
    if (
      line.end !== null &&
      next[i] !== Number.POSITIVE_INFINITY &&
      line.end < next[i]
    ) {
      out.push(`[${formatLrcTime(line.end)}]`);
    }
  });

  return `${out.join("\n")}\n`;
}
