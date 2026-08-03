import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-upload-'));
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = dataPath;
process.env.APP_UPLOADS_DIR = path.join(dataPath, 'uploads');
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie');
  assert(header, 'Expected a Set-Cookie response header');
  return header.split(';', 1)[0];
}

function dataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

test('uploads enforce the image whitelist and cross-resource references', async (context) => {
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

  const post = (url: string, cookie: string, body: unknown) => fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });

  const loginResponse = await post('/api/auth/login', '', { username: 'admin', password: 'admin123' });
  assert.equal(loginResponse.status, 200);
  const adminCookie = cookieFrom(loginResponse);

  const registerResponse = await post('/api/auth/register-by-invite', '', {
    username: 'upload_member', password: 'member-password-123', inviteCode: 'TRIP2026',
  });
  assert.equal(registerResponse.status, 201);
  const memberCookie = cookieFrom(registerResponse);

  const createPlace = async (cookie: string, visibility: string) => {
    const response = await post('/api/places', cookie, {
      name: `place-${visibility}-${Math.random()}`, category_id: 'scenic',
      latitude: 30.2, longitude: 120.1, address: 'test', visibility,
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const createTrip = async (cookie: string, visibility: string) => {
    const response = await post('/api/trips', cookie, {
      title: `trip-${visibility}-${Math.random()}`, start_date: '2026-09-01', end_date: '2026-09-02', visibility,
    });
    assert.equal(response.status, 200);
    return response.json();
  };

  const adminPrivatePlace = await createPlace(adminCookie, 'private');
  const adminPrivateTrip = await createTrip(adminCookie, 'private');
  const memberPlace = await createPlace(memberCookie, 'private');
  const memberTrip = await createTrip(memberCookie, 'private');

  const upload = (cookie: string, body: Record<string, unknown>) => post('/api/media/upload', cookie, body);

  // Declared SVG is not an image and must be rejected.
  const svgResponse = await upload(adminCookie, {
    filename: 'evil.svg',
    dataUrl: dataUrl('image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
  });
  assert.equal(svgResponse.status, 400);
  assert.equal((await svgResponse.json()).error.code, 'UNSUPPORTED_MEDIA_TYPE');

  // The declared MIME must match the magic bytes.
  const mismatchResponse = await upload(adminCookie, {
    filename: 'fake.png', dataUrl: dataUrl('image/png', JPEG),
  });
  assert.equal(mismatchResponse.status, 400);
  assert.equal((await mismatchResponse.json()).error.code, 'UNSUPPORTED_MEDIA_TYPE');

  // Whitelisted content under a non-image extension is rejected.
  const badExtResponse = await upload(adminCookie, {
    filename: 'evil.svg', dataUrl: dataUrl('image/jpeg', JPEG),
  });
  assert.equal(badExtResponse.status, 400);
  assert.equal((await badExtResponse.json()).error.code, 'UNSUPPORTED_FILE_EXTENSION');

  // A missing extension is healed from the sniffed type and still served correctly.
  const noExtResponse = await upload(adminCookie, {
    filename: 'photo', dataUrl: dataUrl('image/jpeg', JPEG),
  });
  assert.equal(noExtResponse.status, 200);
  const noExt = await noExtResponse.json();
  const noExtFile = await fetch(`${baseUrl}${noExt.file_path}`, { headers: { Cookie: adminCookie } });
  assert.equal(noExtFile.status, 200);
  assert.equal(noExtFile.headers.get('content-type'), 'image/jpeg');

  // A member cannot attach media to an admin-only private place...
  const foreignUpload = await upload(memberCookie, {
    filename: 'ok.jpg', dataUrl: dataUrl('image/jpeg', JPEG), place_id: adminPrivatePlace.id,
  });
  assert.equal(foreignUpload.status, 400);
  assert.equal((await foreignUpload.json()).error.code, 'INVALID_REFERENCE');

  // ...but can attach to their own private place.
  const ownUpload = await upload(memberCookie, {
    filename: 'own.jpg', dataUrl: dataUrl('image/jpeg', JPEG), place_id: memberPlace.id,
  });
  assert.equal(ownUpload.status, 200);
  const ownMedia = await ownUpload.json();

  // Re-pointing media at an unreadable place is rejected; clearing the reference is allowed.
  const repoint = await fetch(`${baseUrl}/api/media/${ownMedia.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
    body: JSON.stringify({ place_id: adminPrivatePlace.id }),
  });
  assert.equal(repoint.status, 400);
  assert.equal((await repoint.json()).error.code, 'INVALID_REFERENCE');

  const cleared = await fetch(`${baseUrl}/api/media/${ownMedia.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
    body: JSON.stringify({ place_id: null }),
  });
  assert.equal(cleared.status, 200);

  // Trip day items reject unreadable places and accept the user's own.
  const memberDayId = `td_${memberTrip.id}_1`;
  const badItem = await post(`/api/trip-days/${memberDayId}/items`, memberCookie, {
    title: 'bad item', place_id: adminPrivatePlace.id,
  });
  assert.equal(badItem.status, 400);
  assert.equal((await badItem.json()).error.code, 'INVALID_REFERENCE');

  const goodItem = await post(`/api/trip-days/${memberDayId}/items`, memberCookie, {
    title: 'good item', place_id: memberPlace.id,
  });
  assert.equal(goodItem.status, 200);

  // Checklists (plain and from-template) reject unreadable trips, accept the user's own.
  const badChecklist = await post('/api/checklists', memberCookie, {
    title: 'bad', trip_id: adminPrivateTrip.id,
  });
  assert.equal(badChecklist.status, 400);
  assert.equal((await badChecklist.json()).error.code, 'INVALID_REFERENCE');

  const badTemplate = await post('/api/checklists/from-template', memberCookie, {
    title: 'bad', trip_id: adminPrivateTrip.id, template_type: 'stream',
  });
  assert.equal(badTemplate.status, 400);

  const goodChecklist = await post('/api/checklists', memberCookie, {
    title: 'good', trip_id: memberTrip.id,
  });
  assert.equal(goodChecklist.status, 200);

  // PNG round-trip sanity: sniffed content type is honored.
  const pngResponse = await upload(adminCookie, {
    filename: 'real.png', dataUrl: dataUrl('image/png', PNG),
  });
  assert.equal(pngResponse.status, 200);
  const pngMedia = await pngResponse.json();
  const pngFile = await fetch(`${baseUrl}${pngMedia.file_path}`, { headers: { Cookie: adminCookie } });
  assert.equal(pngFile.status, 200);
  assert.equal(pngFile.headers.get('content-type'), 'image/png');
});
