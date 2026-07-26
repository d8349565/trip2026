ALTER TABLE media ADD COLUMN metadata_status TEXT
  CHECK (metadata_status IN ('found', 'not_found', 'unsupported', 'parse_error', 'probe_unavailable'));
ALTER TABLE media ADD COLUMN metadata_parser TEXT
  CHECK (metadata_parser IN ('client-exifr', 'server-exifr'));
ALTER TABLE media ADD COLUMN metadata_error_code TEXT;
