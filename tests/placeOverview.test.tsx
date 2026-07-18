import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaceDetailPane from '../src/components/PlaceDetailPane';
import type { Place } from '../src/types';

const place: Place = {
  id: 'place-without-overview',
  name: '未填写概览的测试地点',
  category_id: 'scenic',
  latitude: 28.136,
  longitude: 114.105,
  coordinate_system: 'GCJ02',
  address: '测试地址',
  status: 'want_to_go',
  visibility: 'shared',
  favorite: false,
  recommended: false,
  created_by: 'user-1',
  created_at: '2026-07-18T00:00:00.000Z',
  updated_at: '2026-07-18T00:00:00.000Z',
};

test('未录入地点概览时不展示分类模板伪数据', () => {
  const html = renderToStaticMarkup(
    <PlaceDetailPane
      place={place}
      trips={[]}
      tripDays={[]}
      tripItems={[]}
      media={[]}
      guides={[]}
      visits={[]}
      onClose={() => undefined}
      onToggleFavorite={() => undefined}
      onToggleVisited={() => undefined}
      onAddToTrip={() => undefined}
      categoryColors={{ scenic: { bg: '', text: '', iconBg: '', border: '' } }}
      categoryLabels={{ scenic: '景点' }}
    />,
  );

  assert.doesNotMatch(html, /古城文化漫游导览路线/);
  assert.match(html, /尚未录入地点概览/);
});
