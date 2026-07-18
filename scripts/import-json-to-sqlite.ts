import path from 'node:path';
import { SqliteStore } from '../src/server/db/sqliteStore';

function argument(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  return path.resolve(process.cwd(), value || fallback);
}

const sourcePath = argument('source', 'db.json');
const targetPath = argument('target', 'data/travel-footprint.sqlite');
const migrationsPath = path.resolve(process.cwd(), 'migrations');
const store = new SqliteStore(targetPath, migrationsPath);

try {
  if (!store.isEmpty()) {
    throw new Error(`Target database is not empty: ${targetPath}`);
  }
  const result = store.importLegacyFile(sourcePath);
  store.setMetadata('legacy_import_complete', new Date().toISOString());
  if (store.integrityCheck() !== 'ok') throw new Error('SQLite integrity check failed after import');
  const snapshot = store.readSnapshot();
  console.log(JSON.stringify({
    source: sourcePath,
    target: targetPath,
    users: snapshot.users.length,
    places: snapshot.places.length,
    trips: snapshot.trips.length,
    guides: snapshot.guides.length,
    checklists: snapshot.checklists.length,
    imported_media: result.importedMedia,
    skipped_placeholder_media: result.skippedMedia,
  }, null, 2));
} finally {
  store.close();
}
