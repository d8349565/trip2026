import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateDistanceKm } from '../src/utils/distance';
import { formatMediaDate, groupMediaByDate, sortMediaByDateDesc } from '../src/utils/mediaTimeline';
import MobileBottomNav from '../src/components/mobile/MobileBottomNav';
import MobileCreateSheet from '../src/components/mobile/MobileCreateSheet';
import MobileMapPage from '../src/components/mobile/MobileMapPage';
import MobileTripOverviewPage from '../src/components/mobile/MobileTripOverviewPage';
import MobileTodayTripPage from '../src/components/mobile/MobileTodayTripPage';
import { formatPlaceRating, mergeVisitRatings } from '../src/utils/placeRating';
import { getDefaultTripDateRange, isValidTripDateRange } from '../src/utils/tripDates';
import type { Media, Place, Visit, Trip, TripDay, TripItem } from '../src/types';

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

test('mobile map moves search/filter/profile to a top bar and keeps three thumb-zone controls', () => {
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
    onOpenProfile: () => {},
    profileLabel: '',
    immersive: false,
    onImmersiveChange: () => {},
    categoryColors: {},
    categoryLabels: {},
    categoryIcons: {},
  } as unknown as React.ComponentProps<typeof MobileMapPage>;

  const html = renderToStaticMarkup(React.createElement(MobileMapPage, props));
  // 顶部操作栏：搜索/筛选/我的
  assert.match(html, /id="m_btn_open_search"/);
  assert.match(html, /id="m_btn_open_filter"/);
  assert.match(html, /id="m_btn_open_profile"/);
  // 拇指区：沉浸/显示全部/定位
  assert.match(html, /id="m_btn_immersive"/);
  assert.match(html, /id="m_btn_show_all"/);
  assert.match(html, /id="m_btn_locate"/);
  assert.match(html, /bottom-\[calc\(4\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(html, /aria-label="打开地图搜索"/);
  assert.match(html, /aria-label="打开地图筛选"/);
  assert.match(html, /aria-label="进入沉浸"/);
  assert.match(html, /aria-label="显示全部地点"/);
  assert.match(html, /aria-label="定位到当前位置"/);
  assert.doesNotMatch(html, /id="m_btn_open_actions"/);
  assert.doesNotMatch(html, /id="m_btn_fullscreen"/);
  assert.doesNotMatch(html, /id="m_cat_all"/);
  // 非沉浸态不应出现退出胶囊
  assert.doesNotMatch(html, /退出沉浸/);
});

test('mobile map immersive mode hides top bar and shows an exit capsule', () => {
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
    onOpenProfile: () => {},
    profileLabel: '',
    immersive: true,
    onImmersiveChange: () => {},
    categoryColors: {},
    categoryLabels: {},
    categoryIcons: {},
  } as unknown as React.ComponentProps<typeof MobileMapPage>;

  const html = renderToStaticMarkup(React.createElement(MobileMapPage, props));
  // 沉浸态：退出胶囊常驻，顶栏按钮隐藏，退出沉浸按钮 aria
  assert.match(html, /退出沉浸/);
  assert.doesNotMatch(html, /id="m_btn_open_search"/);
  assert.doesNotMatch(html, /id="m_btn_open_filter"/);
  assert.doesNotMatch(html, /id="m_btn_open_profile"/);
  assert.match(html, /aria-label="退出沉浸"/);
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

test('mobile trip overview renames sub-tabs and renders day map and reorder buttons', () => {
  const trip: Trip = {
    id: 't1', title: '测试行程', start_date: '2026-09-01', end_date: '2026-09-03',
    origin: '广州', destination_summary: '潮州', travel_mode: 'drive', participants: '',
    status: 'upcoming', visibility: 'shared', created_by: 'u1',
    created_at: '', updated_at: '',
  } as Trip;
  const day: TripDay = {
    id: 'd1', trip_id: 't1', day_number: 1, date: '2026-09-01', title: '第 1 天行程',
  } as TripDay;
  const place: Place = {
    id: 'p1', name: '龙潭溪', category_id: 'stream', latitude: 28.5, longitude: 113.9,
    coordinate_system: 'GCJ02', address: '湖南', status: 'want_to_go', visibility: 'shared',
    favorite: false, recommended: false, created_by: 'u1', created_at: '', updated_at: '',
  } as Place;
  const item: TripItem = {
    id: 'i1', trip_day_id: 'd1', type: 'play', place_id: 'p1', title: '龙潭溪',
    priority: 'must', status: 'pending', sort_order: 1,
  } as TripItem;

  const html = renderToStaticMarkup(React.createElement(MobileTripOverviewPage, {
    trips: [trip],
    allDays: [day],
    allItems: [item],
    places: [place],
    activeTrip: trip,
    onSelectTrip: () => {},
    onDeleteTrip: () => {},
    onCreateTrip: () => {},
    onUpdateTripDay: () => {},
    onAddTripItem: () => {},
    onDeleteTripItem: () => {},
    onReorderTripItems: () => {},
  }));
  assert.match(html, /日程编排/);
  assert.match(html, /行程管理/);
  assert.doesNotMatch(html, /全部日程/);
  assert.doesNotMatch(html, /规划总览/);
  assert.match(html, /当日行程路线地图/);
  assert.match(html, /aria-label="上移"/);
  assert.match(html, /aria-label="下移"/);
});

test('mobile today trip page shows countdown for upcoming trip', () => {
  const future = new Date();
  future.setDate(future.getDate() + 5);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const trip: Trip = {
    id: 't1', title: '未来行程', start_date: fmt(future), end_date: fmt(new Date(future.getTime() + 86400000 * 2)),
    origin: '', destination_summary: '', travel_mode: 'drive', participants: '',
    status: 'upcoming', visibility: 'shared', created_by: 'u1',
    created_at: '', updated_at: '',
  } as Trip;
  const day: TripDay = {
    id: 'd1', trip_id: 't1', day_number: 1, date: fmt(future), title: '第 1 天行程',
  } as TripDay;
  const html = renderToStaticMarkup(React.createElement(MobileTodayTripPage, {
    activeTrip: trip,
    activeDay: day,
    items: [],
    places: [],
    onUpdateItemStatus: () => {},
    onNavigateToPlace: () => {},
    onOpenTripSelector: () => {},
    onOpenCreateTrip: () => {},
    onOpenDaySelector: () => {},
    allDays: [day],
  }));
  assert.match(html, /距出发还有/);
});
