import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMediaLocation } from '../src/server/mediaLocation';

test('旧版 EXIF WGS84 载荷保持兼容并转换为高德展示坐标', () => {
  const result = normalizeMediaLocation({ lat: 30.2741, lng: 120.1551 });
  assert.equal(result?.locationSource, 'exif');
  assert.equal(result?.sourceCoordinateSystem, 'WGS84');
  assert.equal(result?.exifLatitude, 30.2741);
  assert.notEqual(result?.displayLatitude, 30.2741);
  assert.notEqual(result?.displayLongitude, 120.1551);
});

test('浏览器定位保留来源和精度，不伪装成 EXIF', () => {
  const result = normalizeMediaLocation({
    latitude: 30.2741,
    longitude: 120.1551,
    coordinate_system: 'WGS84',
    location_source: 'browser',
    location_accuracy_m: 22,
    location_observed_at: '2026-07-26T08:00:00.000Z',
  });
  assert.equal(result?.locationSource, 'browser');
  assert.equal(result?.locationAccuracyM, 22);
  assert.equal(result?.exifLatitude, undefined);
  assert.equal(result?.exifLongitude, undefined);
});

test('手动选择的 GCJ02 坐标不会被重复转换', () => {
  const result = normalizeMediaLocation({
    latitude: 30.28,
    longitude: 120.16,
    coordinate_system: 'GCJ02',
    location_source: 'manual',
  });
  assert.equal(result?.displayLatitude, 30.28);
  assert.equal(result?.displayLongitude, 120.16);
});

test('拒绝不完整或越界的位置载荷', () => {
  assert.throws(() => normalizeMediaLocation({ latitude: 30 }), /同时包含纬度和经度/);
  assert.throws(
    () => normalizeMediaLocation({ latitude: 95, longitude: 120 }),
    /Too big|less than or equal to 90/i,
  );
});
