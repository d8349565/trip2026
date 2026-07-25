/**
 * Shared client-side photo preparation for upload.
 *
 * Both the desktop gallery and the mobile timeline must compress the image
 * before upload: the server accepts a JSON body capped at 10 MB, and raw
 * phone photos base64-encoded routinely exceed that. EXIF GPS is read from the
 * original file first because canvas re-encoding strips it.
 */

import { readPhotoExif, type PhotoExif } from './photoExif';

export interface PreparedPhoto {
  fileName: string;
  fileSize: number; // original file size, kept for records
  dataUrl: string;  // compressed JPEG data URL safe to upload
  exif: PhotoExif;
}

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

/**
 * Read EXIF (GPS + capture time) from the original file, then downscale and
 * re-encode to JPEG so the payload stays well under the server limit.
 */
export async function preparePhotoForUpload(file: File): Promise<PreparedPhoto> {
  // EXIF must be read before any re-encoding — canvas output has no GPS block.
  const exif = await readPhotoExif(file);
  const dataUrl = await compressToDataUrl(file);
  return { fileName: file.name, fileSize: file.size, dataUrl, exif };
}

function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
