import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveMapFocus,
  shouldFitAllPlacesInitially,
} from '../src/utils/mapViewport';

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
