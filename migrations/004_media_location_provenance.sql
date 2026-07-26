ALTER TABLE media ADD COLUMN source_latitude REAL;
ALTER TABLE media ADD COLUMN source_longitude REAL;
ALTER TABLE media ADD COLUMN source_coordinate_system TEXT
  CHECK (source_coordinate_system IN ('WGS84', 'GCJ02'));
ALTER TABLE media ADD COLUMN location_source TEXT
  CHECK (location_source IN ('exif', 'xmp', 'browser', 'manual'));
ALTER TABLE media ADD COLUMN location_accuracy_m REAL
  CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0);
ALTER TABLE media ADD COLUMN location_observed_at TEXT;

UPDATE media
SET source_latitude = exif_latitude,
    source_longitude = exif_longitude,
    source_coordinate_system = 'WGS84',
    location_source = 'exif'
WHERE exif_latitude IS NOT NULL
  AND exif_longitude IS NOT NULL;
