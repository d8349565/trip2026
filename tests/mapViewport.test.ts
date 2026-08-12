import assert from 'node:assert/strict';
import test from 'node:test';
import { clusterPlaces } from '../src/utils/mapClusters';
import {
  getPlaceBounds,
  getFitViewPadding,
  resolveMapFocus,
  shouldFitAllPlacesInitially,
} from '../src/utils/mapViewport';
import type { Place } from '../src/types';

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
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
  };
}

test('照片确认坐标优先于地点编辑坐标', () => {
  const focus = resolveMapFocus(
    { latitude: 28.2278, longitude: 112.9388 },
    { latitude: 23.1291, longitude: 113.2644 },
  );

  assert.deepEqual(focus, { latitude: 28.2278, longitude: 112.9388 });
});

test('存在照片或编辑焦点时禁止首次显示全部地点', () => {
  const focus = resolveMapFocus({ latitude: 28.2278, longitude: 112.9388 });

  assert.equal(shouldFitAllPlacesInitially(8, focus), false);
  assert.equal(shouldFitAllPlacesInitially(8), true);
});

test('无效坐标不会阻止普通地图首次显示全部地点', () => {
  const focus = resolveMapFocus(
    { latitude: undefined, longitude: 112.9388 },
    { latitude: 91, longitude: 113 },
  );

  assert.equal(focus, undefined);
  assert.equal(shouldFitAllPlacesInitially(3, focus), true);
});

test('显示全部使用真实地点边界，不受低缩放聚合中心影响', () => {
  const places = [place('west', 30, 110), place('east', 30, 114)];
  const clusters = clusterPlaces(places, 4);

  assert.equal(clusters.length, 1);
  assert.deepEqual(getPlaceBounds(places), {
    southWest: [110, 30],
    northEast: [114, 30],
  });
});

test('手机端显示全部比原视野多留少量边距', () => {
  assert.deepEqual(getFitViewPadding(true), [168, 48, 136, 48]);
  assert.deepEqual(getFitViewPadding(false), [72, 72, 72, 72]);
});
