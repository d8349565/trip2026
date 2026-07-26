import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SqliteStore } from '../src/server/db/sqliteStore';

test('migrations and legacy import are idempotent and transactional', (context) => {
  const tempPath = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-footprint-sqlite-'));
  context.after(() => fs.rmSync(tempPath, { recursive: true, force: true }));

  const databasePath = path.join(tempPath, 'travel-footprint.sqlite');
  const migrationsPath = path.resolve(process.cwd(), 'migrations');
  const legacyPath = path.resolve(process.cwd(), 'db.json');
  let store = new SqliteStore(databasePath, migrationsPath);

  assert.equal(store.isEmpty(), true);
  const importResult = store.importLegacyFile(legacyPath);
  assert.deepEqual(importResult, { importedMedia: 0, skippedMedia: 0 });
  assert.equal(store.integrityCheck(), 'ok');

  const imported = store.readSnapshot();
  assert.equal(imported.users.length, 2);
  assert.equal(imported.places.length, 0);
  assert.equal(imported.trips.length, 0);
  assert.equal(imported.media.length, 0);

  const withMedia = structuredClone(imported);
  withMedia.media.push({
    id: 'media-with-browser-location',
    user_id: imported.users[0].id,
    file_path: '/uploads/test.jpg',
    thumbnail_path: '/uploads/test.jpg',
    file_hash: 'test-hash',
    file_size: 123,
    source_latitude: 30.2741,
    source_longitude: 120.1551,
    source_coordinate_system: 'WGS84',
    location_source: 'browser',
    location_accuracy_m: 18,
    location_observed_at: '2026-07-26T08:00:00.000Z',
    display_latitude: 30.2717,
    display_longitude: 120.1596,
    favorite: false,
    visibility: 'private',
    created_at: '2026-07-26T08:00:01.000Z',
  });
  store.replaceSnapshot(withMedia);
  const storedMedia = store.readSnapshot().media[0];
  assert.equal(storedMedia.location_source, 'browser');
  assert.equal(storedMedia.location_accuracy_m, 18);
  assert.equal(storedMedia.exif_latitude ?? undefined, undefined);

  const invalid = structuredClone(withMedia);
  invalid.trips.push({
    id: 'invalid-trip',
    title: 'Invalid trip',
    start_date: '2026-08-10',
    end_date: '2000-01-01',
    origin: '',
    destination_summary: '',
    travel_mode: 'drive',
    participants: '',
    status: 'draft',
    visibility: 'private',
    created_by: imported.users[0].id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert.throws(() => store.replaceSnapshot(invalid), /CHECK constraint failed/);
  assert.equal(store.readSnapshot().trips.length, 0);
  assert.equal(store.readSnapshot().media.length, 1);

  store.close();
  store = new SqliteStore(databasePath, migrationsPath);
  assert.equal(store.readSnapshot().places.length, 0);
  assert.equal(store.readSnapshot().media[0].location_source, 'browser');
  assert.equal(store.integrityCheck(), 'ok');
  store.close();
});
