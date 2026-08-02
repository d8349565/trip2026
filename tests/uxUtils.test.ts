import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDistanceKm } from '../src/utils/distance';
import { formatMediaDate, groupMediaByDate, sortMediaByDateDesc } from '../src/utils/mediaTimeline';
import { getDefaultTripDateRange, isValidTripDateRange } from '../src/utils/tripDates';
import type { Media } from '../src/types';

function media(id: string, capturedAt: string): Media {
  return {
    id,
    user_id: 'user-1',
    file_path: `/uploads/${id}.jpg`,
    thumbnail_path: `/uploads/${id}.jpg`,
    file_hash: id,
    file_size: 1,
    captured_at: capturedAt,
    favorite: false,
    visibility: 'private',
    created_at: capturedAt,
  };
}

test('PC and mobile share descending photo timeline order', () => {
  const items = [media('old', '2026-07-04T08:00:00.000Z'), media('new', '2026-07-11T08:00:00.000Z'), media('middle', '2026-07-05T08:00:00.000Z')];
  assert.deepEqual(sortMediaByDateDesc(items).map((item) => item.id), ['new', 'middle', 'old']);
  assert.deepEqual(groupMediaByDate(items).map((group) => group.dateKey), ['2026-07-11', '2026-07-05', '2026-07-04']);
});

test('timeline shows year when a photo is not from the current year', () => {
  assert.equal(formatMediaDate('2025-12-31', new Date('2026-08-01T00:00:00')), '2025年12月31日');
  assert.equal(formatMediaDate('2026-08-01', new Date('2026-08-01T00:00:00')), '8月1日');
});

test('trip defaults use the current local day and validate date order', () => {
  assert.deepEqual(getDefaultTripDateRange(new Date('2026-08-01T12:00:00')), {
    startDate: '2026-08-01',
    endDate: '2026-08-03',
  });
  assert.equal(isValidTripDateRange('2026-08-01', '2026-08-03'), true);
  assert.equal(isValidTripDateRange('2026-08-03', '2026-08-01'), false);
});

test('distance is only calculated from supplied coordinates', () => {
  assert.equal(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.equal(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }), 111.2);
  assert.equal(calculateDistanceKm({ latitude: Number.NaN, longitude: 0 }, { latitude: 1, longitude: 0 }), undefined);
});
