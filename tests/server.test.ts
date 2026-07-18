import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-server-'));
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = dataPath;
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
