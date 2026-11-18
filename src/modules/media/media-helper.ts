import { generateThumbnail } from "../../shared/lib/thumbnail";
// gifuct-js loads on demand (GIF path only) so it stays out of the main chunk.
const loadGifDecoder = () => import("gifuct-js");

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  source: string;
  url: string;
  thumbnail: string | null;
  duration: number;
  width?: number;
  height?: number;
  /** True when the bytes are persisted in IndexedDB (Downloaded section). */
  persisted?: boolean;
  element?: HTMLImageElement | null;
  elements?: HTMLVideoElement[] | null;
  gifFrames?: any[];
  gifDuration?: number;
}

export type MediaComplete = (item: MediaItem) => void;

/**
 * Download a remote URL into a local blob URL. Null on failure (e.g. CORS) —
 * the caller falls back to the remote URL as-is.
 */
const fetchToBlobUrl = async (remoteUrl: string): Promise<string | null> => {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

/**
 * Appends an image element to a hidden layout container in the DOM.
 * This keeps the browser ticking animation frames for animated WebPs/GIFs
 * so they can be animated on canvas.
 */
const appendToHiddenContainer = (img: HTMLElement) => {
  if (typeof document === "undefined") return;
  let container: HTMLElement | null = document.getElementById(
    "hidden-media-container",
  );
  if (!container) {
    container = document.createElement("div");
    container.id = "hidden-media-container";
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "512px";
    container.style.height = "512px";
    container.style.overflow = "hidden";
    container.style.opacity = "0.002";
    container.style.pointerEvents = "none";
    container.style.zIndex = "-9999";
    document.body.appendChild(container);
  }
  img.style.position = "absolute";
  img.style.left = "0";
  img.style.top = "0";
  img.style.width = "auto";
  img.style.height = "auto";
  container.appendChild(img);
};

const processStaticImageFile = (
  file: File,
  url: string,
  id: string,
  onComplete: MediaComplete,
) => {
  const img = new Image();
  appendToHiddenContainer(img);
  img.onload = () => {
    safeGenerateThumbnail(img, false).then((thumb) => {
      onComplete({
        id,
        name: file.name,
        type: "image",
        source: "upload",
        url,
        thumbnail: thumb,
        duration: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
        element: img,
        elements: null,
      });
    });
  };
  img.onerror = () => {
    console.error("Error loading image file source");
    onComplete({
      id,
      name: file.name,
      type: "image",
      source: "upload",
      url,
      thumbnail: null,
      duration: 0,
      element: img,
      elements: null,
    });
  };
  img.src = url;
};

const processStaticImageUrl = (
  url: string,
  id: string,
  name: string,
  source: string,
  onComplete: MediaComplete,
) => {
  const img = new Image();
  appendToHiddenContainer(img);
  img.onload = () => {
    safeGenerateThumbnail(img, false).then((thumb) => {
      onComplete({
        id,
        name,
        type: "image",
        source,
        url,
        thumbnail: thumb,
        duration: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
        element: img,
        elements: null,
      });
    });
  };
  img.onerror = () => {
    console.error("Error loading image URL source:", url);
    onComplete({
      id,
      name,
      type: "image",
      source,
      url,
      thumbnail: null,
      duration: 0,
      element: img,
      elements: null,
    });
  };
  img.crossOrigin = "anonymous";
  img.src = url;
};

const processGifFile = (
  file: File,
  url: string,
  id: string,
  onComplete: MediaComplete,
) => {
  file
    .arrayBuffer()
    .then(async (arrayBuffer) => {
      const { parseGIF, decompressFrames } = await loadGifDecoder();
      try {
        const gif = parseGIF(arrayBuffer);
        const decompressedFrames = decompressFrames(gif, true);

        const bakingCanvas = document.createElement("canvas");
        bakingCanvas.width = gif.lsd.width;
        bakingCanvas.height = gif.lsd.height;
        const bakingCtx = bakingCanvas.getContext("2d")!;

        let prevCanvasData: ImageData | null = null;

        const frames = decompressedFrames.map((frame, index) => {
          if (index > 0) {
            const prevFrame = decompressedFrames[index - 1];
            if (prevFrame.disposalType === 2) {
              bakingCtx.clearRect(
                prevFrame.dims.left,
                prevFrame.dims.top,
                prevFrame.dims.width,
                prevFrame.dims.height,
              );
            } else if (prevFrame.disposalType === 3 && prevCanvasData) {
              bakingCtx.putImageData(prevCanvasData, 0, 0);
            }
          }

          if (frame.disposalType === 3) {
            prevCanvasData = bakingCtx.getImageData(
              0,
              0,
              bakingCanvas.width,
              bakingCanvas.height,
            );
          }

          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = frame.dims.width;
          tempCanvas.height = frame.dims.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          const imageData = new ImageData(
            frame.patch as unknown as Uint8ClampedArray<ArrayBuffer>,
            frame.dims.width,
            frame.dims.height,
          );
          tempCtx.putImageData(imageData, 0, 0);

          bakingCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);

          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = bakingCanvas.width;
          frameCanvas.height = bakingCanvas.height;
          const frameCtx = frameCanvas.getContext("2d")!;
          frameCtx.drawImage(bakingCanvas, 0, 0);

          return {
            canvas: frameCanvas,
            delay: frame.delay || 100,
            dims: {
              left: 0,
              top: 0,
              width: bakingCanvas.width,
              height: bakingCanvas.height,
            },
          };
        });

        const totalDurationMs = frames.reduce((acc, f) => acc + f.delay, 0);

        let thumbnail = null;
        if (frames.length > 0) {
          thumbnail = frames[0].canvas.toDataURL("image/png");
        }

        onComplete({
          id,
          name: file.name,
          type: "gif",
          source: "upload",
          url,
          thumbnail,
          duration: totalDurationMs / 1000,
          width: gif.lsd.width,
          height: gif.lsd.height,
          gifFrames: frames,
          gifDuration: totalDurationMs,
        });
      } catch (error) {
        console.error("Error processing GIF file:", error);
        processStaticImageFile(file, url, id, onComplete);
      }
    })
    .catch((error) => {
      console.error("Error reading file buffer:", error);
      processStaticImageFile(file, url, id, onComplete);
    });
};

const processGifUrl = (
  url: string,
  id: string,
  name: string,
  source: string,
  onComplete: MediaComplete,
) => {
  fetch(url)
    .then((res) => res.arrayBuffer())
    .then(async (arrayBuffer) => {
      const { parseGIF, decompressFrames } = await loadGifDecoder();
      // GIF bytes are reused as a local blob so the pool + export stay
      // self-contained (no remote URL dependency).
      let localUrl = url;
      try {
        localUrl = URL.createObjectURL(new Blob([arrayBuffer]));
      } catch {
        /* use remote */
      }
      try {
        const gif = parseGIF(arrayBuffer);
        const decompressedFrames = decompressFrames(gif, true);

        const bakingCanvas = document.createElement("canvas");
        bakingCanvas.width = gif.lsd.width;
        bakingCanvas.height = gif.lsd.height;
        const bakingCtx = bakingCanvas.getContext("2d")!;

        let prevCanvasData: ImageData | null = null;

        const frames = decompressedFrames.map((frame, index) => {
          if (index > 0) {
            const prevFrame = decompressedFrames[index - 1];
            if (prevFrame.disposalType === 2) {
              bakingCtx.clearRect(
                prevFrame.dims.left,
                prevFrame.dims.top,
                prevFrame.dims.width,
                prevFrame.dims.height,
              );
            } else if (prevFrame.disposalType === 3 && prevCanvasData) {
              bakingCtx.putImageData(prevCanvasData, 0, 0);
            }
          }

          if (frame.disposalType === 3) {
            prevCanvasData = bakingCtx.getImageData(
              0,
              0,
              bakingCanvas.width,
              bakingCanvas.height,
            );
          }

          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = frame.dims.width;
          tempCanvas.height = frame.dims.height;
          const tempCtx = tempCanvas.getContext("2d")!;
          const imageData = new ImageData(
            frame.patch as unknown as Uint8ClampedArray<ArrayBuffer>,
            frame.dims.width,
            frame.dims.height,
          );
          tempCtx.putImageData(imageData, 0, 0);

          bakingCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);

          const frameCanvas = document.createElement("canvas");
          frameCanvas.width = bakingCanvas.width;
          frameCanvas.height = bakingCanvas.height;
          const frameCtx = frameCanvas.getContext("2d")!;
          frameCtx.drawImage(bakingCanvas, 0, 0);

          return {
            canvas: frameCanvas,
            delay: frame.delay || 100,
            dims: {
              left: 0,
              top: 0,
              width: bakingCanvas.width,
              height: bakingCanvas.height,
            },
          };
        });

        const totalDurationMs = frames.reduce((acc, f) => acc + f.delay, 0);

        let thumbnail = null;
        if (frames.length > 0) {
          thumbnail = frames[0].canvas.toDataURL("image/png");
        }

        onComplete({
          id,
          name,
          type: "gif",
          source,
          url: localUrl,
          thumbnail,
          duration: totalDurationMs / 1000,
          width: gif.lsd.width,
          height: gif.lsd.height,
          gifFrames: frames,
          gifDuration: totalDurationMs,
        });
      } catch (error) {
        console.error("Error processing GIF URL:", error);
        processStaticImageUrl(localUrl, id, name, source, onComplete);
      }
    })
    .catch((error) => {
      console.error("Error fetching GIF URL:", error);
      processStaticImageUrl(url, id, name, source, onComplete);
    });
};

/**
 * Robust wrapper for generating thumbnails with CORS fallback
 */
const safeGenerateThumbnail = (
  source: any,
  isVideo = false,
): Promise<string | null> => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 4000);

    generateThumbnail(source, isVideo)
      .then((thumb) => {
        clearTimeout(timeout);
        resolve(thumb);
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.warn(
          "CORS or drawing error generating thumbnail, using fallback",
          err,
        );
        resolve(null);
      });
  });
};

/**
 * Seeks to 1.0s or mid-duration to avoid black frames, then captures thumbnail.
 */
const generateVideoThumbnail = (
  video: HTMLVideoElement,
): Promise<string | null> => {
  return new Promise((resolve) => {
    const safetyTimeout = setTimeout(() => {
      safeGenerateThumbnail(video, true).then(resolve);
    }, 3000);

    const seekTime = Math.min(
      1.0,
      video.duration > 0 ? video.duration / 2 : 1.0,
    );

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      clearTimeout(safetyTimeout);
      safeGenerateThumbnail(video, true).then(resolve);
    };

    video.addEventListener("seeked", onSeeked);
    video.currentTime = seekTime;
  });
};

export const processMediaFile = (file: File, onComplete: MediaComplete) => {
  const url = URL.createObjectURL(file);
  const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (file.type === "image/gif") {
    processGifFile(file, url, id, onComplete);
    return;
  }

  const type = file.type.startsWith("video/") ? "video" : "image";

  if (type === "video") {
    const vid1 = document.createElement("video");
    const vid2 = document.createElement("video");
    let loadedCount = 0;

    const checkLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        generateVideoThumbnail(vid1).then((thumb) => {
          onComplete({
            id,
            name: file.name,
            type: "video",
            source: "upload",
            url,
            thumbnail: thumb,
            duration: vid1.duration,
            width: vid1.videoWidth,
            height: vid1.videoHeight,
            element: null,
            elements: [vid1, vid2],
          });
        });
      }
    };

    [vid1, vid2].forEach((vid) => {
      vid.src = url;
      vid.muted = true;
      vid.loop = false;
      vid.playsInline = true;
      vid.crossOrigin = "anonymous";
      vid.playbackRate = 1.0;
      vid.onloadedmetadata = () => {
        vid.width = vid.videoWidth;
        vid.height = vid.videoHeight;
        checkLoad();
      };
      vid.onerror = () => {
        console.error("Error loading video file source");
        loadedCount++;
        if (loadedCount === 2) resolveFallback();
      };
    });

    const resolveFallback = () => {
      onComplete({
        id,
        name: file.name,
        type: "video",
        source: "upload",
        url,
        thumbnail: null,
        duration: 5,
        element: null,
        elements: [vid1, vid2],
      });
    };
  } else {
    processStaticImageFile(file, url, id, onComplete);
  }
};

export const processMediaUrl = (
  url: string,
  type: string,
  name: string,
  source: string,
  onComplete: MediaComplete,
) => {
  const id = `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const isGif = url.toLowerCase().includes(".gif") || type === "gif";
  if (isGif) {
    processGifUrl(url, id, name, source, onComplete);
    return;
  }

  // Cache-at-add: download remote into a local blob so the pool is self-contained
  // (offline playback + export is just packing). On failure → use remote directly.
  void fetchToBlobUrl(url).then((localUrl) => {
    const effUrl = localUrl ?? url;

    if (type === "video") {
      const vid1 = document.createElement("video");
      const vid2 = document.createElement("video");
      let loadedCount = 0;

      const checkLoad = () => {
        loadedCount++;
        if (loadedCount === 2) {
          generateVideoThumbnail(vid1).then((thumb) => {
            onComplete({
              id,
              name,
              type: "video",
              source,
              url: effUrl,
              thumbnail: thumb,
              duration: vid1.duration,
              width: vid1.videoWidth,
              height: vid1.videoHeight,
              element: null,
              elements: [vid1, vid2],
            });
          });
        }
      };

      [vid1, vid2].forEach((vid) => {
        vid.src = effUrl;
        vid.muted = true;
        vid.loop = false;
        vid.playsInline = true;
        vid.crossOrigin = "anonymous";
        vid.playbackRate = 1.0;
        vid.onloadedmetadata = () => {
          vid.width = vid.videoWidth;
          vid.height = vid.videoHeight;
          checkLoad();
        };
        vid.onerror = () => {
          console.error("Error loading video URL source:", effUrl);
          loadedCount++;
          if (loadedCount === 2) resolveFallback();
        };
      });

      const resolveFallback = () => {
        onComplete({
          id,
          name,
          type: "video",
          source,
          url: effUrl,
          thumbnail: null,
          duration: 5,
          element: null,
          elements: [vid1, vid2],
        });
      };
    } else {
      processStaticImageUrl(effUrl, id, name, source, onComplete);
    }
  });
};
