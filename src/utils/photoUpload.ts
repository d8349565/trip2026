/**
 * Shared client-side photo preparation for upload.
 *
 * Both the desktop gallery and the mobile timeline must compress the image
 * before upload: the server accepts a JSON body capped at 10 MB, and raw
 * phone photos base64-encoded routinely exceed that. EXIF GPS is read from the
 * original file first because canvas re-encoding strips it.
 */

import { getBestBrowserLocation } from './browserLocation';
import { readPhotoExif, type PhotoExif } from './photoExif';
import type { MediaUploadInput } from '../types';

export interface PreparedPhoto {
  fileName: string;
  fileSize: number; // original file size, kept for records
  dataUrl: string;  // compressed JPEG data URL safe to upload
  exif: PhotoExif;
}

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

export interface PreparePhotoOptions {
  /**
   * 仅用于“刚刚拍照”入口。历史相册照片禁止自动套用上传时的位置。
   */
  allowBrowserLocationFallback?: boolean;
}

type PhotoLocationFields = Pick<MediaUploadInput,
  'latitude' | 'longitude' | 'coordinate_system' | 'location_source'
  | 'location_accuracy_m' | 'location_observed_at'>;

export function photoLocationFields(
  exif: PhotoExif,
): PhotoLocationFields {
  if (!Number.isFinite(exif.latitude) || !Number.isFinite(exif.longitude) || !exif.source) return {};
  return {
    latitude: exif.latitude,
    longitude: exif.longitude,
    coordinate_system: 'WGS84',
    location_source: exif.source,
    location_accuracy_m: exif.accuracyM,
    location_observed_at: exif.observedAt,
  };
}

interface PendingPhotoLocation {
  wgsLat?: number;
  wgsLng?: number;
  gcjLat?: number;
  gcjLng?: number;
  locationSource?: 'exif' | 'xmp' | 'browser';
  locationAccuracyM?: number;
  locationObservedAt?: string;
}

/**
 * 保存地图确认后的照片位置：
 * - 标记未移动时保留原始 WGS84 及 EXIF/XMP/浏览器来源；
 * - 无原始坐标或用户已拖动标记时，保存确认后的 GCJ02 手动坐标。
 */
export function confirmedPhotoLocationFields(
  original: PendingPhotoLocation,
  confirmed?: { latitude?: number; longitude?: number },
): PhotoLocationFields {
  const hasOriginalWgs = Number.isFinite(original.wgsLat) && Number.isFinite(original.wgsLng);
  const hasOriginalGcj = Number.isFinite(original.gcjLat) && Number.isFinite(original.gcjLng);
  const hasConfirmed = Number.isFinite(confirmed?.latitude) && Number.isFinite(confirmed?.longitude);
  const confirmedChanged = hasConfirmed && (
    !hasOriginalGcj
    || Math.abs((confirmed?.latitude as number) - (original.gcjLat as number)) > 1e-7
    || Math.abs((confirmed?.longitude as number) - (original.gcjLng as number)) > 1e-7
  );

  if (confirmedChanged) {
    return {
      latitude: confirmed?.latitude,
      longitude: confirmed?.longitude,
      coordinate_system: 'GCJ02',
      location_source: 'manual',
      location_observed_at: new Date().toISOString(),
    };
  }

  if (!hasOriginalWgs) return {};
  return {
    latitude: original.wgsLat,
    longitude: original.wgsLng,
    coordinate_system: 'WGS84',
    location_source: original.locationSource,
    location_accuracy_m: original.locationAccuracyM,
    location_observed_at: original.locationObservedAt,
  };
}

/**
 * Read EXIF (GPS + capture time) from the original file, then downscale and
 * re-encode to JPEG so the payload stays well under the server limit.
 * 仅当调用方明确表明照片刚拍摄时，才允许使用浏览器当前位置回退。
 */
export async function preparePhotoForUpload(
  file: File,
  options: PreparePhotoOptions = {},
): Promise<PreparedPhoto> {
  // EXIF must be read before any re-encoding — canvas output has no GPS block.
  const exif = await readPhotoExif(file);

  if (exif.latitude === undefined && options.allowBrowserLocationFallback) {
    const location = await getBestBrowserLocation();
    if (location.ok) {
      exif.latitude = location.fix.latitude;
      exif.longitude = location.fix.longitude;
      exif.source = 'browser';
      exif.accuracyM = location.fix.accuracyM;
      exif.observedAt = location.fix.observedAt;
    } else {
      exif.locationFailure = 'reason' in location ? location.reason : 'position-unavailable';
    }
  }

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
