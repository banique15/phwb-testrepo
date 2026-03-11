-- Migration: Add production_manager_artist_id to phwb_events
-- Description: Link events to a production manager via artist record (artist with is_production_manager = true).
--              Independent of facility/location. Optional; production_manager_contact_id remains for legacy.
-- Date: 2026-03-11

-- Add column: reference to phwb_artists (artist who is a production manager)
ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS production_manager_artist_id uuid;

-- Foreign key to artists (only artists with is_production_manager = true should be assigned)
ALTER TABLE phwb_events
  ADD CONSTRAINT fk_events_production_manager_artist
  FOREIGN KEY (production_manager_artist_id)
  REFERENCES phwb_artists(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN phwb_events.production_manager_artist_id IS 'Artist (with is_production_manager = true) assigned as production manager for this event.';

CREATE INDEX IF NOT EXISTS idx_phwb_events_production_manager_artist_id
  ON phwb_events(production_manager_artist_id)
  WHERE production_manager_artist_id IS NOT NULL;
