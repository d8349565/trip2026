import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-batch-'));
process.env.NODE_ENV = 'test';
process.env.APP_DATA_DIR = dataPath;
process.env.APP_UPLOADS_DIR = path.join(dataPath, 'uploads');
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie');
  assert(header, 'Expected a Set-Cookie response header');
  return header.split(';', 1)[0];
}

test('trips and checklists details-batch match single-fetch shape and permissions', async (context) => {
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
  const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie };

  const createTrip = async (title: string, visibility: 'shared' | 'private') => {
    const response = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ title, start_date: '2026-08-01', end_date: '2026-08-03', visibility }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).id as string;
  };
  const sharedTripId = await createTrip('Shared trip', 'shared');
  const secondTripId = await createTrip('Second trip', 'shared');
  const privateTripId = await createTrip('Private trip', 'private');

  const singleTrip = await fetch(`${baseUrl}/api/trips/${sharedTripId}`, { headers: { Cookie: adminCookie } })
    .then((response) => response.json());

  const batchResponse = await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: [sharedTripId, secondTripId] }),
  });
  assert.equal(batchResponse.status, 200);
  const batchBody = await batchResponse.json();
  assert.equal(batchBody.details.length, 2);
  assert.deepEqual(batchBody.details[0], singleTrip);
  assert.deepEqual(Object.keys(batchBody.details[0]).sort(), Object.keys(singleTrip).sort());
  assert.deepEqual(batchBody.details[1], await fetch(`${baseUrl}/api/trips/${secondTripId}`, { headers: { Cookie: adminCookie } }).then((r) => r.json()));

  // Order follows the input ids, missing/foreign ids are skipped.
  const mixedResponse = await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: [secondTripId, 't_missing', sharedTripId] }),
  });
  assert.equal(mixedResponse.status, 200);
  const mixedBody = await mixedResponse.json();
  assert.deepEqual(mixedBody.details.map((trip: { id: string }) => trip.id), [secondTripId, sharedTripId]);

  // Empty input short-circuits to an empty list.
  const emptyResponse = await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: [] }),
  });
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual(await emptyResponse.json(), { details: [] });

  // More than 100 ids is rejected.
  const tooManyResponse = await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: Array.from({ length: 101 }, (_, i) => `t_${i}`) }),
  });
  assert.equal(tooManyResponse.status, 400);

  // Invalid body shape is rejected.
  const invalidResponse = await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: 'not-an-array' }),
  });
  assert.equal(invalidResponse.status, 400);

  // A non-admin member cannot fetch private trips through the batch endpoint.
  const registerResponse = await fetch(`${baseUrl}/api/auth/register-by-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'batch_member', password: 'member-password-123', inviteCode: 'TRIP2026' }),
  });
  assert.equal(registerResponse.status, 201);
  const memberCookie = cookieFrom(registerResponse);
  const memberHeaders = { 'Content-Type': 'application/json', Cookie: memberCookie };

  const memberBatch = await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: memberHeaders,
    body: JSON.stringify({ ids: [privateTripId, sharedTripId] }),
  });
  assert.equal(memberBatch.status, 200);
  assert.deepEqual((await memberBatch.json()).details.map((trip: { id: string }) => trip.id), [sharedTripId]);

  assert.equal((await fetch(`${baseUrl}/api/trips/details-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [sharedTripId] }),
  })).status, 401);

  // Checklists behave the same way. Checklist creation hard-codes shared
  // visibility, so the private fixture is flipped directly in the store.
  const createChecklist = async (title: string) => {
    const response = await fetch(`${baseUrl}/api/checklists`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ title }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).id as string;
  };
  const sharedChecklistId = await createChecklist('Shared checklist');
  const privateChecklistId = await createChecklist('Private checklist');

  const { DbEngine } = await import('../src/dbEngine');
  const engine = DbEngine.getInstance();
  const db = engine.getRawDb();
  const checklistIndex = db.checklists.findIndex((cl) => cl.id === privateChecklistId);
  assert(checklistIndex !== -1);
  db.checklists[checklistIndex] = { ...db.checklists[checklistIndex], visibility: 'private' };
  engine.saveDb(db);

  const itemResponse = await fetch(`${baseUrl}/api/checklists/${sharedChecklistId}/items`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Passport', quantity: 2 }),
  });
  assert.equal(itemResponse.status, 200);

  const singleChecklist = await fetch(`${baseUrl}/api/checklists/${sharedChecklistId}`, { headers: { Cookie: adminCookie } })
    .then((response) => response.json());
  assert.equal(singleChecklist.items.length, 1);

  const checklistBatch = await fetch(`${baseUrl}/api/checklists/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: [sharedChecklistId, 'cl_missing', privateChecklistId] }),
  });
  assert.equal(checklistBatch.status, 200);
  const checklistBatchBody = await checklistBatch.json();
  assert.deepEqual(checklistBatchBody.details.map((cl: { id: string }) => cl.id), [sharedChecklistId, privateChecklistId]);
  assert.deepEqual(checklistBatchBody.details[0], singleChecklist);

  const memberChecklistBatch = await fetch(`${baseUrl}/api/checklists/details-batch`, {
    method: 'POST',
    headers: memberHeaders,
    body: JSON.stringify({ ids: [privateChecklistId, sharedChecklistId] }),
  });
  assert.equal(memberChecklistBatch.status, 200);
  assert.deepEqual((await memberChecklistBatch.json()).details.map((cl: { id: string }) => cl.id), [sharedChecklistId]);

  assert.equal((await fetch(`${baseUrl}/api/checklists/details-batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ ids: Array.from({ length: 101 }, (_, i) => `cl_${i}`) }),
  })).status, 400);
});
