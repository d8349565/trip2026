import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-media-'));
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = dataPath;
process.env.APP_UPLOADS_DIR = path.join(dataPath, 'uploads');
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie');
  assert(header, 'Expected a Set-Cookie response header');
  return header.split(';', 1)[0];
}

test('media files are only served through authorized endpoints', async (context) => {
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

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(loginResponse.status, 200);
  const adminCookie = cookieFrom(loginResponse);

  // Upload returns the serialized /api/media/:id/* URLs, never a /uploads path.
  const photoPayload = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('authorized-photo')]);
  const uploadResponse = await fetch(`${baseUrl}/api/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      filename: 'authorized.jpg',
      dataUrl: `data:image/jpeg;base64,${photoPayload.toString('base64')}`,
    }),
  });
  assert.equal(uploadResponse.status, 200);
  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.file_path, `/api/media/${uploaded.id}/file`);
  assert.equal(uploaded.thumbnail_path, `/api/media/${uploaded.id}/thumbnail`);

  // Media list is serialized the same way.
  const listResponse = await fetch(`${baseUrl}/api/media`, { headers: { Cookie: adminCookie } });
  const listed = (await listResponse.json()).find((m: { id: string }) => m.id === uploaded.id);
  assert.equal(listed.file_path, `/api/media/${uploaded.id}/file`);
  assert.equal(listed.thumbnail_path, `/api/media/${uploaded.id}/thumbnail`);

  // Unauthenticated requests are rejected by the session guard.
  assert.equal((await fetch(`${baseUrl}/api/media/${uploaded.id}/file`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/media/${uploaded.id}/thumbnail`)).status, 401);

  // The owner can stream the file with the negotiated content type.
  const fileResponse = await fetch(`${baseUrl}/api/media/${uploaded.id}/file`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(fileResponse.status, 200);
  assert.equal(fileResponse.headers.get('content-type'), 'image/jpeg');
  assert.equal(fileResponse.headers.get('cache-control'), 'private, max-age=3600');
  assert.equal(await fileResponse.text(), photoPayload.toString());

  const thumbnailResponse = await fetch(`${baseUrl}/api/media/${uploaded.id}/thumbnail`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(thumbnailResponse.status, 200);
  assert.equal(thumbnailResponse.headers.get('content-type'), 'image/jpeg');

  // Legacy /uploads URLs are no longer served.
  assert.equal((await fetch(`${baseUrl}/uploads/places/anything.jpg`, { headers: { Cookie: adminCookie } })).status, 404);

  // A member can read shared media but loses access once it becomes private:
  // unreadable media is treated as non-existent, matching the list endpoint.
  const registerResponse = await fetch(`${baseUrl}/api/auth/register-by-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'media_member', password: 'member-password-123', inviteCode: 'TRIP2026' }),
  });
  assert.equal(registerResponse.status, 201);
  const memberCookie = cookieFrom(registerResponse);

  assert.equal((await fetch(`${baseUrl}/api/media/${uploaded.id}/file`, {
    headers: { Cookie: memberCookie },
  })).status, 200);

  const privatizeResponse = await fetch(`${baseUrl}/api/media/${uploaded.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ visibility: 'private' }),
  });
  assert.equal(privatizeResponse.status, 200);
  const privatized = await privatizeResponse.json();
  assert.equal(privatized.file_path, `/api/media/${uploaded.id}/file`);

  assert.equal((await fetch(`${baseUrl}/api/media/${uploaded.id}/file`, {
    headers: { Cookie: memberCookie },
  })).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/media/${uploaded.id}/thumbnail`, {
    headers: { Cookie: memberCookie },
  })).status, 404);

  // Unknown media id.
  assert.equal((await fetch(`${baseUrl}/api/media/m_missing/file`, {
    headers: { Cookie: adminCookie },
  })).status, 404);

  // A stored path escaping the uploads root is rejected.
  const { DbEngine } = await import('../src/dbEngine');
  const engine = DbEngine.getInstance();
  const db = engine.getRawDb();
  const index = db.media.findIndex((m) => m.id === uploaded.id);
  assert(index !== -1);
  db.media[index] = { ...db.media[index], file_path: '/uploads/../secret.jpg' };
  engine.saveDb(db);

  const traversalResponse = await fetch(`${baseUrl}/api/media/${uploaded.id}/file`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(traversalResponse.status, 400);
  assert.equal((await traversalResponse.json()).error.code, 'INVALID_MEDIA_PATH');

  // A stored path pointing at a missing file reports 404.
  const db2 = engine.getRawDb();
  const index2 = db2.media.findIndex((m) => m.id === uploaded.id);
  db2.media[index2] = { ...db2.media[index2], file_path: '/uploads/places/missing-file.jpg' };
  engine.saveDb(db2);
  assert.equal((await fetch(`${baseUrl}/api/media/${uploaded.id}/file`, {
    headers: { Cookie: adminCookie },
  })).status, 404);
});
