export const UploadsTab = ({ api }: { api: any }) => {
  const { st, uploads, addAssetToTimeline, triggerUpload } = api;
  return (
    <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                Uploaded &amp; Imported
              </h3>
              <button
                className="flex cursor-pointer items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[9px] font-bold text-white transition-colors hover:bg-blue-500"
                onClick={triggerUpload}
              >
                <i className="icon-[ri--upload-2-fill] h-3 w-3" />
                Upload
              </button>
            </div>

            {st.activeUploadsCount > 0 && (
              <div className="flex items-center justify-center gap-2.5 rounded-xl border border-blue-900/20 bg-blue-950/10 p-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-[10px] font-semibold text-blue-400">
                  Processing media (
                  {st.totalUploadsCount - st.activeUploadsCount}/
                  {st.totalUploadsCount})...
                </span>
              </div>
            )}

            {uploads.length === 0 && st.activeUploadsCount === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 p-8 text-center">
                <i className="icon-[ri--folder-upload-line] h-8 w-8 text-slate-700" />
                <p className="text-xs font-medium text-slate-500">
                  No uploaded or imported assets yet.
                </p>
              </div>
            )}

            {uploads.length > 0 && (
              <div className="grid grid-cols-2 items-start gap-3">
                {uploads.map((asset: any) => {
                  const width =
                    asset.width || (asset.type === "video" ? 16 : 1);
                  const height =
                    asset.height || (asset.type === "video" ? 9 : 1);
                  return (
                    <div
                      key={asset.id}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                      style={{ aspectRatio: `${width} / ${height}` }}
                    >
                      {/* Media Thumbnail Preview */}
                      {asset.thumbnail ? (
                        <img
                          src={asset.thumbnail}
                          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-900">
                          <i
                            className={
                              asset.type === "video"
                                ? "icon-[ri--film-line] h-6 w-6 text-slate-700"
                                : "icon-[ri--image-line] h-6 w-6 text-slate-700"
                            }
                          />
                        </div>
                      )}

                      {/* Video Duration Badge */}
                      {asset.type === "video" && (
                        <span className="absolute top-2 right-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                          {`${Math.round(asset.duration)}s`}
                        </span>
                      )}

                      {/* Video Play Icon Indicator */}
                      {asset.type === "video" && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity group-hover:opacity-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur-sm">
                            <i className="icon-[ri--play-fill] h-4.5 w-4.5 text-slate-200" />
                          </div>
                        </div>
                      )}

                      {/* Asset details */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex min-h-10 flex-col justify-end bg-linear-to-t from-black/80 via-black/40 to-transparent p-2">
                        <span className="truncate pr-1 text-[9px] font-bold text-slate-200">
                          {asset.name}
                        </span>
                      </div>

                      {/* Action Overlays */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/80 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          title="Add as Background"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-blue-500"
                          onClick={() =>
                            addAssetToTimeline(asset, "background")
                          }
                        >
                          <i className="icon-[ri--image-line] h-4 w-4" />
                        </button>
                        <button
                          title="Add as Overlay"
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200 shadow-lg transition-all hover:scale-110 hover:bg-slate-700"
                          onClick={() => addAssetToTimeline(asset, "overlay")}
                        >
                          <i className="icon-[ri--image-add-line] h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

    </>
  );
};
