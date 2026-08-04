import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { AppDatabase, Checklist, Media, Place, User, Visit } from '../../types';

export interface UserCredential {
  user: User;
  passwordHash: string;
  algorithm: string;
}

type SqlValue = string | number | bigint | Buffer | null;
type SqlRecord = Record<string, SqlValue>;
type RawRow = Record<string, unknown>;

const DELETE_ORDER = [
  'checklist_items',
  'checklists',
  'guides',
  'media',
  'trip_items',
  'trip_days',
  'visits',
  'user_place_states',
  'trips',
  'places',
] as const;

function bool(value: boolean): number {
  return value ? 1 : 0;
}

function optionalBool(value: boolean | undefined): number | null {
  return value === undefined ? null : bool(value);
}

function optional(value: string | number | undefined): string | number | null {
  return value === undefined ? null : value;
}

function readBool(value: unknown): boolean {
  return value === 1;
}

function readOptionalBool(value: unknown): boolean | undefined {
  return value === null || value === undefined ? undefined : value === 1;
}

function mapPlaceRow(row: RawRow): Place {
  return {
    ...row,
    favorite: readBool(row.favorite),
    recommended: readBool(row.recommended),
    is_wet: readOptionalBool(row.is_wet),
    need_hiking: readOptionalBool(row.need_hiking),
    rainy_ready: readOptionalBool(row.rainy_ready),
    has_signal: readOptionalBool(row.has_signal),
    has_parking: readOptionalBool(row.has_parking),
    has_restroom: readOptionalBool(row.has_restroom),
    has_charging: readOptionalBool(row.has_charging),
  } as unknown as Place;
}

function migrationVersion(filename: string): number {
  const match = /^(\d+)_.*\.sql$/.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  return Number(match[1]);
}

function assertSnapshotShape(value: unknown): asserts value is AppDatabase {
  if (!value || typeof value !== 'object') throw new Error('Legacy database must be a JSON object');
  const record = value as Record<string, unknown>;
  for (const collection of ['users', 'places', 'trips', 'tripDays', 'tripItems', 'media', 'guides', 'checklists', 'checklistItems']) {
    if (!Array.isArray(record[collection])) throw new Error(`Legacy database is missing collection: ${collection}`);
  }
  if (!record.passwords || typeof record.passwords !== 'object') {
    throw new Error('Legacy database is missing password records');
  }
}

export class SqliteStore {
  private readonly database: Database.Database;

  constructor(
    readonly databasePath: string,
    readonly migrationsPath: string,
  ) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma('foreign_keys = ON');
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('busy_timeout = 5000');
    this.runMigrations();
  }

  private runMigrations() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const files = fs.readdirSync(this.migrationsPath)
      .filter((filename) => /^\d+_.*\.sql$/.test(filename))
      .sort((a, b) => migrationVersion(a) - migrationVersion(b));
    const appliedRows = this.database.prepare('SELECT version, checksum FROM schema_migrations').all() as Array<{ version: number; checksum: string }>;
    const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));

    for (const filename of files) {
      const version = migrationVersion(filename);
      const sql = fs.readFileSync(path.join(this.migrationsPath, filename), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existingChecksum = applied.get(version);
      if (existingChecksum) {
        if (existingChecksum !== checksum) {
          throw new Error(`Applied migration ${filename} has been modified`);
        }
        continue;
      }

      this.database.transaction(() => {
        this.database.exec(sql);
        this.database.prepare(`
          INSERT INTO schema_migrations (version, name, checksum, applied_at)
          VALUES (?, ?, ?, ?)
        `).run(version, filename, checksum, new Date().toISOString());
      })();
    }
  }

  private insert(table: string, row: SqlRecord) {
    const columns = Object.keys(row);
    const placeholders = columns.map((column) => `@${column}`);
    this.database.prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    ).run(row);
  }

  private upsert(table: string, row: SqlRecord, conflictColumn: string) {
    const columns = Object.keys(row);
    const placeholders = columns.map((column) => `@${column}`);
    const updates = columns
      .filter((column) => column !== conflictColumn)
      .map((column) => `${column} = excluded.${column}`);
    this.database.prepare(`
      INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
      ON CONFLICT(${conflictColumn}) DO UPDATE SET ${updates.join(', ')}
    `).run(row);
  }

  getMetadata(key: string): string | undefined {
    const row = this.database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMetadata(key: string, value: string) {
    this.database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  getUserById(id: string): User | undefined {
    const row = this.database.prepare('SELECT * FROM users WHERE id = ?').get(id) as RawRow | undefined;
    return row ? ({ ...row, is_active: readBool(row.is_active) } as unknown as User) : undefined;
  }

  getUserCredential(username: string): UserCredential | undefined {
    const row = this.database.prepare(`
      SELECT u.*, p.password_hash, p.algorithm
      FROM users u
      JOIN passwords p ON p.user_id = u.id
      WHERE u.username = ? COLLATE NOCASE
    `).get(username) as RawRow | undefined;
    if (!row) return undefined;
    const { password_hash, algorithm, ...userRow } = row;
    return {
      user: { ...userRow, is_active: readBool(userRow.is_active) } as unknown as User,
      passwordHash: String(password_hash),
      algorithm: String(algorithm),
    };
  }

  setPassword(userId: string, passwordHash: string, algorithm = 'argon2id') {
    this.database.prepare(`
      INSERT INTO passwords (user_id, password_hash, algorithm) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash, algorithm = excluded.algorithm
    `).run(userId, passwordHash, algorithm);
  }

  registerByInvite(input: {
    id: string;
    username: string;
    passwordHash: string;
    inviteCode: string;
    createdAt: string;
  }): User {
    return this.database.transaction(() => {
      const invite = this.database.prepare('SELECT * FROM invites WHERE code = ? COLLATE NOCASE').get(input.inviteCode) as {
        id: string;
        max_uses: number;
        uses: number;
        expires_at: string;
      } | undefined;
      if (!invite || invite.uses >= invite.max_uses || invite.expires_at < input.createdAt) {
        throw new Error('INVITE_INVALID');
      }
      if (this.database.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(input.username)) {
        throw new Error('USERNAME_EXISTS');
      }

      const user: User = {
        id: input.id,
        username: input.username,
        role: 'user',
        is_active: true,
        created_at: input.createdAt,
      };
      this.insert('users', {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: 1,
        created_at: user.created_at,
      });
      this.insert('passwords', { user_id: user.id, password_hash: input.passwordHash, algorithm: 'argon2id' });
      this.database.prepare('UPDATE invites SET uses = uses + 1 WHERE id = ?').run(invite.id);
      return user;
    })();
  }

  createUser(input: {
    id: string;
    username: string;
    passwordHash: string;
    role: 'admin' | 'user';
    createdAt: string;
  }): User {
    return this.database.transaction(() => {
      if (this.database.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(input.username)) {
        throw new Error('USERNAME_EXISTS');
      }
      const user: User = {
        id: input.id,
        username: input.username,
        role: input.role,
        is_active: true,
        created_at: input.createdAt,
      };
      this.insert('users', {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: 1,
        created_at: user.created_at,
      });
      this.insert('passwords', { user_id: user.id, password_hash: input.passwordHash, algorithm: 'argon2id' });
      return user;
    })();
  }

  getSession(id: string): { data: string; expiresAt: string } | undefined {
    const row = this.database.prepare('SELECT data_json, expires_at FROM sessions WHERE id = ?').get(id) as {
      data_json: string;
      expires_at: string;
    } | undefined;
    return row ? { data: row.data_json, expiresAt: row.expires_at } : undefined;
  }

  setSession(id: string, userId: string, data: string, expiresAt: string) {
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO sessions (id, user_id, data_json, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        data_json = excluded.data_json,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(id, userId, data, expiresAt, now, now);
  }

  deleteSession(id: string) {
    this.database.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  deleteUserSessions(userId: string) {
    this.database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  deleteExpiredSessions(now = new Date().toISOString()) {
    this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  }

  getPlacesForUser(userId: string): Place[] {
    return (this.database.prepare(`
      SELECT p.*, COALESCE(s.status, 'want_to_go') AS status, COALESCE(s.favorite, 0) AS favorite
      FROM places p
      LEFT JOIN user_place_states s ON s.place_id = p.id AND s.user_id = ?
      ORDER BY p.created_at, p.id
    `).all(userId) as RawRow[]).map(mapPlaceRow);
  }

  setPlaceState(userId: string, placeId: string, change: 'favorite' | 'status'): Place | undefined {
    const place = this.database.prepare('SELECT id FROM places WHERE id = ?').get(placeId);
    if (!place) return undefined;
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO user_place_states (user_id, place_id, status, favorite, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, place_id) DO UPDATE SET
        status = CASE WHEN ? = 'status' THEN CASE user_place_states.status WHEN 'visited' THEN 'want_to_go' ELSE 'visited' END ELSE user_place_states.status END,
        favorite = CASE WHEN ? = 'favorite' THEN CASE user_place_states.favorite WHEN 1 THEN 0 ELSE 1 END ELSE user_place_states.favorite END,
        updated_at = excluded.updated_at
    `).run(
      userId,
      placeId,
      change === 'status' ? 'visited' : 'want_to_go',
      change === 'favorite' ? 1 : 0,
      now,
      change,
      change,
    );
    return this.getPlacesForUser(userId).find((item) => item.id === placeId);
  }

  markPlaceVisited(userId: string, placeId: string) {
    this.database.prepare(`
      INSERT INTO user_place_states (user_id, place_id, status, favorite, updated_at)
      VALUES (?, ?, 'visited', 0, ?)
      ON CONFLICT(user_id, place_id) DO UPDATE SET status = 'visited', updated_at = excluded.updated_at
    `).run(userId, placeId, new Date().toISOString());
  }

  isEmpty(): boolean {
    const row = this.database.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    return row.count === 0;
  }

  importLegacyFile(sourcePath: string): { importedMedia: number; skippedMedia: number } {
    const parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as unknown;
    assertSnapshotShape(parsed);
    const originalMediaCount = parsed.media.length;
    parsed.media = parsed.media.filter((media) => {
      const pathValue = `${media.file_path} ${media.thumbnail_path}`.toLowerCase();
      return !pathValue.includes('.svg');
    });
    this.replaceSnapshot(parsed);
    return {
      importedMedia: parsed.media.length,
      skippedMedia: originalMediaCount - parsed.media.length,
    };
  }

  replaceSnapshot(snapshot: AppDatabase) {
    const defaultUserId = snapshot.users.find((user) => user.role === 'admin')?.id ?? snapshot.users[0]?.id;
    if (!defaultUserId && (
      snapshot.places.length > 0 || snapshot.trips.length > 0 || snapshot.guides.length > 0 || snapshot.checklists.length > 0
    )) {
      throw new Error('Cannot save owned data without at least one user');
    }

    this.database.transaction(() => {
      const preservedPlaceStates = this.database.prepare('SELECT * FROM user_place_states').all() as SqlRecord[];
      for (const table of DELETE_ORDER) this.database.prepare(`DELETE FROM ${table}`).run();

      for (const user of snapshot.users) {
        this.upsert('users', {
          id: user.id,
          username: user.username,
          role: user.role,
          is_active: bool(user.is_active),
          created_at: user.created_at,
        }, 'id');
      }
      for (const [userId, passwordHash] of Object.entries(snapshot.passwords)) {
        if (snapshot.users.some((user) => user.id === userId)) {
          const algorithm = passwordHash.startsWith('$argon2') ? 'argon2id' : 'legacy_sha256';
          this.upsert('passwords', { user_id: userId, password_hash: passwordHash, algorithm }, 'user_id');
        }
      }
      for (const invite of snapshot.invites ?? []) {
        this.upsert('invites', { ...invite }, 'id');
      }
      const ownerPlaceStates: SqlRecord[] = [];
      for (const place of snapshot.places) {
        this.insert('places', {
          id: place.id,
          name: place.name,
          category_id: place.category_id,
          latitude: place.latitude,
          longitude: place.longitude,
          coordinate_system: place.coordinate_system,
          address: place.address,
          province: optional(place.province),
          city: optional(place.city),
          district: optional(place.district),
          poi_provider: optional(place.poi_provider),
          poi_id: optional(place.poi_id),
          cover_image: optional(place.cover_image),
          summary: optional(place.summary),
          overview_route: optional(place.overview_route),
          overview_tips: optional(place.overview_tips),
          safety_notes: optional(place.safety_notes),
          packing_list: optional(place.packing_list),
          nearby_services: optional(place.nearby_services),
          rating: optional(place.rating),
          visibility: place.visibility,
          recommended: bool(place.recommended),
          created_by: place.created_by,
          created_at: place.created_at,
          updated_at: place.updated_at,
          is_wet: optionalBool(place.is_wet),
          need_hiking: optionalBool(place.need_hiking),
          rainy_ready: optionalBool(place.rainy_ready),
          has_signal: optionalBool(place.has_signal),
          risk_level: optional(place.risk_level),
          best_season: optional(place.best_season),
          ticket_price: optional(place.ticket_price),
          open_hours: optional(place.open_hours),
          suggested_duration: optional(place.suggested_duration),
          has_parking: optionalBool(place.has_parking),
          has_restroom: optionalBool(place.has_restroom),
          has_charging: optionalBool(place.has_charging),
          difficulty: optional(place.difficulty),
        });
        ownerPlaceStates.push({
          user_id: place.created_by,
          place_id: place.id,
          status: place.status,
          favorite: bool(place.favorite),
          updated_at: place.updated_at,
        });
      }
      const userIds = new Set(snapshot.users.map((user) => user.id));
      const placeIds = new Set(snapshot.places.map((place) => place.id));
      for (const state of preservedPlaceStates) {
        if (userIds.has(String(state.user_id)) && placeIds.has(String(state.place_id))) {
          this.upsert('user_place_states', state, 'user_id, place_id');
        }
      }
      for (const state of ownerPlaceStates) {
        this.upsert('user_place_states', state, 'user_id, place_id');
      }
      for (const trip of snapshot.trips) {
        this.insert('trips', {
          id: trip.id,
          title: trip.title,
          start_date: trip.start_date,
          end_date: trip.end_date,
          origin: trip.origin,
          destination_summary: trip.destination_summary,
          travel_mode: trip.travel_mode,
          participants: trip.participants,
          vehicle: optional(trip.vehicle),
          status: trip.status,
          budget: optional(trip.budget),
          cover_image: optional(trip.cover_image),
          visibility: trip.visibility,
          created_by: trip.created_by,
          created_at: trip.created_at,
          updated_at: trip.updated_at,
        });
      }
      for (const visit of snapshot.visits ?? []) {
        const placeOwner = snapshot.places.find((place) => place.id === visit.place_id)?.created_by;
        this.insert('visits', {
          id: visit.id,
          place_id: visit.place_id,
          trip_id: optional(visit.trip_id),
          created_by: visit.created_by ?? placeOwner ?? defaultUserId!,
          visit_date: visit.visit_date,
          companions: optional(visit.companions),
          weather: optional(visit.weather),
          rating: visit.rating,
          note: optional(visit.note),
          actual_cost: optional(visit.actual_cost),
          revisit_intention: visit.revisit_intention,
        });
      }
      for (const day of snapshot.tripDays) {
        this.insert('trip_days', {
          id: day.id,
          trip_id: day.trip_id,
          day_number: day.day_number,
          date: day.date,
          title: day.title,
          departure_place: optional(day.departure_place),
          destination_place: optional(day.destination_place),
          planned_distance: optional(day.planned_distance),
          planned_drive_time: optional(day.planned_drive_time),
          planned_cost: optional(day.planned_cost),
          intensity: optional(day.intensity),
          weather_note: optional(day.weather_note),
          risk_level: optional(day.risk_level),
          notes: optional(day.notes),
        });
      }
      for (const item of snapshot.tripItems) {
        this.insert('trip_items', {
          id: item.id,
          trip_day_id: item.trip_day_id,
          type: item.type,
          place_id: optional(item.place_id),
          title: item.title,
          start_time: optional(item.start_time),
          end_time: optional(item.end_time),
          duration: optional(item.duration),
          booking_status: optional(item.booking_status),
          cost: optional(item.cost),
          priority: item.priority,
          status: item.status,
          note: optional(item.note),
          sort_order: item.sort_order,
        });
      }
      for (const media of snapshot.media) {
        this.insert('media', {
          id: media.id,
          user_id: media.user_id,
          file_path: media.file_path,
          thumbnail_path: media.thumbnail_path,
          file_hash: media.file_hash,
          file_size: media.file_size,
          captured_at: optional(media.captured_at),
          exif_latitude: optional(media.exif_latitude),
          exif_longitude: optional(media.exif_longitude),
          source_latitude: optional(media.source_latitude),
          source_longitude: optional(media.source_longitude),
          source_coordinate_system: optional(media.source_coordinate_system),
          location_source: optional(media.location_source),
          location_accuracy_m: optional(media.location_accuracy_m),
          location_observed_at: optional(media.location_observed_at),
          display_latitude: optional(media.display_latitude),
          display_longitude: optional(media.display_longitude),
          metadata_status: optional(media.metadata_status),
          metadata_parser: optional(media.metadata_parser),
          metadata_error_code: optional(media.metadata_error_code),
          place_id: optional(media.place_id),
          visit_id: optional(media.visit_id),
          trip_id: optional(media.trip_id),
          favorite: bool(media.favorite),
          visibility: media.visibility,
          created_at: media.created_at,
        });
      }
      for (const guide of snapshot.guides) {
        this.insert('guides', {
          id: guide.id,
          title: guide.title,
          target_type: guide.target_type,
          target_id: optional(guide.target_id),
          summary: guide.summary,
          content: guide.content,
          source: optional(guide.source),
          verified_at: optional(guide.verified_at),
          created_by: guide.created_by,
          visibility: guide.visibility,
          created_at: guide.created_at,
          updated_at: guide.updated_at,
        });
      }
      for (const checklist of snapshot.checklists) {
        this.insert('checklists', {
          id: checklist.id,
          title: checklist.title,
          trip_id: optional(checklist.trip_id),
          template_type: optional(checklist.template_type),
          created_by: checklist.created_by,
          visibility: checklist.visibility ?? 'shared',
          created_at: checklist.created_at,
        });
      }
      for (const item of snapshot.checklistItems) {
        this.insert('checklist_items', {
          id: item.id,
          checklist_id: item.checklist_id,
          name: item.name,
          quantity: item.quantity,
          owner: optional(item.owner),
          required: bool(item.required),
          completed: bool(item.completed),
          trip_day_id: optional(item.trip_day_id),
          note: optional(item.note),
          category: optional(item.category),
          source: optional(item.source),
        });
      }
    })();
  }

  readSnapshot(): AppDatabase {
    const users = (this.database.prepare('SELECT * FROM users ORDER BY created_at, id').all() as RawRow[])
      .map((row) => ({ ...row, is_active: readBool(row.is_active) } as unknown as User));
    const passwords = Object.fromEntries(
      (this.database.prepare('SELECT user_id, password_hash FROM passwords').all() as Array<{ user_id: string; password_hash: string }>)
        .map((row) => [row.user_id, row.password_hash]),
    );
    const places = (this.database.prepare(`
      SELECT p.*, COALESCE(s.status, 'want_to_go') AS status, COALESCE(s.favorite, 0) AS favorite
      FROM places p
      LEFT JOIN user_place_states s ON s.place_id = p.id AND s.user_id = p.created_by
      ORDER BY p.created_at, p.id
    `).all() as RawRow[]).map(mapPlaceRow);
    const visits = (this.database.prepare('SELECT * FROM visits ORDER BY visit_date, id').all() as RawRow[])
      .map((row) => ({ ...row } as unknown as Visit));
    const media = (this.database.prepare('SELECT * FROM media ORDER BY created_at, id').all() as RawRow[])
      .map((row) => ({ ...row, favorite: readBool(row.favorite) } as unknown as Media));
    const checklists = (this.database.prepare('SELECT * FROM checklists ORDER BY created_at, id').all() as RawRow[])
      .map((row) => ({ ...row } as unknown as Checklist));

    return {
      users,
      passwords,
      invites: this.database.prepare('SELECT * FROM invites ORDER BY created_at, id').all() as AppDatabase['invites'],
      places,
      visits,
      trips: this.database.prepare('SELECT * FROM trips ORDER BY start_date, id').all() as AppDatabase['trips'],
      tripDays: this.database.prepare('SELECT * FROM trip_days ORDER BY trip_id, day_number').all() as AppDatabase['tripDays'],
      tripItems: this.database.prepare('SELECT * FROM trip_items ORDER BY trip_day_id, sort_order').all() as AppDatabase['tripItems'],
      media,
      guides: this.database.prepare('SELECT * FROM guides ORDER BY created_at, id').all() as AppDatabase['guides'],
      checklists,
      checklistItems: (this.database.prepare('SELECT * FROM checklist_items ORDER BY checklist_id, id').all() as RawRow[]).map((row) => ({
        ...row,
        required: readBool(row.required),
        completed: readBool(row.completed),
      })) as AppDatabase['checklistItems'],
    };
  }

  integrityCheck(): string {
    return this.database.pragma('integrity_check', { simple: true }) as string;
  }

  close() {
    this.database.close();
  }
}
