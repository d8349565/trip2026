import { config } from '../src/server/config';
import { SqliteStore } from '../src/server/db/sqliteStore';

const store = new SqliteStore(config.databasePath, config.migrationsPath);
store.close();
console.log(`SQLite migrations applied: ${config.databasePath}`);
