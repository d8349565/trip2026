import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateDistanceKm } from '../src/utils/distance';
import { formatMediaDate, groupMediaByDate, sortMediaByDateDesc } from '../src/utils/mediaTimeline';
import MobileBottomNav from '../src/components/mobile/MobileBottomNav';
import MobileCreateSheet from '../src/components/mobile/MobileCreateSheet';
import MobileMapPage from '../src/components/mobile/MobileMapPage';
import { formatPlaceRating, mergeVisitRatings } from '../src/utils/placeRating';
import { getDefaultTripDateRange, isValidTripDateRange } from '../src/utils/tripDates';
import type { Media, Place, Visit } from '../src/types';

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

test('visit ratings are merged into place previews as the average score', () => {
  const place: Place = {
    id: 'place-1',
    name: '测试地点',
    category_id: 'scenic',
    latitude: 28,
    longitude: 113,
    coordinate_system: 'GCJ02',
    address: '长沙',
    status: 'visited',
    visibility: 'private',
    favorite: false,
    recommended: false,
    created_by: 'user-1',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };
  const visits: Pick<Visit, 'place_id' | 'rating'>[] = [
    { place_id: place.id, rating: 4 },
    { place_id: place.id, rating: 2 },
  ];

  assert.equal(mergeVisitRatings([place], visits)[0].rating, 3);
});

test('place rating display tolerates null database values', () => {
  assert.equal(formatPlaceRating(null), '未评分');
  assert.equal(formatPlaceRating(undefined), '未评分');
  assert.equal(formatPlaceRating(4), '4.0');
});

test('mobile map groups four icon-only controls in the lower-right thumb zone', () => {
  const props = {
    places: [],
    media: [],
    selectedPlace: null,
    onSelectPlace: () => {},
    onViewPlaceDetails: () => {},
    onCreatePlace: async () => ({}) as Place,
    onUpdatePlace: async () => ({}) as Place,
    onDeletePlace: async () => {},
    onRequestEditor: () => {},
    editorRequest: 0,
    editRequest: null,
    photoDraft: null,
    onPhotoDraftEnd: () => {},
    onToggleFavorite: () => {},
    onAddToTrip: () => {},
    categoryColors: {},
    categoryLabels: {},
    categoryIcons: {},
  } as unknown as React.ComponentProps<typeof MobileMapPage>;

  const html = renderToStaticMarkup(React.createElement(MobileMapPage, props));
  assert.match(html, /id="m_btn_open_search"/);
  assert.match(html, /id="m_btn_open_filter"/);
  assert.match(html, /id="m_btn_show_all"/);
  assert.match(html, /id="m_btn_locate"/);
  assert.match(html, /bottom-\[calc\(4\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(html, /aria-label="打开地图搜索"/);
  assert.match(html, /aria-label="打开地图筛选"/);
  assert.match(html, /aria-label="显示全部地点"/);
  assert.match(html, /aria-label="定位到当前位置"/);
  assert.doesNotMatch(html, /id="m_btn_open_actions"/);
  assert.doesNotMatch(html, /id="m_btn_fullscreen"/);
  assert.doesNotMatch(html, /id="m_cat_all"/);
});

test('mobile bottom navigation keeps checklist reachable and moves profile out of the tab bar', () => {
  const html = renderToStaticMarkup(React.createElement(MobileBottomNav, {
    currentView: 'map',
    onViewChange: () => {},
    onOpenCreate: () => {},
  }));

  assert.match(html, /id="m_nav_map"/);
  assert.match(html, /id="m_nav_trip"/);
  assert.match(html, /id="m_nav_plus"/);
  assert.match(html, /id="m_nav_checklist"/);
  assert.match(html, /id="m_nav_photos"/);
  assert.doesNotMatch(html, /id="m_nav_profile"/);
});

test('mobile create sheet only exposes actions that start an immediate creation flow', () => {
  const html = renderToStaticMarkup(React.createElement(MobileCreateSheet, {
    isOpen: true,
    onClose: () => {},
    onAction: () => {},
  }));

  assert.match(html, /id="m_act_place"/);
  assert.match(html, /id="m_act_photo"/);
  assert.match(html, /id="m_act_visit"/);
  assert.doesNotMatch(html, /id="m_act_trip"/);
  assert.doesNotMatch(html, /id="m_act_checklist"/);
  assert.doesNotMatch(html, /id="m_act_guide"/);
});
