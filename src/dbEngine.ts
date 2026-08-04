/**
 * Temporary compatibility adapter between the existing route layer and SQLite.
 * Routes still edit an AppDatabase snapshot; later phases will replace those
 * snapshot writes with focused repositories without changing the UI contract.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { AppDatabase } from './types';
import { config } from './server/config';
import { SqliteStore } from './server/db/sqliteStore';
import type { User } from './types';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_salt_travel_footprint').digest('hex');
}

export class DbEngine {
  private static instance: DbEngine;
  private readonly store: SqliteStore;
  private db: AppDatabase;

  private constructor() {
    this.store = new SqliteStore(config.databasePath, config.migrationsPath);
    this.importLegacyDatabaseOnce();
    this.db = this.store.readSnapshot();
  }

  static getInstance(): DbEngine {
    if (!DbEngine.instance) DbEngine.instance = new DbEngine();
    return DbEngine.instance;
  }

  private importLegacyDatabaseOnce() {
    if (this.store.getMetadata('legacy_import_complete')) return;

    if (this.store.isEmpty() && fs.existsSync(config.legacyDatabasePath)) {
      const result = this.store.importLegacyFile(config.legacyDatabasePath);
      console.log(
        `Imported legacy db.json into SQLite (${result.importedMedia} media imported, ${result.skippedMedia} SVG placeholders skipped).`,
      );
    }
    this.store.setMetadata('legacy_import_complete', new Date().toISOString());
  }

  getRawDb(): AppDatabase {
    return this.db;
  }

  saveDb(newDb: AppDatabase) {
    this.store.replaceSnapshot(newDb);
    this.db = this.store.readSnapshot();
  }

  getStorageStatus() {
    return {
      kind: 'sqlite' as const,
      path: config.databasePath,
      integrity: this.store.integrityCheck(),
    };
  }

  getUserById(id: string): User | undefined {
    return this.store.getUserById(id);
  }

  getUserCredential(username: string) {
    return this.store.getUserCredential(username);
  }

  setPassword(userId: string, passwordHash: string, algorithm = 'argon2id') {
    this.store.setPassword(userId, passwordHash, algorithm);
    this.db = this.store.readSnapshot();
  }

  registerByInvite(input: Parameters<SqliteStore['registerByInvite']>[0]) {
    const user = this.store.registerByInvite(input);
    this.db = this.store.readSnapshot();
    return user;
  }

  createUser(input: Parameters<SqliteStore['createUser']>[0]) {
    const user = this.store.createUser(input);
    this.db = this.store.readSnapshot();
    return user;
  }

  getSession(id: string) {
    return this.store.getSession(id);
  }

  setSession(id: string, userId: string, data: string, expiresAt: string) {
    this.store.setSession(id, userId, data, expiresAt);
  }

  deleteSession(id: string) {
    this.store.deleteSession(id);
  }

  deleteUserSessions(userId: string) {
    this.store.deleteUserSessions(userId);
  }

  deleteExpiredSessions() {
    this.store.deleteExpiredSessions();
  }

  getPlacesForUser(userId: string) {
    return this.store.getPlacesForUser(userId);
  }

  togglePlaceFavorite(userId: string, placeId: string) {
    const place = this.store.setPlaceState(userId, placeId, 'favorite');
    // Keep the in-memory snapshot aligned so a later saveDb() does not
    // overwrite per-user place state with stale owner status/favorite.
    this.db = this.store.readSnapshot();
    return place;
  }

  togglePlaceVisited(userId: string, placeId: string) {
    const place = this.store.setPlaceState(userId, placeId, 'status');
    this.db = this.store.readSnapshot();
    return place;
  }

  markPlaceVisited(userId: string, placeId: string) {
    this.store.markPlaceVisited(userId, placeId);
    this.db = this.store.readSnapshot();
  }

  // Formal backup/restore is intentionally deferred. Keep these methods only
  // until the old settings UI and routes are removed in the auth phase.
  listBackups(): string[] {
    return [];
  }

  createBackup(): never {
    throw new Error('Backup is disabled until a complete SQLite + media backup workflow is implemented');
  }

  restoreBackup(_filename: string): false {
    return false;
  }

  deleteBackup(_filename: string): false {
    return false;
  }

  close() {
    this.store.close();
  }
}
