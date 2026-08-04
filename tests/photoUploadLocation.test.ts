import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedPhotoLocationFields, isHeicPhoto } from '../src/utils/photoUpload';

test('HEIC/HEIF 照片按 MIME 或扩展名识别，以便在上传前转换为 JPEG', () => {
  assert.equal(isHeicPhoto({ name: 'iphone.heic', type: 'image/heic' }), true);
  assert.equal(isHeicPhoto({ name: 'iphone.heif', type: '' }), true);
  assert.equal(isHeicPhoto({ name: 'photo.jpg', type: 'image/jpeg' }), false);
});

test('未移动照片标记时保留原始 EXIF WGS84 来源', () => {
  const result = confirmedPhotoLocationFields({
    wgsLat: 23.123,
    wgsLng: 113.321,
    gcjLat: 23.1204,
    gcjLng: 113.3262,
    locationSource: 'exif',
  }, {
    latitude: 23.1204,
    longitude: 113.3262,
  });

  assert.deepEqual(result, {
    latitude: 23.123,
    longitude: 113.321,
    coordinate_system: 'WGS84',
    location_source: 'exif',
    location_accuracy_m: undefined,
    location_observed_at: undefined,
  });
});

test('拖动照片标记后保存确认过的 GCJ02 手动位置', () => {
  const result = confirmedPhotoLocationFields({
    wgsLat: 23.123,
    wgsLng: 113.321,
    gcjLat: 23.1204,
    gcjLng: 113.3262,
    locationSource: 'exif',
  }, {
    latitude: 23.121,
    longitude: 113.327,
  });

  assert.equal(result.latitude, 23.121);
  assert.equal(result.longitude, 113.327);
  assert.equal(result.coordinate_system, 'GCJ02');
  assert.equal(result.location_source, 'manual');
  assert.match(result.location_observed_at ?? '', /^\d{4}-\d{2}-\d{2}T/);
});

test('无 EXIF 照片手动选点后也会保存位置', () => {
  const result = confirmedPhotoLocationFields({}, {
    latitude: 31.2304,
    longitude: 121.4737,
  });

  assert.equal(result.latitude, 31.2304);
  assert.equal(result.longitude, 121.4737);
  assert.equal(result.coordinate_system, 'GCJ02');
  assert.equal(result.location_source, 'manual');
});
