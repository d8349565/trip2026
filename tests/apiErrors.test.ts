import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, api } from '../src/api';

test('request-based API methods reject structured non-2xx responses', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource no longer exists',
      details: { id: 'missing' },
    },
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

  const operations: Array<[string, () => Promise<unknown>]> = [
    ['getCurrentUser', () => api.getCurrentUser()],
    ['login', () => api.login('test-user', 'test-password')],
    ['registerByInvite', () => api.registerByInvite('test-user', 'test-password', 'test-invite')],
    ['getSessionUser', () => api.getSessionUser()],
    ['sessionLogin', () => api.sessionLogin('test-user', 'test-password')],
    ['sessionRegister', () => api.sessionRegister('test-user', 'test-password', 'test-invite')],
    ['logout', () => api.logout()],
    ['searchMapPoi', () => api.searchMapPoi('test')],
    ['reverseGeocode', () => api.reverseGeocode(39.9, 116.4)],
    ['locateByIp', () => api.locateByIp()],
    ['resolveMapShare', () => api.resolveMapShare('https://example.com/map')],
    ['getMapMarkers', () => api.getMapMarkers()],
    ['getPlaces', () => api.getPlaces()],
    ['createPlace', () => api.createPlace({ name: 'test' })],
    ['updatePlace', () => api.updatePlace('missing', { name: 'test' })],
    ['toggleFavorite', () => api.toggleFavorite('missing')],
    ['toggleVisited', () => api.toggleVisited('missing')],
    ['addToTrip', () => api.addToTrip('missing', { trip_day_id: 'missing' })],
    ['getTrips', () => api.getTrips()],
    ['createTrip', () => api.createTrip({ title: 'test' })],
    ['getTripDetails', () => api.getTripDetails('missing')],
    ['getTripDetailsBatch', () => api.getTripDetailsBatch(['missing'])],
    ['updateTrip', () => api.updateTrip('missing', { title: 'test' })],
    ['updateTripDay', () => api.updateTripDay('missing', {})],
    ['createTripItem', () => api.createTripItem('missing', {})],
    ['updateTripItem', () => api.updateTripItem('missing', {})],
    ['getMedia', () => api.getMedia()],
    ['probePhotoMetadata', () => api.probePhotoMetadata(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))],
    ['uploadMedia', () => api.uploadMedia({ filename: 'test.jpg', file_size: 4, dataUrl: 'data:image/jpeg;base64,dGVzdA==' })],
    ['updateMedia', () => api.updateMedia('missing', {})],
    ['getChecklists', () => api.getChecklists()],
    ['getChecklistDetails', () => api.getChecklistDetails('missing')],
    ['getChecklistDetailsBatch', () => api.getChecklistDetailsBatch(['missing'])],
    ['createChecklist', () => api.createChecklist({ title: 'test' })],
    ['createChecklistFromTemplate', () => api.createChecklistFromTemplate({ title: 'test', template_type: 'basic' })],
    ['createChecklistItem', () => api.createChecklistItem('missing', {})],
    ['updateChecklistItem', () => api.updateChecklistItem('missing', {})],
    ['getGuides', () => api.getGuides()],
    ['getGuideDetails', () => api.getGuideDetails('missing')],
    ['createGuide', () => api.createGuide({ title: 'test' })],
    ['updateGuide', () => api.updateGuide('missing', { title: 'test' })],
    ['getVisits', () => api.getVisits()],
    ['createVisit', () => api.createVisit({ place_id: 'missing' })],
    ['getBackups', () => api.getBackups()],
    ['createBackup', () => api.createBackup()],
    ['restoreBackup', () => api.restoreBackup('missing')],
    ['getCapacity', () => api.getCapacity()],
    ['getInvites', () => api.getInvites()],
    ['getAdminUsers', () => api.getAdminUsers()],
    ['createAdminUser', () => api.createAdminUser({ username: 'test-user', password: 'test-password' })],
    ['updateAdminUser', () => api.updateAdminUser('missing', { is_active: false })],
    ['resetAdminUserPassword', () => api.resetAdminUserPassword('missing', 'test-password')],
    ['createInvite', () => api.createInvite({ max_uses: 1 })],
  ];

  for (const [name, operation] of operations) {
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof ApiError, `${name} should reject with ApiError`);
      assert.equal(error.status, 404, `${name} should preserve the response status`);
      assert.equal(error.code, 'RESOURCE_NOT_FOUND', `${name} should preserve the error code`);
      assert.equal(error.message, 'Resource no longer exists', `${name} should preserve the error message`);
      assert.deepEqual(error.details, { id: 'missing' }, `${name} should preserve error details`);
      return true;
    }, `${name} should reject non-2xx responses`);
  }
});

test('API errors retain legacy string messages and degrade safely for non-JSON responses', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Legacy request failed' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(api.getPlaces(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, 'REQUEST_FAILED');
    assert.equal(error.message, 'Legacy request failed');
    return true;
  });

  globalThis.fetch = async () => new Response('Bad gateway', { status: 502 });
  await assert.rejects(api.getPlaces(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.code, 'REQUEST_FAILED');
    assert.equal(error.message, 'Request failed');
    return true;
  });
});

test('request-based API methods preserve JSON and bodyless success contracts', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const places = [{ id: 'place-1', name: 'Test place' }];
  globalThis.fetch = async () => Response.json(places);
  assert.deepEqual(await api.getPlaces(), places);

  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api.logout(), undefined);
  assert.equal(await api.resetAdminUserPassword('user-1', 'test-password'), undefined);
});

test('boolean API methods throw on failure and accept empty success responses', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const operations: Array<[string, () => Promise<boolean>]> = [
    ['deletePlace', () => api.deletePlace('missing')],
    ['deleteTrip', () => api.deleteTrip('missing')],
    ['deleteTripItem', () => api.deleteTripItem('missing')],
    ['reorderTripItems', () => api.reorderTripItems([{ id: 'missing', sort_order: 0 }])],
    ['deleteMedia', () => api.deleteMedia('missing')],
    ['deleteChecklistItem', () => api.deleteChecklistItem('missing')],
    ['deleteGuide', () => api.deleteGuide('missing')],
    ['deleteBackup', () => api.deleteBackup('missing')],
  ];

  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 'CONFLICT', message: 'Resource changed elsewhere' },
  }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  });

  for (const [name, operation] of operations) {
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof ApiError, `${name} should reject with ApiError`);
      assert.equal(error.status, 409);
      assert.equal(error.code, 'CONFLICT');
      return true;
    }, `${name} should reject non-2xx responses`);
  }

  globalThis.fetch = async () => new Response(null, { status: 204 });
  for (const [name, operation] of operations) {
    assert.equal(await operation(), true, `${name} should accept a bodyless success response`);
  }
});
