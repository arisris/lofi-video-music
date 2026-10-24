import type { MediaLibraryApi } from "./types";

export const PixabayTab = ({ api }: { api: MediaLibraryApi }) => {
  const { st, apply, searchPixabay, loadMorePixabay, handlePixabayAdd } = api;
  return (
    <>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${st.pixabayMediaType}s on Pixabay...`}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 pl-8 text-[11px] text-slate-300 outline-none focus:border-blue-500/50"
                  value={st.pixabayQuery || ""}
                  onChange={(e) => apply({ pixabayQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPixabay(st.pixabayQuery);
                    }
                  }}
                />
                <i className="absolute top-1/2 left-2.5 icon-[ri--search-line] -translate-y-1/2 text-slate-500" />
              </div>
              <button
                title="Toggle Filters"
                className={`flex cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-all ${st.showPixabayFilters ? "border-blue-500/30 bg-blue-600/20 text-blue-400" : "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"}`}
                onClick={() =>
                  apply({ showPixabayFilters: !st.showPixabayFilters })
                }
              >
                <i className="icon-[ri--filter-3-line] h-3.5 w-3.5" />
              </button>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent bg-blue-600 px-3 py-1.5 text-[10px] font-bold tracking-wider text-white uppercase transition-colors hover:bg-blue-500"
                onClick={() => searchPixabay(st.pixabayQuery)}
              >
                <i className="icon-[ri--search-2-line] h-3 w-3" />
                Search
              </button>
            </div>

            {/* Filters Drawer */}
            {st.showPixabayFilters && (
              <div className="animate-tab-fade-in mt-1.5 mb-1.5 space-y-3 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                {/* Media Type Selection */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                    Type
                  </span>
                  <div className="border-slate-850 scrollbar-none flex overflow-x-auto rounded-lg border bg-slate-950 p-0.5">
                    {(
                      [
                        ["video", "Video"],
                        ["photo", "Photo"],
                        ["illustration", "Illust"],
                        ["vector", "Vector"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-[9px] font-bold transition-all ${st.pixabayMediaType === val ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                        onClick={() => {
                          apply({ pixabayMediaType: val });
                          searchPixabay(st.pixabayQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
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
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        className={`cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-bold transition-all ${st.pixabayOrientation === val ? "border border-blue-500/20 bg-blue-600/20 text-blue-400" : "border border-transparent text-slate-500 hover:text-slate-300"}`}
                        onClick={() => {
                          apply({ pixabayOrientation: val });
                          searchPixabay(st.pixabayQuery);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transparent Background Toggle (Image types only) */}
                {st.pixabayMediaType !== "video" && (
                  <div className="border-slate-855 flex items-center justify-between rounded-lg border bg-slate-950/40 p-1">
                    <div className="flex flex-col pl-1">
                      <span className="text-[9px] font-bold text-slate-300">
                        Transparent BG (Stickers)
                      </span>
                      <span className="text-[8px] text-slate-500">
                        Filters transparent PNG elements
                      </span>
                    </div>
                    <button
                      className={`relative h-4 w-8 rounded-full transition-colors ${st.pixabayTransparentOnly ? "bg-blue-600" : "bg-slate-850"}`}
                      onClick={() => {
                        apply({
                          pixabayTransparentOnly: !st.pixabayTransparentOnly,
                        });
                        searchPixabay(st.pixabayQuery);
                      }}
                    >
                      <div
                        className={`absolute top-0.5 bottom-0.5 w-3 rounded-full bg-white transition-all ${st.pixabayTransparentOnly ? "right-0.5" : "left-0.5"}`}
                      />
                    </button>
                  </div>
                )}
              </div>
            )}

            {st.isSearchingPixabay && st.pixabayItems.length === 0 && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs font-medium text-slate-400">
                  Searching Pixabay...
                </span>
              </div>
            )}

            {st.pixabayError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 p-4">
                <i className="mt-0.5 icon-[ri--error-warning-line] h-4.5 w-4.5 text-red-500" />
                <div>
                  <p className="text-[10px] font-bold tracking-wide text-red-400 uppercase">
                    Search Error
                  </p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-red-300/80">
                    {st.pixabayError}
                  </p>
                </div>
              </div>
            )}

            {(!st.isSearchingPixabay || st.pixabayItems.length > 0) &&
              !st.pixabayError &&
              (() => {
                const items = st.pixabayItems;
                if (!items || items.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 p-8 text-center">
                      <i className="icon-[ri--image-line] h-8 w-8 text-slate-700" />
                      <p className="text-xs font-medium text-slate-500">{`No items found on Pixabay for "${st.pixabayQuery}".`}</p>
                    </div>
                  );
                }

                const visibleItems = items.slice(0, st.pixabayVisibleCount);
                const isVideoMode = st.pixabayMediaType === "video";

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 items-start gap-3">
                      {visibleItems.map((item: any) => {
                        const assetId = isVideoMode
                          ? `pixabay-video-${item.id}`
                          : `pixabay-image-${item.id}`;
                        const isLoading = st.loadingAssetId === assetId;

                        // Extract preview thumbnail
                        let thumbnail = "";
                        let width = 1;
                        let height = 1;

                        if (isVideoMode) {
                          const videos = item.videos || {};
                          const bestVid =
                            videos.small || videos.tiny || videos.medium || {};
                          thumbnail = bestVid.thumbnail || "";
                          width = bestVid.width || 16;
                          height = bestVid.height || 9;
                        } else {
                          thumbnail =
                            item.previewURL || item.webformatURL || "";
                          width = item.previewWidth || 1;
                          height = item.previewHeight || 1;
                        }

                        return (
                          <div
                            key={item.id}
                            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                            style={{ aspectRatio: `${width} / ${height}` }}
                          >
                            {/* Thumbnail Preview */}
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-900">
                                <i
                                  className={
                                    isVideoMode
                                      ? "icon-[ri--film-line] h-6 w-6 text-slate-700"
                                      : "icon-[ri--image-line] h-6 w-6 text-slate-700"
                                  }
                                />
                              </div>
                            )}

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

                            {/* Author info */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-10 flex-col justify-end bg-linear-to-t from-black/80 via-black/40 to-transparent p-2">
                              <span className="truncate pr-1 text-[9px] font-bold text-slate-200">{`By ${item.user || "Pixabay"}`}</span>
                            </div>

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
                                      handlePixabayAdd(item, "background")
                                    }
                                  >
                                    <i className="icon-[ri--image-line] h-4 w-4" />
                                  </button>
                                  <button
                                    title="Add as Overlay"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200 shadow-lg transition-all hover:scale-110 hover:bg-slate-700"
                                    onClick={() =>
                                      handlePixabayAdd(item, "overlay")
                                    }
                                  >
                                    <i className="icon-[ri--image-add-line] h-4 w-4" />
                                  </button>
                                </div>
                                <a
                                  href={item.pageURL || "https://pixabay.com"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="pointer-events-auto flex cursor-pointer items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-slate-400 transition-colors hover:text-blue-400"
                                >
                                  <i className="icon-[ri--external-link-line] h-2.5 w-2.5" />
                                  View on Pixabay
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Load More Button */}
                    {(st.hasMorePixabay ||
                      items.length > st.pixabayVisibleCount) && (
                      <div className="mt-4 flex items-center justify-center border-t border-slate-800 pt-4">
                        <button
                          className="bg-slate-850 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-[10px] font-bold tracking-wider text-slate-300 uppercase transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-wait disabled:opacity-50"
                          disabled={st.isSearchingPixabay}
                          onClick={loadMorePixabay}
                        >
                          {st.isSearchingPixabay ? (
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
