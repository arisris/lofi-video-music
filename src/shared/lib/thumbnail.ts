// Adapted from src_old/utils/helpers.ts generateThumbnail.
export const generateThumbnail = (
  source: HTMLImageElement | HTMLVideoElement,
  isVideo = false,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("2d context unavailable"));
      return;
    }

    const draw = (media: HTMLImageElement | HTMLVideoElement) => {
      try {
        const mediaW =
          (media as HTMLImageElement).naturalWidth ||
          (media as HTMLVideoElement).videoWidth ||
          300;
        const mediaH =
          (media as HTMLImageElement).naturalHeight ||
          (media as HTMLVideoElement).videoHeight ||
          200;

        const maxDimension = 256;
        let targetW = mediaW;
        let targetH = mediaH;
        if (mediaW > maxDimension || mediaH > maxDimension) {
          if (mediaW > mediaH) {
            targetW = maxDimension;
            targetH = Math.round((mediaH * maxDimension) / mediaW);
          } else {
            targetH = maxDimension;
            targetW = Math.round((mediaW * maxDimension) / mediaH);
          }
        }

        canvas.width = targetW;
        canvas.height = targetH;
        ctx.drawImage(media, 0, 0, mediaW, mediaH, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("thumbnail failed"));
      }
    };

    if (isVideo) {
      const v = source as HTMLVideoElement;
      const onLoad = () => {
        cleanup();
        draw(v);
      };
      const onError = () => {
        cleanup();
        reject(new Error("failed to load video for thumbnail"));
      };
      const cleanup = () => {
        v.removeEventListener("loadeddata", onLoad);
        v.removeEventListener("error", onError);
      };
      if (v.readyState >= 2) draw(v);
      else {
        v.addEventListener("loadeddata", onLoad);
        v.addEventListener("error", onError);
      }
    } else {
      const img = source as HTMLImageElement;
      const onLoad = () => {
        cleanup();
        draw(img);
      };
      const onError = () => {
        cleanup();
        reject(new Error("failed to load image for thumbnail"));
      };
      const cleanup = () => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      };
      if (img.complete && img.naturalWidth > 0) draw(img);
      else {
        img.addEventListener("load", onLoad);
        img.addEventListener("error", onError);
      }
    }
  });
};
