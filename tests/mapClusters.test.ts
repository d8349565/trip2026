import assert from 'node:assert/strict';
import test from 'node:test';
import type { Place } from '../src/types';
import { clusterPlaces } from '../src/utils/mapClusters';

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
