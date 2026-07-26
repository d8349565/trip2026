import type { Place } from '../types';

export interface PlaceCluster {
  key: string;
  latitude: number;
  longitude: number;
  places: Place[];
}

function worldPixel(latitude: number, longitude: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sin = Math.max(-0.9999, Math.min(0.9999, Math.sin(latitude * Math.PI / 180)));
  return {
    x: (longitude + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * 按 Web Mercator 屏幕网格聚合地点。高缩放级别保持单点，避免影响精确选择。
 */
export function clusterPlaces(
  places: Place[],
  zoom: number,
  gridSize = 72,
): PlaceCluster[] {
  if (zoom >= 14) {
    return places.map((place) => ({
      key: `place:${place.id}`,
      latitude: place.latitude,
      longitude: place.longitude,
      places: [place],
    }));
  }

  const buckets = new Map<string, Place[]>();
  for (const place of places) {
    const pixel = worldPixel(place.latitude, place.longitude, zoom);
    const key = `${Math.floor(pixel.x / gridSize)}:${Math.floor(pixel.y / gridSize)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(place);
    else buckets.set(key, [place]);
  }

  return [...buckets.entries()].map(([key, items]) => ({
    key: `cluster:${zoom}:${key}`,
    latitude: items.reduce((sum, place) => sum + place.latitude, 0) / items.length,
    longitude: items.reduce((sum, place) => sum + place.longitude, 0) / items.length,
    places: items,
  }));
}
