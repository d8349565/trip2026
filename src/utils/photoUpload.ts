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
import { api } from '../api';
import type { MediaUploadInput } from '../types';

export interface PreparedPhoto {
  fileName: string;
  fileSize: number; // original file size, kept for records
  dataUrl: string;  // compressed JPEG data URL safe to upload
  exif: PhotoExif;
}

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

export interface PreparePhotoOptions {
  /**
   * 仅用于“刚刚拍照”入口。历史相册照片禁止自动套用上传时的位置。
   */
  allowBrowserLocationFallback?: boolean;
}

export function isHeicPhoto(file: Pick<File, 'name' | 'type'>): boolean {
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || /\.(?:heic|heif)$/i.test(file.name);
}

async function convertHeicToJpeg(file: File): Promise<File> {
  // heic2any creates a Web Worker as soon as its module is evaluated, so keep
  // it out of server-side and test-module loading paths.
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: JPEG_QUALITY,
  });
  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  if (!convertedBlob) throw new Error('HEIC 图片转换失败');

  const baseName = file.name.replace(/\.(?:heic|heif)$/i, '') || 'photo';
  return new File([convertedBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

type PhotoLocationFields = Pick<MediaUploadInput,
  'latitude' | 'longitude' | 'coordinate_system' | 'location_source'
  | 'location_accuracy_m' | 'location_observed_at'
  | 'metadata_status' | 'metadata_parser' | 'metadata_error_code'>;

function metadataDiagnosticFields(
  value: Pick<PhotoExif, 'metadataStatus' | 'metadataParser' | 'metadataErrorCode'>,
): PhotoLocationFields {
  const fields: PhotoLocationFields = {};
  if (value.metadataStatus) fields.metadata_status = value.metadataStatus;
  if (value.metadataParser) fields.metadata_parser = value.metadataParser;
  if (value.metadataErrorCode) fields.metadata_error_code = value.metadataErrorCode;
  return fields;
}

export function photoLocationFields(
  exif: PhotoExif,
): PhotoLocationFields {
  const diagnostics = metadataDiagnosticFields(exif);
  if (!Number.isFinite(exif.latitude) || !Number.isFinite(exif.longitude) || !exif.source) {
    return diagnostics;
  }
  return {
    ...diagnostics,
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
  metadataStatus?: PhotoExif['metadataStatus'];
  metadataParser?: PhotoExif['metadataParser'];
  metadataErrorCode?: string;
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
      ...metadataDiagnosticFields(original),
      latitude: confirmed?.latitude,
      longitude: confirmed?.longitude,
      coordinate_system: 'GCJ02',
      location_source: 'manual',
      location_observed_at: new Date().toISOString(),
    };
  }

  if (!hasOriginalWgs) {
    return metadataDiagnosticFields(original);
  }
  return {
    ...metadataDiagnosticFields(original),
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

  if (exif.latitude === undefined) {
    try {
      const serverMetadata = await api.probePhotoMetadata(file);
      exif.metadataStatus = serverMetadata.status;
      exif.metadataParser = serverMetadata.parser;
      exif.metadataErrorCode = serverMetadata.errorCode;
      exif.capturedAt ??= serverMetadata.capturedAt;
      if (
        serverMetadata.status === 'found'
        && Number.isFinite(serverMetadata.latitude)
        && Number.isFinite(serverMetadata.longitude)
        && serverMetadata.source
      ) {
        exif.latitude = serverMetadata.latitude;
        exif.longitude = serverMetadata.longitude;
        exif.source = serverMetadata.source;
      }
    } catch {
      exif.metadataStatus = 'probe_unavailable';
      exif.metadataParser = 'server-exifr';
      exif.metadataErrorCode = 'METADATA_PROBE_UNAVAILABLE';
    }
  }

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

  // Chrome and many Android browsers cannot decode HEIC in an HTMLImageElement.
  // Convert only after reading EXIF from the original, because conversion strips it.
  const uploadFile = isHeicPhoto(file) ? await convertHeicToJpeg(file) : file;
  const dataUrl = await compressToDataUrl(uploadFile);
  return { fileName: uploadFile.name, fileSize: file.size, dataUrl, exif };
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
