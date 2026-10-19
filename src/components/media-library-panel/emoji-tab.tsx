import { EMOJI_CATEGORIES } from "./constants";

export const EmojiTab = ({ api }: { api: any }) => {
  const { st, apply, handleEmojiAdd, hoverTimeoutRef, hoverScheduledRef } = api;
  return (
    <>
      {!st.emojisData ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">
            Loading animated emojis...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Emoji Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search animated emojis..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50"
                value={st.emojiQuery || ""}
                onChange={(e) =>
                  apply({
                    emojiQuery: e.target.value,
                    emojiVisibleCount: 24,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
              />
              <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Emoji Category Pills */}
          <div className="scrollbar-none mb-1 flex snap-x gap-1 overflow-x-auto pb-1">
            {EMOJI_CATEGORIES.map((cat: any) => {
              const isSel = st.emojiCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  className={`shrink-0 cursor-pointer snap-start rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase transition-all ${isSel ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20" : "hover:bg-slate-750 border border-transparent bg-slate-800 text-slate-400 hover:text-slate-200"}`}
                  onClick={() =>
                    apply({ emojiCategory: cat.id, emojiVisibleCount: 24 })
                  }
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Emoji Grid */}
          {(() => {
            let filteredEmojis: any[] = [];
            const categories = st.emojisData?.categories || [];

            if (st.emojiCategory === "all") {
              filteredEmojis = categories.flatMap((cat: any) =>
                (cat.items || []).map((item: any) => ({
                  ...item,
                  category: cat.id,
                })),
              );
            } else {
              const activeCat = categories.find(
                (cat: any) => cat.id === st.emojiCategory,
              );
              if (activeCat) {
                filteredEmojis = (activeCat.items || []).map((item: any) => ({
                  ...item,
                  category: activeCat.id,
                }));
              }
            }

            if (st.emojiQuery && st.emojiQuery.trim()) {
              const q = st.emojiQuery.toLowerCase().trim();
              filteredEmojis = filteredEmojis.filter((e) =>
                e.tag.toLowerCase().includes(q),
              );
            }

            if (filteredEmojis.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 p-8 text-center">
                  <i className="icon-[ri--emotion-unhappy-line] h-8 w-8 text-slate-700" />
                  <p className="text-xs font-medium text-slate-500">
                    No emojis found matching filters.
                  </p>
                </div>
              );
            }

            const visibleEmojis = filteredEmojis.slice(0, st.emojiVisibleCount);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {visibleEmojis.map((emoji) => {
                    const isLoading =
                      st.loadingAssetId === `emoji-${emoji.codepoint}`;
                    const isHovered =
                      st.hoveredEmojiCodepoint === emoji.codepoint;
                    return (
                      <div
                        key={emoji.codepoint}
                        className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 transition-all hover:border-blue-500/50 hover:bg-slate-900/50"
                        onMouseEnter={() => {
                          if (hoverTimeoutRef.current) {
                            clearTimeout(hoverTimeoutRef.current);
                          }
                          hoverScheduledRef.current = emoji.codepoint;
                          hoverTimeoutRef.current = setTimeout(() => {
                            if (hoverScheduledRef.current === emoji.codepoint) {
                              apply({
                                hoveredEmojiCodepoint: emoji.codepoint,
                              });
                            }
                          }, 250) as unknown as number;
                        }}
                        onMouseLeave={() => {
                          if (hoverScheduledRef.current === emoji.codepoint) {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = null;
                            }
                            hoverScheduledRef.current = null;
                          }
                          if (st.hoveredEmojiCodepoint === emoji.codepoint) {
                            apply({ hoveredEmojiCodepoint: null });
                          }
                        }}
                        onClick={() => {
                          if (!isLoading) handleEmojiAdd(emoji);
                        }}
                      >
                        <img
                          src={
                            isHovered
                              ? `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.gif`
                              : `https://fonts.gstatic.com/s/e/notoemoji/latest/${emoji.codepoint}/512.png`
                          }
                          alt={emoji.tag}
                          loading="lazy"
                          className="h-10 w-10 object-contain transition-transform duration-200 group-hover:scale-110"
                        />

                        {isLoading ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/80">
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                            <span className="text-[7px] font-bold tracking-wider text-blue-400 uppercase">
                              Importing
                            </span>
                          </div>
                        ) : (
                          <div className="pointer-events-none absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                            <i className="icon-[ri--add-line] h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button */}
                {filteredEmojis.length > st.emojiVisibleCount && (
                  <div className="mt-1 flex items-center justify-center border-t border-slate-800 pt-3">
                    <button
                      className="bg-slate-850 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-[10px] font-bold tracking-wider text-slate-300 uppercase transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                      onClick={() =>
                        apply({
                          emojiVisibleCount: st.emojiVisibleCount + 24,
                        })
                      }
                    >
                      <i className="icon-[ri--arrow-down-s-line] h-3.5 w-3.5" />
                      Load More
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
};
