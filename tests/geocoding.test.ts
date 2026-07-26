import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GeocodingError,
  GeocodingService,
  type GeocodingProvider,
  type PoiSearchInput,
  type ReverseGeocodeInput,
} from '../src/server/geocoding';

class FakeProvider implements GeocodingProvider {
  readonly name: string;
  poiCalls = 0;
  reverseCalls = 0;

  constructor(
    name: string,
    private readonly fail = false,
  ) {
    this.name = name;
  }

  async searchPoi(input: PoiSearchInput): Promise<Record<string, unknown>> {
    this.poiCalls += 1;
    if (this.fail) throw new GeocodingError('GEOCODER_UPSTREAM_UNAVAILABLE', `${this.name} unavailable`);
    return { provider: this.name, keywords: input.keywords };
  }

  async reverseGeocode(input: ReverseGeocodeInput): Promise<Record<string, unknown>> {
    this.reverseCalls += 1;
    if (this.fail) throw new GeocodingError('GEOCODER_UPSTREAM_UNAVAILABLE', `${this.name} unavailable`);
    return { provider: this.name, location: `${input.longitude},${input.latitude}` };
  }
}

test('逆地理编码按米级坐标缓存成功结果', async () => {
  const provider = new FakeProvider('primary');
  const service = new GeocodingService([provider]);

  const first = await service.reverseGeocode({ latitude: 28.2278001, longitude: 112.9388001 });
  const second = await service.reverseGeocode({ latitude: 28.2278002, longitude: 112.9388002 });

  assert.deepEqual(second, first);
  assert.equal(provider.reverseCalls, 1);
});

test('主提供方失败后调用下一个降级提供方', async () => {
  const primary = new FakeProvider('primary', true);
  const fallback = new FakeProvider('local-city');
  const service = new GeocodingService([primary, fallback]);

  const result = await service.searchPoi({ keywords: '长沙' });

  assert.equal(result.provider, 'local-city');
  assert.equal(primary.poiCalls, 1);
  assert.equal(fallback.poiCalls, 1);
});

test('缓存过期后重新查询提供方', async () => {
  let now = 1_000;
  const provider = new FakeProvider('primary');
  const service = new GeocodingService([provider], {
    now: () => now,
    reverseTtlMs: 100,
  });

  await service.reverseGeocode({ latitude: 28.2, longitude: 112.9 });
  now += 101;
  await service.reverseGeocode({ latitude: 28.2, longitude: 112.9 });

  assert.equal(provider.reverseCalls, 2);
});
