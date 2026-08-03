import type { Media, Place } from '../types';
import { pickLatestPhoto } from './placeCover';

export interface PlaceCluster {
  key: string;
  latitude: number;
  longitude: number;
  places: Place[];
}

export interface PlaceMediaSummary {
  photoCount: number;
  coverUrl?: string;
}

export interface ClusterRepresentative {
  place: Place;
  media: PlaceMediaSummary;
}

/**
 * 一次遍历生成地点照片摘要，供地图单点和聚合点共同使用。
 * 显式封面优先；未设置封面时回退到最近上传照片的缩略图。
 */
export function summarizePlaceMedia(
  places: Place[],
  media: Media[],
): Map<string, PlaceMediaSummary> {
  const mediaByPlace = new Map<string, Media[]>();
  for (const item of media) {
    if (!item.place_id) continue;
    const items = mediaByPlace.get(item.place_id);
    if (items) items.push(item);
    else mediaByPlace.set(item.place_id, [item]);
  }

  return new Map(places.map((place) => {
    const photos = mediaByPlace.get(place.id) ?? [];
    const latestPhoto = pickLatestPhoto(photos);
    return [place.id, {
      photoCount: photos.length,
      coverUrl: place.cover_image || latestPhoto?.thumbnail_path || latestPhoto?.file_path || undefined,
    }];
  }));
}

/**
 * 聚合点以照片数量最多的地点作为视觉代表。
 * 数量相同时优先选择拥有可用封面的地点，并保持原始地点顺序稳定。
 */
export function selectClusterRepresentative(
  places: Place[],
  summaries: ReadonlyMap<string, PlaceMediaSummary>,
): ClusterRepresentative | undefined {
  let representative: ClusterRepresentative | undefined;
  for (const place of places) {
    const media = summaries.get(place.id) ?? { photoCount: 0 };
    if (
      !representative
      || media.photoCount > representative.media.photoCount
      || (
        media.photoCount === representative.media.photoCount
        && Boolean(media.coverUrl)
        && !representative.media.coverUrl
      )
    ) {
      representative = { place, media };
    }
  }
  return representative;
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
 * 按 Web Mercator 屏幕距离聚合地点。高缩放级别保持单点，避免影响精确选择。
 *
 * 空间网格只用于缩小邻居搜索范围，最终是否合并由真实屏幕距离决定。
 * 因此放大地图时连接关系只会保持或断开，不会因跨越网格边界而重新组合。
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

  const points = places.map((place) => ({
    place,
    ...worldPixel(place.latitude, place.longitude, zoom),
  }));
  const parents = points.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  const cells = new Map<string, number[]>();
  points.forEach((point, index) => {
    const cellX = Math.floor(point.x / gridSize);
    const cellY = Math.floor(point.y / gridSize);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighbours = cells.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
        for (const neighbourIndex of neighbours) {
          const neighbour = points[neighbourIndex];
          const deltaX = point.x - neighbour.x;
          const deltaY = point.y - neighbour.y;
          if (deltaX * deltaX + deltaY * deltaY <= gridSize * gridSize) {
            union(index, neighbourIndex);
          }
        }
      }
    }
    const cellKey = `${cellX}:${cellY}`;
    const cell = cells.get(cellKey);
    if (cell) cell.push(index);
    else cells.set(cellKey, [index]);
  });

  const groups = new Map<number, Place[]>();
  points.forEach(({ place }, index) => {
    const root = find(index);
    const group = groups.get(root);
    if (group) group.push(place);
    else groups.set(root, [place]);
  });

  return [...groups.values()].map((items) => {
    const memberKey = items.map((place) => place.id).sort().join(',');
    return {
      key: items.length === 1 ? `place:${items[0].id}` : `cluster:${memberKey}`,
      latitude: items.reduce((sum, place) => sum + place.latitude, 0) / items.length,
      longitude: items.reduce((sum, place) => sum + place.longitude, 0) / items.length,
      places: items,
    };
  });
}
