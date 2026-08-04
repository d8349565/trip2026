import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-admin-users-'));
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = dataPath;
process.env.APP_UPLOADS_DIR = path.join(dataPath, 'uploads');
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie');
  assert(header, 'Expected a Set-Cookie response header');
  return header.split(';', 1)[0];
}

async function login(baseUrl: string, username: string, password: string): Promise<Response> {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

test('admin can create, reset and deactivate users; non-admin is rejected', async (context) => {
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

  // Unauthenticated requests are rejected before any role check.
  assert.equal((await fetch(`${baseUrl}/api/admin/users`)).status, 401);

  const adminLogin = await login(baseUrl, 'admin', 'admin123');
  assert.equal(adminLogin.status, 200);
  const adminCookie = cookieFrom(adminLogin);
  const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie };

  const listResponse = await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: adminCookie } });
  assert.equal(listResponse.status, 200);
  const initialUsers = await listResponse.json();
  assert(Array.isArray(initialUsers));
  assert(initialUsers.some((user: { username: string }) => user.username === 'admin'));

  // Validation: short username / short password / bad role are rejected.
  assert.equal((await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ username: 'ab', password: 'long-enough-password' }),
  })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ username: 'testmember01', password: 'short' }),
  })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ username: 'testmember01', password: 'long-enough-password', role: 'superuser' }),
  })).status, 400);

  // Create a normal member.
  const createResponse = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ username: 'testmember01', password: 'member-password-01' }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.username, 'testmember01');
  assert.equal(created.role, 'user');
  assert.equal(created.is_active, true);

  // Duplicate username conflicts.
  assert.equal((await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ username: 'TestMember01', password: 'member-password-02' }),
  })).status, 409);

  // New member can log in but cannot reach admin APIs.
  const memberLogin = await login(baseUrl, 'testmember01', 'member-password-01');
  assert.equal(memberLogin.status, 200);
  const memberCookie = cookieFrom(memberLogin);
  assert.equal((await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: memberCookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
    body: JSON.stringify({ username: 'testmember02', password: 'member-password-02' }),
  })).status, 403);
  // Regular data APIs stay available to members.
  assert.equal((await fetch(`${baseUrl}/api/places`, { headers: { Cookie: memberCookie } })).status, 200);

  // Admin resets the member password: old sessions die, old password fails.
  const resetResponse = await fetch(`${baseUrl}/api/admin/users/${created.id}/password`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ password: 'member-password-99' }),
  });
  assert.equal(resetResponse.status, 204);
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: memberCookie } })).status, 401);
  assert.equal((await login(baseUrl, 'testmember01', 'member-password-01')).status, 401);
  const relogin = await login(baseUrl, 'testmember01', 'member-password-99');
  assert.equal(relogin.status, 200);
  const reloginCookie = cookieFrom(relogin);

  // Reset validation and unknown user.
  assert.equal((await fetch(`${baseUrl}/api/admin/users/${created.id}/password`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ password: 'short' }),
  })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/admin/users/u_missing/password`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ password: 'member-password-99' }),
  })).status, 404);

  // Deactivation blocks login; reactivation restores it.
  const disableResponse = await fetch(`${baseUrl}/api/admin/users/${created.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(disableResponse.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { Cookie: reloginCookie } })).status, 401);
  assert.equal((await login(baseUrl, 'testmember01', 'member-password-99')).status, 401);

  const enableResponse = await fetch(`${baseUrl}/api/admin/users/${created.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ is_active: true }),
  });
  assert.equal(enableResponse.status, 200);
  assert.equal((await login(baseUrl, 'testmember01', 'member-password-99')).status, 200);

  // The last active admin cannot be demoted or disabled.
  const adminUser = (await (await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: adminCookie } })).json())
    .find((user: { username: string }) => user.username === 'admin');
  assert.equal((await fetch(`${baseUrl}/api/admin/users/${adminUser.id}`, {
    method: 'PATCH', headers: adminHeaders,
    body: JSON.stringify({ role: 'user' }),
  })).status, 409);
});
