// Adapted from src_old/utils/helpers.ts generateThumbnail.
export const generateThumbnail = (
  source: HTMLImageElement | HTMLVideoElement,
  isVideo = false,
): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const draw = (media: HTMLImageElement | HTMLVideoElement) => {
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
    };

    if (isVideo) {
      const v = source as HTMLVideoElement;
      if (v.readyState >= 2) draw(v);
      else v.onloadeddata = () => draw(v);
    } else {
      const img = source as HTMLImageElement;
      if (img.complete) draw(img);
      else img.onload = () => draw(img);
    }
  });
};
