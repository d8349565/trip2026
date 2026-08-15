export interface MapFocusCoordinate {
  latitude?: number;
  longitude?: number;
}

export interface ResolvedMapFocus {
  latitude: number;
  longitude: number;
}

export interface FitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function getFitViewPadding(mobile: boolean): FitPadding {
  // 手机端：避开顶部浮动按钮、右侧控件列，底部留拇指区
  return mobile
    ? { top: 120, right: 76, bottom: 96, left: 48 }
    : { top: 72, right: 72, bottom: 72, left: 72 };
}

export function getPlaceBounds(
  places: Array<{ latitude: number; longitude: number }>,
): { southWest: [number, number]; northEast: [number, number] } | undefined {
  const valid = places.filter(
    (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
  );
  if (valid.length === 0) return undefined;

  return {
    southWest: [
      Math.min(...valid.map((place) => place.longitude)),
      Math.min(...valid.map((place) => place.latitude)),
    ],
    northEast: [
      Math.max(...valid.map((place) => place.longitude)),
      Math.max(...valid.map((place) => place.latitude)),
    ],
  };
}

const TILE_SIZE = 256;

function mercatorY(latitude: number): number {
  const sin = Math.max(-0.9999, Math.min(0.9999, Math.sin((latitude * Math.PI) / 180)));
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function latitudeFromMercatorY(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/**
 * 纯 Web Mercator 数学计算「显示全部」视野：包围盒完整落入内边距盒内的最大整数 zoom + 对应中心。
 * 不依赖 AMap 黑盒 API（getFitZoomAndCenterByBounds 真机不应用 avoid 边距），参数完全可控、可单测。
 */
export function computeBoundsFitView(
  places: Array<{ latitude: number; longitude: number }>,
  width: number,
  height: number,
  padding: FitPadding,
  maxZoom = 15,
): { center: [number, number]; zoom: number } | undefined {
  const valid = places.filter(
    (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
  );
  if (valid.length === 0 || width <= 0 || height <= 0) return undefined;

  const lats = valid.map((place) => place.latitude);
  const lngs = valid.map((place) => place.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const innerWidth = Math.max(width - padding.left - padding.right, 1);
  const innerHeight = Math.max(height - padding.top - padding.bottom, 1);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const ySpan = Math.max(mercatorY(minLat) - mercatorY(maxLat), 1e-9);

  const zoomByLng = Math.log2((360 * innerWidth) / (TILE_SIZE * lngSpan));
  const zoomByLat = Math.log2(innerHeight / (TILE_SIZE * ySpan));
  // 0.5 级取整：比整数级更贴边距盒，且 AMap 2.0 支持小数 zoom（聚合展开已在用）
  const zoom = Math.max(3, Math.min(maxZoom, Math.floor(Math.min(zoomByLng, zoomByLat) * 2) / 2));

  const scale = TILE_SIZE * 2 ** zoom;
  const boundsCenterX = ((minLng + maxLng) / 2 + 180) / 360 * scale;
  const boundsCenterY = (mercatorY(maxLat) + mercatorY(minLat)) / 2 * scale;
  // 包围盒中心要对准内边距盒中心 => 地图中心按边距差的一半偏移
  const centerX = boundsCenterX + (padding.right - padding.left) / 2;
  const centerY = boundsCenterY + (padding.bottom - padding.top) / 2;

  return {
    center: [(centerX / scale) * 360 - 180, latitudeFromMercatorY(centerY / scale)],
    zoom,
  };
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
