import assert from 'node:assert/strict';
import test from 'node:test';
import type { Media, Place } from '../src/types';
import {
  clusterPlaces,
  selectClusterRepresentative,
  summarizePlaceMedia,
} from '../src/utils/mapClusters';

function place(id: string, latitude: number, longitude: number): Place {
  return {
    id,
    name: id,
    category_id: 'scenic',
    latitude,
    longitude,
    coordinate_system: 'GCJ02',
    address: '',
    status: 'want_to_go',
    visibility: 'shared',
    favorite: false,
    recommended: false,
    created_by: 'u1',
    created_at: '2026-07-26T00:00:00.000Z',
    updated_at: '2026-07-26T00:00:00.000Z',
  };
}

function photo(id: string, placeId: string, createdAt: string): Media {
  return {
    id,
    user_id: 'u1',
    file_path: `/uploads/${id}.jpg`,
    thumbnail_path: `/uploads/${id}-thumb.jpg`,
    file_hash: id,
    file_size: 100,
    place_id: placeId,
    favorite: false,
    visibility: 'shared',
    created_at: createdAt,
  };
}

test('低缩放级别聚合相邻地点并保留远处地点', () => {
  const result = clusterPlaces([
    place('a', 28.2278, 112.9388),
    place('b', 28.2280, 112.9390),
    place('c', 23.1291, 113.2644),
  ], 7);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((cluster) => cluster.places.map((item) => item.id).sort()).sort(),
    [['a', 'b'], ['c']],
  );
});

test('高缩放级别始终返回可精确点击的单地点标记', () => {
  const result = clusterPlaces([
    place('a', 28.2278, 112.9388),
    place('b', 28.22781, 112.93881),
  ], 14);

  assert.equal(result.length, 2);
  assert.ok(result.every((cluster) => cluster.places.length === 1));
});

test('小数级放大只能保持或拆分聚合，不能把原本分开的地点重新合并', () => {
  const scaleAtZoom7 = 256 * 2 ** 7;
  const longitudeAtWorldPixel = (x: number) => x / scaleAtZoom7 * 360 - 180;
  const places = [
    place('a', 0, longitudeAtWorldPixel(72 * 0.99)),
    place('b', 0, longitudeAtWorldPixel(72 * 1.01)),
  ];

  const beforeZoom = clusterPlaces(places, 7);
  const afterZoom = clusterPlaces(places, 7.1375);
  const parentByPlace = new Map(
    beforeZoom.flatMap((cluster, parentIndex) => (
      cluster.places.map((item) => [item.id, parentIndex] as const)
    )),
  );

  for (const cluster of afterZoom) {
    const parentClusters = new Set(cluster.places.map((item) => parentByPlace.get(item.id)));
    assert.equal(parentClusters.size, 1, '放大后出现跨父聚合的重新组合');
  }
});

test('聚合标记选择照片最多地点并使用其最新缩略图', () => {
  const places = [
    { ...place('a', 28.2278, 112.9388), cover_image: '/covers/a.jpg' },
    place('b', 28.2280, 112.9390),
    place('c', 28.2282, 112.9392),
  ];
  const summaries = summarizePlaceMedia(places, [
    photo('a1', 'a', '2026-07-24T00:00:00.000Z'),
    photo('b1', 'b', '2026-07-23T00:00:00.000Z'),
    photo('b2', 'b', '2026-07-25T00:00:00.000Z'),
    photo('c1', 'c', '2026-07-26T00:00:00.000Z'),
  ]);

  const representative = selectClusterRepresentative(places, summaries);

  assert.equal(representative?.place.id, 'b');
  assert.equal(representative?.media.photoCount, 2);
  assert.equal(representative?.media.coverUrl, '/uploads/b2-thumb.jpg');
});

test('照片数量相同时优先选择有封面的地点', () => {
  const places = [
    place('a', 28.2278, 112.9388),
    { ...place('b', 28.2280, 112.9390), cover_image: '/covers/b.jpg' },
  ];
  const summaries = summarizePlaceMedia(places, []);

  const representative = selectClusterRepresentative(places, summaries);

  assert.equal(representative?.place.id, 'b');
  assert.equal(representative?.media.coverUrl, '/covers/b.jpg');
});
