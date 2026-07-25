/**
 * Read GPS location and capture time from a photo's EXIF data before the
 * client compresses the image (canvas re-encoding strips EXIF).
 *
 * Returned coordinates are WGS84 — the server converts them to GCJ-02 for
 * display on the AMap map.
 */

import exifr from 'exifr';

export interface PhotoExif {
  latitude?: number;
  longitude?: number;
  capturedAt?: string; // ISO 8601
}

export async function readPhotoExif(file: File): Promise<PhotoExif> {
  const result: PhotoExif = {};
  try {
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)
      && Math.abs(gps.latitude) <= 90 && Math.abs(gps.longitude) <= 180
      && (gps.latitude !== 0 || gps.longitude !== 0)) {
      result.latitude = gps.latitude;
      result.longitude = gps.longitude;
    }
  } catch {
    // No readable GPS block — treat the photo as having no location.
  }
  try {
    const dates = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
    const value = dates?.DateTimeOriginal ?? dates?.CreateDate ?? dates?.ModifyDate;
    const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
    if (date && !Number.isNaN(date.getTime())) result.capturedAt = date.toISOString();
  } catch {
    // No readable capture time — keep the user-provided date.
  }
  return result;
}
