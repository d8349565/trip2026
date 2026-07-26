/**
 * Read GPS location and capture time from a photo's EXIF/XMP metadata before
 * the client compresses the image (canvas re-encoding strips all EXIF).
 *
 * Returned coordinates are WGS84 — the server converts them to GCJ-02 for
 * display on the AMap map.
 */

import exifr from 'exifr';
import type { BrowserLocationFailureReason } from './browserLocation';

export interface PhotoExif {
  latitude?: number;
  longitude?: number;
  capturedAt?: string; // ISO 8601
  source?: 'exif' | 'xmp' | 'browser';
  accuracyM?: number;
  observedAt?: string;
  locationFailure?: BrowserLocationFailureReason;
}

function isValidGps(gps: { latitude?: number; longitude?: number } | undefined | null): gps is { latitude: number; longitude: number } {
  return !!gps
    && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)
    && Math.abs(gps.latitude!) <= 90 && Math.abs(gps.longitude!) <= 180
    && (gps.latitude !== 0 || gps.longitude !== 0);
}

/**
 * 从原始文件中读取 GPS 和拍摄日期。
 *
 * 策略：
 * 1. exifr.gps() 快捷方法（firstChunkSize=40KB，适合标准 JPEG EXIF）
 * 2. 完整解析（不限 chunk 大小，覆盖 XMP GPS 和大偏移 GPS IFD）
 * 3. 调用方可选：仅对刚拍摄的照片显式启用浏览器定位回退
 */
export async function readPhotoExif(file: File): Promise<PhotoExif> {
  const result: PhotoExif = {};

  // 策略 1：exifr.gps() 快捷方法（PC 端标准 JPEG 走这里最快）
  try {
    const gps = await exifr.gps(file);
    if (isValidGps(gps)) {
      result.latitude = gps.latitude;
      result.longitude = gps.longitude;
      result.source = 'exif';
    }
  } catch {
    // fast path failed, continue to full parse
  }

  // 策略 2：完整解析，不限制 firstChunkSize，覆盖 XMP 和大偏移 GPS IFD。
  // exifr.gps() 内部 gpsOnlyOptions 有 firstChunkSize=40000 且 ifd0=false，
  // 对大文件或安卓"包含位置信息"写入 XMP 的情况会漏读。
  if (result.latitude === undefined) {
    try {
      const parsed = await exifr.parse(file, {
        tiff: true,
        ifd1: false,
        exif: true,
        gps: true,
        interop: false,
        xmp: true,
        mergeOutput: false,
        // 关键：覆盖 gpsOnlyOptions 的 40KB 限制，读取完整元数据
        firstChunkSize: 1024 * 1024,
      });

      // 检查 gps 子对象（标准 EXIF GPS IFD）
      const gps = parsed?.gps;
      if (isValidGps(gps)) {
        result.latitude = gps.latitude;
        result.longitude = gps.longitude;
        result.source = 'exif';
      }

      // 检查 XMP 中的 GPS（安卓"包含位置信息"常写入此处）
      if (result.latitude === undefined && parsed?.xmp) {
        const xmp = parsed.xmp as Record<string, unknown>;
        const xmpGps = {
          latitude: Number(xmp.GPSLatitude ?? xmp.latitude ?? xmp.lat ?? NaN),
          longitude: Number(xmp.GPSLongitude ?? xmp.longitude ?? xmp.lng ?? NaN),
        };
        if (isValidGps(xmpGps)) {
          result.latitude = xmpGps.latitude;
          result.longitude = xmpGps.longitude;
          result.source = 'xmp';
        }
      }

      // 顺便从完整解析中提取日期（避免额外一次 parse 调用）
      const exifBlock = parsed?.exif as Record<string, unknown> | undefined;
      const ifd0Block = parsed?.ifd0 as Record<string, unknown> | undefined;
      const dateValue = exifBlock?.DateTimeOriginal ?? exifBlock?.CreateDate
        ?? ifd0Block?.ModifyDate ?? ifd0Block?.DateTimeOriginal;
      const date = dateValue instanceof Date ? dateValue
        : typeof dateValue === 'string' ? new Date(dateValue) : undefined;
      if (date && !Number.isNaN(date.getTime())) result.capturedAt = date.toISOString();
    } catch {
      // Full parse failed — fall through to date-only parse
    }
  }

  // 读取拍摄日期（如果策略 2 没拿到）
  if (!result.capturedAt) {
    try {
      const dates = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
      const value = dates?.DateTimeOriginal ?? dates?.CreateDate ?? dates?.ModifyDate;
      const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
      if (date && !Number.isNaN(date.getTime())) result.capturedAt = date.toISOString();
    } catch {
      // No readable capture time — keep the user-provided date.
    }
  }

  return result;
}
