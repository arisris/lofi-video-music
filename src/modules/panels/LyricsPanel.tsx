import { Suspense, lazy, useMemo, useState } from "react";
import { SectionTitle } from "../../shared/ui/FieldLabel";
import { useEditorStore } from "../../store/editor-store";
import { Button } from "../../shared/ui/Button";
import { SegmentedTabs } from "../../shared/ui/SegmentedTabs";
import { SelectControl } from "../../shared/ui/Select";
// SyncEditor loads on demand (Sync tab only) so it stays out of the main chunk.
const SyncEditor = lazy(() =>
  import("../lyrics/SyncEditor").then((m) => ({ default: m.SyncEditor })),
);
import {
  countSunoTags,
  parseLyricText,
  parseLyricsFile,
  serializeLrc,
  serializeLyricText,
  type LyricLine,
} from "../lyrics/lyrics";

type InputTab = "sync" | "raw" | "lrc";

const INPUT_TABS: { id: InputTab; label: string; icon: string }[] = [
  { id: "sync", label: "Sync", icon: "icon-[ri--timer-line]" },
  { id: "raw", label: "Raw", icon: "icon-[ri--align-left]" },
  { id: "lrc", label: "LRC", icon: "icon-[ri--file-music-line]" },
];

const fileBaseName = (clip: { settings?: Record<string, unknown> }) => {
  const raw = String(
    clip.settings?.name || clip.settings?.sourceName || "lyrics",
  );
  return raw.replace(/\.[^.]+$/, "").replace(/[^\w\-. ]+/g, "").trim() || "lyrics";
};

export const LyricsPanel = () => {
  const clips = useEditorStore((s) => s.clips);
  const route = useEditorStore((s) => s.route);
  const updateClipSettings = useEditorStore((s) => s.updateClipSettings);
  const select = useEditorStore((s) => s.select);
  const [inputTab, setInputTab] = useState<InputTab>("sync");
  const [targetId, setTargetId] = useState<string | null>(null);

  // Production/src_old model: lyrics attach to a music clip (settings.lines),
  // one global layer follows the currently playing music. No lyrics layer.
  const targets = useMemo(() => clips.filter((c) => c.type === "music"), [clips]);
  const target = targets.find((c) => c.id === targetId) ?? targets[0] ?? null;
  const lines = useMemo(
    () => (Array.isArray(target?.settings.lines) ? (target.settings.lines as LyricLine[]) : []),
    [target],
  );
  const sourceName =
    typeof target?.settings.sourceName === "string"
      ? (target.settings.sourceName as string)
      : null;

  if (route === "/image") return null;

  if (targets.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-900/50 p-8 text-center">
        <i className="icon-[ri--mic-line] h-8 w-8 text-neutral-700" />
        <p className="text-xs font-medium text-neutral-500">Add a track to the timeline first</p>
        <p className="text-[10px] leading-relaxed text-neutral-600">
          Add a music track first, then sync its words right here — lyrics render on the canvas while the track plays.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-neutral-900/50 p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex-none space-y-1.5">
          <SectionTitle className="">
            Lyrics For
            </SectionTitle>
          <div className="flex gap-2">
            <SelectControl
              value={target?.id ?? ""}
              options={targets.map((c, i) => ({
                value: c.id,
                label: (c.settings?.name as string) || `Track ${i + 1}`,
              }))}
              onChange={setTargetId}
              size="md"
              radius="rounded-lg"
              wrapperClassName="min-w-0 flex-1"
            />
            <Button
              variant="icon"
              size="sm"
              title="Open lyrics style in Properties"
              onClick={() => select("lyrics")}
            >
              <i className="icon-[ri--settings-3-line] h-4 w-4" />
            </Button>
          </div>
        </div>

        <SegmentedTabs
          options={INPUT_TABS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
          value={inputTab}
          onChange={setInputTab}
        />

        <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {inputTab === "sync" && target && (
            <Suspense fallback={null}>
              <SyncEditor clipId={target.id} />
            </Suspense>
          )}

          {inputTab === "raw" && target && (
            <RawTab
              key={target.id}
              targetId={target.id}
              lines={lines}
              updateClipSettings={updateClipSettings}
            />
          )}

          {inputTab === "lrc" && target && (
            <LrcTab
              targetId={target.id}
              targetName={
                (target.settings?.name as string) || sourceName || "lyrics"
              }
              lines={lines}
              sourceName={sourceName}
              updateClipSettings={updateClipSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** RAW - the words, pasted in one go. */
const RawTab = ({
  targetId,
  lines,
  updateClipSettings,
}: {
  targetId: string;
  lines: LyricLine[];
  updateClipSettings: (id: string, patch: Record<string, unknown>) => void;
}) => {
  /**
   * The paste box opens holding the current lyrics, so it doubles as a bulk
   * editor. The draft carries the id signature it was typed against; once the
   * line set changes underneath it that signature is stale and the box falls
   * back to showing the store, so an abandoned draft can never be applied over
   * lyrics it was never written against.
   */
  const signature = lines.map((l) => l.id ?? l.text).join("|");
  const [draft, setDraft] = useState<{ sig: string; text: string } | null>(null);
  const draftIsLive = draft !== null && draft.sig === signature;
  const rawText = draftIsLive && draft ? draft.text : serializeLyricText(lines);
  /**
   * Parentheses off by default: `(verse)` and `(kendang percussion)` are as
   * common in pasted lyrics as real ad-libs, and a direction drawn on the
   * canvas reads as a sung line. Keeping them is the opt-in.
   */
  const target = useEditorStore((s) => s.clips.find((c) => c.id === targetId));
  const keepParenTags = target?.settings?.keepParenTags === true;
  const stripOptions = useMemo(() => ({ keepParenTags }), [keepParenTags]);
  const parsedDraft = useMemo(
    () => parseLyricText(rawText, stripOptions),
    [rawText, stripOptions],
  );
  const draftLines = parsedDraft.lines.length;
  // Timestamps are not stage directions, and an LRC paste has neither.
  const draftIsLrc = parsedDraft.lines.some((l) => l.start !== null);
  const draftTags = draftIsLrc ? 0 : countSunoTags(rawText, stripOptions);

  const applyRawText = (mode: "replace" | "append") => {
    if (!target || draftLines === 0) return;
    const parsed = parsedDraft;
    updateClipSettings(target.id, {
      lines: mode === "replace" ? parsed.lines : [...lines, ...parsed.lines],
    });
    setDraft(null);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle className="">
          Raw Text
            </SectionTitle>
        {draftIsLive && (
          <button
            onClick={() => setDraft(null)}
            title="Discard this edit and reload the saved lyrics"
            className="flex cursor-pointer items-center gap-1 text-[9px] text-neutral-500 transition-colors hover:text-neutral-300"
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
        className="custom-scrollbar h-72 w-full resize-y rounded-lg border border-neutral-700/50 bg-neutral-950/50 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-blue-500/50"
      />

      {/* Parentheses are a judgement call: usually sung asides, often
          directions like (verse). Off by default, and the switch sits where
          the paste lands so the choice is visible instead of buried in the
          inspector. */}
      <button
        onClick={() =>
          updateClipSettings(targetId, { keepParenTags: !keepParenTags })
        }
        title={
          keepParenTags
            ? "Parentheses are kept, including sung asides like (oh yeah!)"
            : "Parentheses are removed too, including directions like (verse)"
        }
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-neutral-700/50 bg-neutral-800/40 px-2.5 py-1.5 transition-colors hover:bg-neutral-700/40"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-300">
          <i className="icon-[ri--chat-quote-line] h-3 w-3 text-neutral-500" />
          Keep ( ) text
        </span>
        <span
          className={`h-3 w-3 shrink-0 rounded-full transition-all ${
            keepParenTags ? "bg-blue-400" : "bg-neutral-600"
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
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 py-2 text-[10px] font-bold tracking-wider text-neutral-300 uppercase transition-colors hover:bg-neutral-700 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i className="icon-[ri--add-line] h-3 w-3" />
          Append
        </button>
        <span className="shrink-0 font-mono text-[10px] text-neutral-500">
          {draftLines}
        </span>
      </div>

      {draftTags > 0 && (
        <p className="flex items-center gap-1 text-[9px] text-amber-400/80">
          <i className="icon-[ri--scissors-cut-line] h-3 w-3 shrink-0" />
          {draftTags} tag{draftTags === 1 ? "" : "s"} will be dropped.
        </p>
      )}

      <p className="text-[9px] leading-relaxed text-neutral-500">
        Every line lands unstamped, ready to be timed on the Sync tab. Square
        brackets are Suno directions and go; parentheses go too unless Keep ( )
        text is on. Existing timings survive — the box writes{" "}
        <span className="font-mono">[00:00.00]</span> stamps back once every
        line has one.
      </p>
    </div>
  );
};

/** LRC - timings from a file. */
const LrcTab = ({
  targetId,
  targetName,
  lines,
  sourceName,
  updateClipSettings,
}: {
  targetId: string;
  targetName: string;
  lines: LyricLine[];
  sourceName: string | null;
  updateClipSettings: (id: string, patch: Record<string, unknown>) => void;
}) => {
  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lrc,.txt,text/plain";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const keepParenTags =
          useEditorStore.getState().clips.find((c) => c.id === targetId)
            ?.settings?.keepParenTags === true;
        const parsed = parseLyricsFile(
          file.name,
          String(reader.result ?? ""),
          { keepParenTags },
        );
        if (parsed.lines.length === 0) return;
        updateClipSettings(targetId, {
          lines: parsed.lines,
          sourceName: file.name,
        });
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = () => {
    if (lines.length === 0) return;
    const blob = new Blob([serializeLrc({ lines })], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileBaseName({ settings: { name: targetName, sourceName } })}.lrc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
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
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 py-2 px-3 text-[10px] font-bold tracking-wider text-neutral-300 uppercase transition-colors hover:bg-neutral-700 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i className="icon-[ri--download-2-line] h-3 w-3" />
          Export
        </button>
      </div>

      {lines.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/40 px-2.5 py-1.5 text-[10px]">
          <span className="truncate text-neutral-500">
            {sourceName || "Unsourced"}
          </span>
          <span className="ml-2 shrink-0 font-mono text-neutral-400">
            {lines.filter((l) => l.start !== null).length}/{lines.length} timed
          </span>
        </div>
      )}

      <p className="text-[9px] leading-relaxed text-neutral-500">
        Reads <span className="font-mono">.lrc</span> with{" "}
        <span className="font-mono">[00:12.34]</span> timestamps, and plain{" "}
        <span className="font-mono">.txt</span> — a plain file arrives unstamped,
        ready for the Sync tab. Export writes an{" "}
        <span className="font-mono">.lrc</span>, so a gap you carved into a line
        comes back out as an empty marker.
      </p>
    </div>
  );
};
