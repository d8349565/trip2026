import exifr from 'exifr';
import { z } from 'zod';
import type { Media, PhotoMetadataProbeResult } from '../types';

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.webp',
]);

const metadataDiagnosticsSchema = z.object({
  metadata_status: z.enum([
    'found',
    'not_found',
    'unsupported',
    'parse_error',
    'probe_unavailable',
  ]).optional(),
  metadata_parser: z.enum(['client-exifr', 'server-exifr']).optional(),
  metadata_error_code: z.string().trim().min(1).max(64).regex(/^[A-Z0-9_:-]+$/).optional(),
});

export function normalizePhotoMetadataDiagnostics(
  input: unknown,
): Pick<Media, 'metadata_status' | 'metadata_parser' | 'metadata_error_code'> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return metadataDiagnosticsSchema.parse(input);
}

function isValidGps(value: unknown): value is { latitude: number; longitude: number } {
  if (!value || typeof value !== 'object') return false;
  const gps = value as { latitude?: unknown; longitude?: unknown };
  return Number.isFinite(gps.latitude)
    && Number.isFinite(gps.longitude)
    && Math.abs(gps.latitude as number) <= 90
    && Math.abs(gps.longitude as number) <= 180
    && (gps.latitude !== 0 || gps.longitude !== 0);
}

function parseXmpCoordinate(value: unknown, negativeRef: 'S' | 'W'): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toUpperCase();
  const numbers = normalized.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!numbers?.length || numbers.some((item) => !Number.isFinite(item))) return undefined;

  const sign = normalized.includes(negativeRef) || numbers[0] < 0 ? -1 : 1;
  const absoluteDegrees = Math.abs(numbers[0]);
  const decimal = absoluteDegrees
    + (numbers[1] ?? 0) / 60
    + (numbers[2] ?? 0) / 3600;
  return sign * decimal;
}

function readDate(value: unknown): string | undefined {
  const date = value instanceof Date
    ? value
    : typeof value === 'string' ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
}

function isSupportedPhoto(contentType: string | undefined, filename: string | undefined): boolean {
  if (contentType?.toLowerCase().startsWith('image/')) return true;
  if (!filename) return contentType === 'application/octet-stream';
  const dot = filename.lastIndexOf('.');
  return dot >= 0 && SUPPORTED_EXTENSIONS.has(filename.slice(dot).toLowerCase());
}

/**
 * 从浏览器实际提供的原始文件字节中解析 EXIF/XMP。
 *
 * 文件只在请求内存中存在，不保存原图；调用方仅在客户端解析不到 GPS 时使用。
 */
export async function extractPhotoMetadata(
  input: Uint8Array,
  options: { contentType?: string; filename?: string } = {},
): Promise<PhotoMetadataProbeResult> {
  if (!isSupportedPhoto(options.contentType, options.filename)) {
    return {
      status: 'unsupported',
      parser: 'server-exifr',
      errorCode: 'UNSUPPORTED_IMAGE_TYPE',
    };
  }
  if (input.byteLength === 0) {
    return {
      status: 'parse_error',
      parser: 'server-exifr',
      errorCode: 'EMPTY_IMAGE',
    };
  }

  let parseSucceeded = false;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let source: 'exif' | 'xmp' | undefined;
  let capturedAt: string | undefined;

  try {
    const gps = await exifr.gps(input);
    parseSucceeded = true;
    if (isValidGps(gps)) {
      latitude = gps.latitude;
      longitude = gps.longitude;
      source = 'exif';
    }
  } catch {
    // Continue with a full metadata parse; some Android files place GPS in XMP.
  }

  try {
    const parsed = await exifr.parse(input, {
      tiff: true,
      ifd1: false,
      exif: true,
      gps: true,
      interop: false,
      xmp: true,
      mergeOutput: false,
      firstChunkSize: input.byteLength,
    });
    parseSucceeded = true;

    if (latitude === undefined && isValidGps(parsed?.gps)) {
      latitude = parsed.gps.latitude;
      longitude = parsed.gps.longitude;
      source = 'exif';
    }

    if (latitude === undefined && parsed?.xmp) {
      const xmp = parsed.xmp as Record<string, unknown>;
      const xmpGps = {
        latitude: parseXmpCoordinate(
          xmp.GPSLatitude ?? xmp.latitude ?? xmp.lat,
          'S',
        ),
        longitude: parseXmpCoordinate(
          xmp.GPSLongitude ?? xmp.longitude ?? xmp.lng,
          'W',
        ),
      };
      if (isValidGps(xmpGps)) {
        latitude = xmpGps.latitude;
        longitude = xmpGps.longitude;
        source = 'xmp';
      }
    }

    const exifBlock = parsed?.exif as Record<string, unknown> | undefined;
    const ifd0Block = parsed?.ifd0 as Record<string, unknown> | undefined;
    capturedAt = readDate(
      exifBlock?.DateTimeOriginal
      ?? exifBlock?.CreateDate
      ?? ifd0Block?.ModifyDate
      ?? ifd0Block?.DateTimeOriginal,
    );
  } catch {
    // The status below distinguishes an unreadable file from a readable file without GPS.
  }

  if (latitude !== undefined && longitude !== undefined && source) {
    return {
      status: 'found',
      parser: 'server-exifr',
      latitude,
      longitude,
      capturedAt,
      source,
    };
  }

  return {
    status: parseSucceeded ? 'not_found' : 'parse_error',
    parser: 'server-exifr',
    capturedAt,
    errorCode: parseSucceeded ? 'GPS_METADATA_NOT_FOUND' : 'METADATA_PARSE_FAILED',
  };
}
