export interface MapFocusCoordinate {
  latitude?: number;
  longitude?: number;
}

export interface ResolvedMapFocus {
  latitude: number;
  longitude: number;
}

/**
 * 返回第一个有效的高优先级地图焦点。
 *
 * 调用方按业务优先级传入：待上传照片、已上传照片确认、地点编辑。
 */
export function resolveMapFocus(
  ...candidates: Array<MapFocusCoordinate | null | undefined>
): ResolvedMapFocus | undefined {
  for (const candidate of candidates) {
    if (
      Number.isFinite(candidate?.latitude)
      && Number.isFinite(candidate?.longitude)
      && Math.abs(candidate?.latitude as number) <= 90
      && Math.abs(candidate?.longitude as number) <= 180
    ) {
      return {
        latitude: candidate?.latitude as number,
        longitude: candidate?.longitude as number,
      };
    }
  }
  return undefined;
}

export function shouldFitAllPlacesInitially(
  markerCount: number,
  priorityFocus?: ResolvedMapFocus,
): boolean {
  return markerCount > 0 && !priorityFocus;
}

/**
 * 根据地点包围盒直接计算初始视野（中心 + 缩放级别）。
 * 避免用「质心 + 固定缩放」导致多点分散时落在空白区域。
 */
export function computeFitView(
  places: Array<{ latitude: number; longitude: number }>,
  width: number,
  height: number,
): { center: [number, number]; zoom: number } | undefined {
  const valid = places.filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (valid.length === 0 || width <= 0 || height <= 0) return undefined;
  const lats = valid.map((p) => p.latitude);
  const lngs = valid.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  if (valid.length === 1) return { center, zoom: 13 };
  const TILE = 256;
  const margin = 0.72; // 留出边距，避免点贴边
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const zoomByLng = Math.log2((360 * width * margin) / (TILE * lngSpan));
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const ySpan = Math.abs(mercY(maxLat) - mercY(minLat));
  const zoomByLat = ySpan > 0
    ? Math.log2((2 * Math.PI * height * margin) / (TILE * ySpan))
    : Number.POSITIVE_INFINITY;
  const zoom = Math.max(3, Math.min(15, Math.floor(Math.min(zoomByLng, zoomByLat) * 2) / 2));
  return { center, zoom };
}
