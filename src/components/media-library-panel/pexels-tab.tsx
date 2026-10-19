export const PexelsTab = ({ api }: { api: any }) => {
  const { st, apply, searchPexels, loadMorePexels, handlePexelsAdd } = api;
  return (
    <>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${st.pexelsMediaType}s on Pexels...`}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50"
                  value={st.pexelsQuery || ""}
                  onChange={(e) => apply({ pexelsQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPexels(st.pexelsQuery);
                    }
                  }}
                />
                <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-slate-500" />
              </div>
              <button
                title="Toggle Filters"
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-all ${st.showPexelsFilters ? "border-blue-500/30 bg-blue-600/20 text-blue-400" : "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"}`}
                onClick={() =>
                  apply({ showPexelsFilters: !st.showPexelsFilters })
                }
              >
                <i className="icon-[ri--filter-3-line] h-3.5 w-3.5" />
              </button>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent bg-blue-600 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500"
                onClick={() => searchPexels(st.pexelsQuery)}
              >
                <i className="icon-[ri--search-2-line] h-3 w-3" />
                Search
              </button>
            </div>

            {/* Filters Drawer */}
            {st.showPexelsFilters && (
              <div className="animate-tab-fade-in mt-1.5 mb-1.5 space-y-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                {/* Media Type */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                    Type
                  </span>
                  <div className="border-slate-850 flex rounded-lg border bg-slate-950 p-0.5">
                    <button
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${st.pexelsMediaType === "video" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                      onClick={() => {
                        apply({ pexelsMediaType: "video" });
                        searchPexels(st.pexelsQuery);
                      }}
                    >
                      Video
                    </button>
                    <button
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${st.pexelsMediaType === "photo" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                      onClick={() => {
                        apply({ pexelsMediaType: "photo" });
                        searchPexels(st.pexelsQuery);
                      }}
                    >
                      Photo
                    </button>
                  </div>
                </div>

                {/* Orientation */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                    Orientation
                  </span>
                  <div className="border-slate-850 flex rounded-lg border bg-slate-950 p-0.5">
                    {(
                      [
                        ["all", "Any"],
                        ["landscape", "Horiz"],
                        ["portrait", "Vert"],
                        ["square", "Sq"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        className={`cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${st.pexelsOrientation === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                        onClick={() => {
                          apply({ pexelsOrientation: val });
                          searchPexels(st.pexelsQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration (for Video only) */}
                {st.pexelsMediaType === "video" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                      Duration
                    </span>
                    <div className="border-slate-850 flex rounded-lg border bg-slate-950 p-0.5">
                      {(
                        [
                          ["all", "Any"],
                          ["short", "< 15s"],
                          ["medium", "15-30s"],
                          ["long", "> 30s"],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          className={`cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${st.pexelsDuration === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                          onClick={() => apply({ pexelsDuration: val })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {st.isSearchingPexels &&
              st.pexelsPhotos.length === 0 &&
              st.pexelsVideos.length === 0 && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span className="text-xs font-medium text-slate-400">{`Searching Pexels ${st.pexelsMediaType}s...`}</span>
                </div>
              )}

            {st.pexelsError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 p-4">
                <i className="mt-0.5 icon-[ri--error-warning-line] h-4.5 w-4.5 text-red-500" />
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-red-400 uppercase">
                    Search Error
                  </p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-red-300/80">
                    {st.pexelsError}
                  </p>
                </div>
              </div>
            )}

            {/* Client-side filtering of videos based on duration */}
            {(st.pexelsPhotos.length > 0 ||
              st.pexelsVideos.length > 0 ||
              !st.isSearchingPexels) &&
              !st.pexelsError &&
              (() => {
                const isVideoMode = st.pexelsMediaType === "video";
                let items = isVideoMode ? st.pexelsVideos : st.pexelsPhotos;

                if (isVideoMode && st.pexelsDuration !== "all") {
                  items = items.filter((video: any) => {
                    if (st.pexelsDuration === "short")
                      return video.duration <= 15;
                    if (st.pexelsDuration === "medium")
                      return video.duration > 15 && video.duration <= 30;
                    if (st.pexelsDuration === "long")
                      return video.duration > 30;
                    return true;
                  });
                }

                if (!items || items.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 p-8 text-center">
                      <i
                        className={
                          isVideoMode
                            ? "icon-[ri--video-chat-line] h-8 w-8 text-slate-700"
                            : "icon-[ri--image-line] h-8 w-8 text-slate-700"
                        }
                      />
                      <p className="text-xs font-medium text-slate-500">{`No ${st.pexelsMediaType}s found for "${st.pexelsQuery}" with current filters.`}</p>
                    </div>
                  );
                }

                const visibleItems = items.slice(0, st.pexelsVisibleCount);
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 items-start gap-3">
                      {visibleItems.map((item: any) => {
                        const assetId = isVideoMode
                          ? `pexels-${item.id}`
                          : `pexels-photo-${item.id}`;
                        const isLoading = st.loadingAssetId === assetId;
                        const thumbnail = isVideoMode
                          ? item.image
                          : item.src.medium || item.src.small;
                        const artist = isVideoMode
                          ? item.user?.name
                          : item.photographer;
                        const profileUrl = isVideoMode
                          ? item.user?.url
                          : item.photographer_url;
                        const width = item.width || 1;
                        const height = item.height || 1;

                        return (
                          <div
                            key={`${assetId}`}
                            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                            style={{ aspectRatio: `${width} / ${height}` }}
                          >
                            {/* Thumbnail Preview */}
                            <img
                              src={thumbnail}
                              className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
                            />

                            {/* Video Duration Badge */}
                            {isVideoMode && (
                              <span className="absolute top-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                                {`${Math.round(item.duration)}s`}
                              </span>
                            )}

                            {/* Video Play Icon */}
                            {isVideoMode && !isLoading && (
                              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity group-hover:opacity-0">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur-sm">
                                  <i className="icon-[ri--play-fill] h-4.5 w-4.5 text-slate-200" />
                                </div>
                              </div>
                            )}

                            {/* Loading Spinner Overlay */}
                            {isLoading ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-950/80">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                                <span className="text-[8px] font-bold tracking-wider text-slate-400 uppercase">
                                  Importing...
                                </span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    title="Add as Background"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-500"
                                    onClick={() =>
                                      handlePexelsAdd(item, "background")
                                    }
                                  >
                                    <i className="icon-[ri--image-line] h-4 w-4" />
                                  </button>
                                  <button
                                    title="Add as Overlay"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200 shadow-lg transition-all hover:scale-110 hover:bg-slate-700"
                                    onClick={() =>
                                      handlePexelsAdd(item, "overlay")
                                    }
                                  >
                                    <i className="icon-[ri--image-add-line] h-4 w-4" />
                                  </button>
                                </div>
                                {profileUrl && (
                                  <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="pointer-events-auto flex cursor-pointer items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-slate-400 transition-colors hover:text-blue-400"
                                  >
                                    <i className="icon-[ri--external-link-line] h-2.5 w-2.5" />
                                    {`By ${artist || "Pexels"}`}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Load More Button */}
                    {(st.hasMorePexels ||
                      items.length > st.pexelsVisibleCount) && (
                      <div className="mt-4 flex items-center justify-center border-t border-slate-800 pt-4">
                        <button
                          className="bg-slate-850 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-[10px] font-bold tracking-wider text-slate-300 uppercase transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-wait disabled:opacity-50"
                          disabled={st.isSearchingPexels}
                          onClick={loadMorePexels}
                        >
                          {st.isSearchingPexels ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              Loading More...
                            </>
                          ) : (
                            <>
                              <i className="icon-[ri--arrow-down-s-line] h-3.5 w-3.5" />
                              Load More
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

    </>
  );
};
