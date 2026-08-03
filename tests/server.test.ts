import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createGpsExifJpeg } from './fixtures/exifJpeg';

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-server-'));
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = dataPath;
process.env.APP_UPLOADS_DIR = path.join(dataPath, 'uploads');
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie');
  assert(header, 'Expected a Set-Cookie response header');
  return header.split(';', 1)[0];
}

test('health, authentication, session rotation, and API guards work', async (context) => {
  const { app, stopServer } = await import('../server');
  const server = app.listen(0, '127.0.0.1');
  context.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await stopServer('SIGTERM');
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    status: 'ok',
    environment: 'test',
    storage: 'sqlite',
    database_integrity: 'ok',
  });

  assert.equal((await fetch(`${baseUrl}/api/me`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/places`, { headers: { 'x-user-id': 'u_admin' } })).status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(loginResponse.status, 200);
  const loginBody = await loginResponse.json();
  assert.equal(loginBody.user.username, 'admin');
  assert.equal(loginBody.password_upgraded, true);
  const loginCookie = cookieFrom(loginResponse);

  const meResponse = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: loginCookie } });
  assert.equal(meResponse.status, 200);
  assert.equal((await meResponse.json()).user.role, 'admin');

  const amapShareResponse = await fetch(`${baseUrl}/api/map/share/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ url: 'https://uri.amap.com/marker?position=116.391,39.907&name=测试地点' }),
  });
  assert.equal(amapShareResponse.status, 200);
  assert.deepEqual(await amapShareResponse.json(), {
    latitude: 39.907,
    longitude: 116.391,
    name: '测试地点',
    provider: 'amap',
    sourceUrl: 'https://uri.amap.com/marker?position=116.391,39.907&name=%E6%B5%8B%E8%AF%95%E5%9C%B0%E7%82%B9',
  });

  const baiduShareResponse = await fetch(`${baseUrl}/api/map/share/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ url: 'https://api.map.baidu.com/marker?location=39.914,116.404&title=百度地点&output=html' }),
  });
  assert.equal(baiduShareResponse.status, 200);
  const baiduPoint = await baiduShareResponse.json();
  assert.equal(baiduPoint.provider, 'baidu');
  assert.equal(baiduPoint.name, '百度地点');
  assert(Math.abs(baiduPoint.latitude - 39.907) < 0.02);
  assert(Math.abs(baiduPoint.longitude - 116.397) < 0.02);

  const privatePlaceResponse = await fetch(`${baseUrl}/api/places`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({
      name: 'Admin private place',
      category_id: 'scenic',
      latitude: 23.2,
      longitude: 116.2,
      address: 'Private test data',
      visibility: 'private',
    }),
  });
  assert.equal(privatePlaceResponse.status, 200);
  const privatePlace = await privatePlaceResponse.json();

  const sharedPlaceResponse = await fetch(`${baseUrl}/api/places`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({
      name: 'Admin shared place',
      category_id: 'scenic',
      latitude: 23.3,
      longitude: 116.3,
      address: 'Shared test data',
      visibility: 'shared',
      overview_route: 'Walk from A to B',
      overview_tips: 'Leave before sunset',
      safety_notes: 'Bring water',
      packing_list: 'Water\nRaincoat',
      nearby_services: 'Fuel station 2km away',
    }),
  });
  assert.equal(sharedPlaceResponse.status, 200);
  const sharedPlace = await sharedPlaceResponse.json();
  assert.equal(sharedPlace.overview_route, 'Walk from A to B');
  assert.equal(sharedPlace.safety_notes, 'Bring water');
  assert.equal(sharedPlace.rating, undefined);
  assert.equal(sharedPlace.cover_image, undefined);

  const adminMapMarkers = await fetch(
    `${baseUrl}/api/map/markers?west=116&south=23&east=116.5&north=23.5`,
    { headers: { Cookie: loginCookie } },
  ).then((response) => response.json());
  assert.equal(adminMapMarkers.total, 2);
  assert.equal(adminMapMarkers.truncated, false);
  assert.deepEqual(
    adminMapMarkers.markers.map((marker: { name: string }) => marker.name).sort(),
    ['Admin private place', 'Admin shared place'],
  );
  assert.deepEqual(
    Object.keys(adminMapMarkers.markers[0]).sort(),
    ['category_id', 'favorite', 'id', 'latitude', 'longitude', 'name', 'photo_count', 'status'].sort(),
  );

  const registrationResponse = await fetch(`${baseUrl}/api/auth/register-by-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'member_test', password: 'member-password-123', inviteCode: 'TRIP2026' }),
  });
  assert.equal(registrationResponse.status, 201);
  const registeredMember = await registrationResponse.json();
  const memberCookie = cookieFrom(registrationResponse);

  const memberPlaces = await fetch(`${baseUrl}/api/places`, { headers: { Cookie: memberCookie } }).then((response) => response.json());
  assert.equal(memberPlaces.some((place: { id: string }) => place.id === privatePlace.id), false);
  const memberMapMarkers = await fetch(`${baseUrl}/api/map/markers`, {
    headers: { Cookie: memberCookie },
  }).then((response) => response.json());
  assert.equal(memberMapMarkers.markers.some((marker: { id: string }) => marker.id === privatePlace.id), false);
  assert.equal(memberMapMarkers.markers.some((marker: { id: string }) => marker.id === sharedPlace.id), true);
  assert.equal((await fetch(`${baseUrl}/api/places/${sharedPlace.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
    body: JSON.stringify({ name: 'Forbidden update' }),
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/invites`, { headers: { Cookie: memberCookie } })).status, 403);

  const memberFavorite = await fetch(`${baseUrl}/api/places/${sharedPlace.id}/favorite`, {
    method: 'POST',
    headers: { Cookie: memberCookie },
  });
  assert.equal(memberFavorite.status, 200);
  assert.equal((await memberFavorite.json()).favorite, true);
  const adminPlace = await fetch(`${baseUrl}/api/places/${sharedPlace.id}`, { headers: { Cookie: loginCookie } }).then((response) => response.json());
  assert.equal(adminPlace.favorite, false);

  const protectedFieldResponse = await fetch(`${baseUrl}/api/places/${sharedPlace.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ id: 'hacked-id', created_by: registeredMember.user.id, name: 'Allowed name update' }),
  });
  assert.equal(protectedFieldResponse.status, 200);
  const protectedFieldBody = await protectedFieldResponse.json();
  assert.equal(protectedFieldBody.id, sharedPlace.id);
  assert.equal(protectedFieldBody.created_by, 'u_admin');

  // Creating a visit must mark the place visited without a separate toggle, and a
  // later place edit must not wipe that per-user status via snapshot rewrite.
  const visitResponse = await fetch(`${baseUrl}/api/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({
      place_id: sharedPlace.id,
      visit_date: '2026-07-01',
      rating: 4,
      note: 'Great day out',
      revisit_intention: 'yes',
    }),
  });
  assert.equal(visitResponse.status, 200);
  const createdVisit = await visitResponse.json();
  assert.equal(createdVisit.place_id, sharedPlace.id);
  assert.equal(createdVisit.rating, 4);

  const placesAfterVisit = await fetch(`${baseUrl}/api/places`, { headers: { Cookie: loginCookie } })
    .then((response) => response.json());
  const visitedPlace = placesAfterVisit.find((place: { id: string }) => place.id === sharedPlace.id);
  assert.equal(visitedPlace?.status, 'visited');

  const renameAfterVisit = await fetch(`${baseUrl}/api/places/${sharedPlace.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ name: 'Renamed after visit' }),
  });
  assert.equal(renameAfterVisit.status, 200);
  assert.equal((await renameAfterVisit.json()).name, 'Renamed after visit');

  const placesAfterRename = await fetch(`${baseUrl}/api/places`, { headers: { Cookie: loginCookie } })
    .then((response) => response.json());
  const stillVisited = placesAfterRename.find((place: { id: string }) => place.id === sharedPlace.id);
  assert.equal(stillVisited?.status, 'visited');
  assert.equal(stillVisited?.name, 'Renamed after visit');

  // Owner favorite toggle + subsequent place edit must keep both favorite and visited.
  const ownerFavorite = await fetch(`${baseUrl}/api/places/${sharedPlace.id}/favorite`, {
    method: 'POST',
    headers: { Cookie: loginCookie },
  });
  assert.equal(ownerFavorite.status, 200);
  assert.equal((await ownerFavorite.json()).favorite, true);

  const summaryAfterFavorite = await fetch(`${baseUrl}/api/places/${sharedPlace.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ summary: 'Updated after favorite toggle' }),
  });
  assert.equal(summaryAfterFavorite.status, 200);
  const placeAfterStateEdits = await fetch(`${baseUrl}/api/places/${sharedPlace.id}`, {
    headers: { Cookie: loginCookie },
  }).then((response) => response.json());
  assert.equal(placeAfterStateEdits.favorite, true);
  assert.equal(placeAfterStateEdits.status, 'visited');
  assert.equal(placeAfterStateEdits.summary, 'Updated after favorite toggle');

  const mediaUploadResponse = await fetch(`${baseUrl}/api/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({
      filename: 'browser-location.jpg',
      file_size: 10,
      dataUrl: `data:image/jpeg;base64,${Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]).toString('base64')}`,
      latitude: 30.2741,
      longitude: 120.1551,
      coordinate_system: 'WGS84',
      location_source: 'browser',
      location_accuracy_m: 24,
      location_observed_at: '2026-07-26T08:00:00.000Z',
    }),
  });
  assert.equal(mediaUploadResponse.status, 200);
  const uploadedMedia = await mediaUploadResponse.json();
  assert.equal(uploadedMedia.location_source, 'browser');
  assert.equal(uploadedMedia.location_accuracy_m, 24);
  assert.equal(uploadedMedia.source_latitude, 30.2741);
  assert.equal(uploadedMedia.exif_latitude, undefined);
  assert.notEqual(uploadedMedia.display_longitude, 120.1551);

  const metadataProbeResponse = await fetch(`${baseUrl}/api/media/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Photo-Filename': encodeURIComponent('xiaomi-original.jpg'),
      Cookie: loginCookie,
    },
    body: createGpsExifJpeg(),
  });
  assert.equal(metadataProbeResponse.status, 200);
  const metadataProbe = await metadataProbeResponse.json();
  assert.equal(metadataProbe.status, 'found');
  assert.equal(metadataProbe.parser, 'server-exifr');
  assert.equal(metadataProbe.source, 'exif');
  assert.ok(Math.abs(metadataProbe.latitude - 30.2666666667) < 1e-8);
  assert.ok(Math.abs(metadataProbe.longitude - 120.155) < 1e-8);

  const invalidMediaLocationResponse = await fetch(`${baseUrl}/api/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({
      filename: 'invalid-location.jpg',
      dataUrl: `data:image/jpeg;base64,${Buffer.from('invalid-photo').toString('base64')}`,
      latitude: 30.2741,
    }),
  });
  assert.equal(invalidMediaLocationResponse.status, 400);
  assert.equal((await invalidMediaLocationResponse.json()).error.code, 'INVALID_MEDIA_LOCATION');

  const invalidTripResponse = await fetch(`${baseUrl}/api/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ title: 'Invalid trip', start_date: '2026-08-10', end_date: '2026-08-01' }),
  });
  assert.equal(invalidTripResponse.status, 400);

  assert.equal((await fetch(`${baseUrl}/api/places/${privatePlace.id}`, {
    method: 'DELETE',
    headers: { Cookie: loginCookie },
  })).status, 200);

  assert.equal((await fetch(`${baseUrl}/api/admin/users/u_admin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ is_active: false }),
  })).status, 409);
  assert.equal((await fetch(`${baseUrl}/api/admin/users/${registeredMember.user.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ is_active: false }),
  })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: memberCookie } })).status, 401);

  const missingResponse = await fetch(`${baseUrl}/api/does-not-exist`, { headers: { Cookie: loginCookie } });
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), {
    error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
  });

  const changeResponse = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: loginCookie },
    body: JSON.stringify({ currentPassword: 'admin123', newPassword: 'formal-password-123' }),
  });
  assert.equal(changeResponse.status, 204);
  const changedCookie = cookieFrom(changeResponse);
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: loginCookie } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: changedCookie } })).status, 200);

  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: changedCookie },
  });
  assert.equal(logoutResponse.status, 204);
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: changedCookie } })).status, 401);
});
