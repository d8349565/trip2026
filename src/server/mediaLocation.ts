import { z } from 'zod';
import { wgs84ToGcj02 } from '../utils/coords';

const coordinateSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  coordinateSystem: z.enum(['WGS84', 'GCJ02']),
  source: z.enum(['exif', 'xmp', 'browser', 'manual']),
  accuracyM: z.coerce.number().finite().nonnegative().optional(),
  observedAt: z.iso.datetime().optional(),
});

export interface NormalizedMediaLocation {
  sourceLatitude: number;
  sourceLongitude: number;
  sourceCoordinateSystem: 'WGS84' | 'GCJ02';
  locationSource: 'exif' | 'xmp' | 'browser' | 'manual';
  locationAccuracyM?: number;
  locationObservedAt?: string;
  exifLatitude?: number;
  exifLongitude?: number;
  displayLatitude: number;
  displayLongitude: number;
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * 规范化照片位置载荷。
 *
 * 兼容旧版 lat/lng；旧载荷按 EXIF WGS84 解释。新载荷必须显式携带来源与坐标系。
 */
export function normalizeMediaLocation(input: unknown): NormalizedMediaLocation | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const source = input as Record<string, unknown>;
  const rawLatitude = present(source.latitude) ? source.latitude : source.lat;
  const rawLongitude = present(source.longitude) ? source.longitude : source.lng;
  const hasLatitude = present(rawLatitude);
  const hasLongitude = present(rawLongitude);

  if (!hasLatitude && !hasLongitude) return undefined;
  if (!hasLatitude || !hasLongitude) {
    throw new Error('照片位置必须同时包含纬度和经度');
  }

  const parsed = coordinateSchema.parse({
    latitude: rawLatitude,
    longitude: rawLongitude,
    coordinateSystem: source.coordinate_system ?? 'WGS84',
    source: source.location_source ?? 'exif',
    accuracyM: source.location_accuracy_m,
    observedAt: source.location_observed_at,
  });
  if (parsed.latitude === 0 && parsed.longitude === 0) {
    throw new Error('照片位置不能为 0,0');
  }

  const display = parsed.coordinateSystem === 'WGS84'
    ? wgs84ToGcj02(parsed.latitude, parsed.longitude)
    : { latitude: parsed.latitude, longitude: parsed.longitude };
  const isEmbeddedMetadata = parsed.source === 'exif' || parsed.source === 'xmp';

  return {
    sourceLatitude: parsed.latitude,
    sourceLongitude: parsed.longitude,
    sourceCoordinateSystem: parsed.coordinateSystem,
    locationSource: parsed.source,
    locationAccuracyM: parsed.accuracyM,
    locationObservedAt: parsed.observedAt,
    exifLatitude: isEmbeddedMetadata ? parsed.latitude : undefined,
    exifLongitude: isEmbeddedMetadata ? parsed.longitude : undefined,
    displayLatitude: display.latitude,
    displayLongitude: display.longitude,
  };
}
