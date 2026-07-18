CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE passwords (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'legacy_sha256'
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  coordinate_system TEXT NOT NULL CHECK (coordinate_system IN ('WGS84', 'GCJ02')),
  address TEXT NOT NULL DEFAULT '',
  province TEXT,
  city TEXT,
  district TEXT,
  poi_provider TEXT,
  poi_id TEXT,
  cover_image TEXT,
  summary TEXT,
  rating REAL CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'shared')),
  recommended INTEGER NOT NULL DEFAULT 0 CHECK (recommended IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_wet INTEGER CHECK (is_wet IS NULL OR is_wet IN (0, 1)),
  need_hiking INTEGER CHECK (need_hiking IS NULL OR need_hiking IN (0, 1)),
  rainy_ready INTEGER CHECK (rainy_ready IS NULL OR rainy_ready IN (0, 1)),
  has_signal INTEGER CHECK (has_signal IS NULL OR has_signal IN (0, 1)),
  risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')),
  best_season TEXT,
  ticket_price TEXT,
  open_hours TEXT,
  suggested_duration TEXT,
  has_parking INTEGER CHECK (has_parking IS NULL OR has_parking IN (0, 1)),
  has_restroom INTEGER CHECK (has_restroom IS NULL OR has_restroom IN (0, 1)),
  has_charging INTEGER CHECK (has_charging IS NULL OR has_charging IN (0, 1)),
  difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'moderate', 'hard')),
  UNIQUE (poi_provider, poi_id)
);

CREATE TABLE user_place_states (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'want_to_go' CHECK (status IN ('want_to_go', 'visited')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, place_id)
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  destination_summary TEXT NOT NULL DEFAULT '',
  travel_mode TEXT NOT NULL CHECK (travel_mode IN ('drive', 'train', 'flight', 'other')),
  participants TEXT NOT NULL DEFAULT '',
  vehicle TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled')),
  budget REAL CHECK (budget IS NULL OR budget >= 0),
  cover_image TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'shared')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visit_date TEXT NOT NULL,
  companions TEXT,
  weather TEXT,
  rating REAL NOT NULL CHECK (rating BETWEEN 0 AND 5),
  note TEXT,
  actual_cost REAL CHECK (actual_cost IS NULL OR actual_cost >= 0),
  revisit_intention TEXT NOT NULL CHECK (revisit_intention IN ('yes', 'maybe', 'no'))
);

CREATE TABLE trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  departure_place TEXT,
  destination_place TEXT,
  planned_distance REAL CHECK (planned_distance IS NULL OR planned_distance >= 0),
  planned_drive_time INTEGER CHECK (planned_drive_time IS NULL OR planned_drive_time >= 0),
  planned_cost REAL CHECK (planned_cost IS NULL OR planned_cost >= 0),
  intensity TEXT CHECK (intensity IS NULL OR intensity IN ('easy', 'moderate', 'hard')),
  weather_note TEXT,
  risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')),
  notes TEXT,
  UNIQUE (trip_id, day_number),
  UNIQUE (trip_id, date)
);

CREATE TABLE trip_items (
  id TEXT PRIMARY KEY,
  trip_day_id TEXT NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration INTEGER CHECK (duration IS NULL OR duration >= 0),
  booking_status TEXT CHECK (booking_status IS NULL OR booking_status IN ('unbooked', 'booked', 'na')),
  cost REAL CHECK (cost IS NULL OR cost >= 0),
  priority TEXT NOT NULL CHECK (priority IN ('must', 'optional', 'backup')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'skipped')),
  note TEXT,
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  UNIQUE (trip_day_id, sort_order)
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  captured_at TEXT,
  exif_latitude REAL,
  exif_longitude REAL,
  display_latitude REAL,
  display_longitude REAL,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'shared')),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, file_hash)
);

CREATE TABLE guides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('place', 'city', 'theme', 'general')),
  target_id TEXT,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  verified_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'shared')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE checklists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  template_type TEXT CHECK (template_type IS NULL OR template_type IN ('stream', 'drive', 'general', 'family')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visibility TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('private', 'shared')),
  created_at TEXT NOT NULL
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  owner TEXT,
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  trip_day_id TEXT REFERENCES trip_days(id) ON DELETE SET NULL,
  note TEXT,
  category TEXT,
  source TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_places_created_by ON places(created_by);
CREATE INDEX idx_places_visibility ON places(visibility);
CREATE INDEX idx_visits_place ON visits(place_id);
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id, day_number);
CREATE INDEX idx_trip_items_day ON trip_items(trip_day_id, sort_order);
CREATE INDEX idx_media_place ON media(place_id, created_at);
CREATE INDEX idx_media_trip ON media(trip_id, created_at);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
