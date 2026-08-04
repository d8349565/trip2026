import assert from 'node:assert/strict';
import test from 'node:test';
import { AMAP_TRAVEL_STYLE } from '../src/components/MapContainer';

test('地图使用标准底图，以保留河流与溪流等水系参照', () => {
  assert.equal(AMAP_TRAVEL_STYLE, 'amap://styles/normal');
});
