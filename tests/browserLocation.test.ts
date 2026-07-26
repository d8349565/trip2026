import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBestBrowserLocation,
  type BrowserLocationResult,
} from '../src/utils/browserLocation';

function position(latitude: number, longitude: number, accuracy: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

function fakeGeolocation(
  run: (
    success: (value: GeolocationPosition) => void,
    error: (value: GeolocationPositionError) => void,
  ) => void,
) {
  let cleared = false;
  return {
    watchPosition(
      success: (value: GeolocationPosition) => void,
      error: (value: GeolocationPositionError) => void,
    ) {
      queueMicrotask(() => run(success, error));
      return 7;
    },
    clearWatch(id: number) {
      assert.equal(id, 7);
      cleared = true;
    },
    wasCleared: () => cleared,
  };
}

test('非安全上下文不会请求浏览器定位', async () => {
  let called = false;
  const geolocation = fakeGeolocation(() => {
    called = true;
  });
  const result = await getBestBrowserLocation({ secureContext: false, geolocation });
  assert.deepEqual(result, { ok: false, reason: 'insecure-context' });
  assert.equal(called, false);
});

test('连续采样会选择达到目标精度的位置并停止监听', async () => {
  const geolocation = fakeGeolocation((success) => {
    success(position(30, 120, 240));
    success(position(30.1, 120.1, 18));
  });
  const result = await getBestBrowserLocation({
    secureContext: true,
    geolocation,
    timeoutMs: 100,
  });
  assert.equal(result.ok, true);
  assert.equal((result as Extract<BrowserLocationResult, { ok: true }>).fix.accuracyM, 18);
  assert.equal(geolocation.wasCleared(), true);
});

test('超时后拒绝超过最大阈值的粗略位置', async () => {
  const geolocation = fakeGeolocation((success) => {
    success(position(30, 120, 260));
  });
  const result = await getBestBrowserLocation({
    secureContext: true,
    geolocation,
    timeoutMs: 5,
    maxAcceptedAccuracyM: 100,
  });
  assert.equal(result.ok, false);
  assert.equal((result as Extract<BrowserLocationResult, { ok: false }>).reason, 'low-accuracy');
});
