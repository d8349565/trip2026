import assert from 'node:assert/strict';
import test from 'node:test';
import { clusterPlaces } from '../src/utils/mapClusters';
import {
  computeBoundsFitView,
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

test('手机端显示全部边距避开顶部浮钮与右侧控件列', () => {
  const mobile = getFitViewPadding(true);
  const desktop = getFitViewPadding(false);
  assert.equal(mobile.top > mobile.bottom, true);
  assert.equal(mobile.right > mobile.left, true);
  assert.deepEqual(desktop, { top: 72, right: 72, bottom: 72, left: 72 });
});

// 线上 15 个真实地点坐标（2026-08-15 飞雨截图回归用例）
const realPlaces = [
  [28.730798, 113.840859], [28.637672, 114.006959], [28.583554, 113.903528],
  [28.530732, 113.192302], [28.45776, 114.015366], [28.457672, 113.936896],
  [28.430676, 114.165507], [28.421686, 114.08911], [28.420393, 114.140828],
  [28.406377, 113.59331], [28.396564, 114.048054], [28.343692, 113.684229],
  [28.012648, 113.092092], [27.918007, 113.538865], [27.613036, 114.031192],
].map(([latitude, longitude], index) => place(`real-${index}`, latitude, longitude));

function project(latitude: number, longitude: number, zoom: number, center: [number, number], width: number, height: number) {
  const scale = 256 * 2 ** zoom;
  const toX = (lng: number) => ((lng + 180) / 360) * scale;
  const toY = (lat: number) => {
    const sin = Math.max(-0.9999, Math.min(0.9999, Math.sin((lat * Math.PI) / 180)));
    return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  };
  return {
    x: toX(longitude) - toX(center[0]) + width / 2,
    y: toY(latitude) - toY(center[1]) + height / 2,
  };
}

test('显示全部：真实地点全部落入内边距盒，不再贴边被裁', () => {
  const width = 390;
  const height = 844;
  const padding = getFitViewPadding(true);
  const fit = computeBoundsFitView(realPlaces, width, height, padding);

  assert.ok(fit);
  assert.ok(fit!.zoom >= 3 && fit!.zoom <= 15);
  assert.ok(Number.isInteger(fit!.zoom * 2));

  for (const p of realPlaces) {
    const { x, y } = project(p.latitude, p.longitude, fit!.zoom, fit!.center, width, height);
    assert.ok(x >= padding.left && x <= width - padding.right, `lng 越界: ${x}`);
    assert.ok(y >= padding.top && y <= height - padding.bottom, `lat 越界: ${y}`);
  }
});

test('显示全部：单点时回退合理 zoom 且中心即该点', () => {
  const fit = computeBoundsFitView([place('only', 28.2, 113.5)], 390, 844, getFitViewPadding(true));
  assert.ok(fit);
  assert.equal(fit!.zoom, 15);
  assert.ok(Math.abs(fit!.center[0] - 113.5) < 0.01);
  assert.ok(Math.abs(fit!.center[1] - 28.2) < 0.01);
});
