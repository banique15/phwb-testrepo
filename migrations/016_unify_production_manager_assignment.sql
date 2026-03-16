-- Migration: Unify production manager assignment across artists and non-artists
-- Description:
--   1) Link phwb_production_managers rows to artists via artist_id (optional)
--   2) Add phwb_events.production_manager_id as the primary PM assignment field
--   3) Backfill PM rows for artists flagged as is_production_manager
--   4) Backfill events.production_manager_id from events.production_manager_artist_id
-- Date: 2026-03-11

-- Ensure base table exists in environments that did not run 013 yet
CREATE TABLE IF NOT EXISTS phwb_production_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  full_name text,
  legal_first_name text,
  legal_last_name text,
  email text,
  phone text,
  location text,
  address text,
  address_line_2 text,
  city text,
  state text,
  zip_code text,
  notes text,
  user_id uuid,
  facility_id integer
);

-- 1) Extend production managers with optional artist linkage + source type
ALTER TABLE phwb_production_managers
  ADD COLUMN IF NOT EXISTS artist_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'non_artist';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_production_managers_artist'
  ) THEN
    ALTER TABLE phwb_production_managers
      ADD CONSTRAINT fk_production_managers_artist
      FOREIGN KEY (artist_id)
      REFERENCES phwb_artists(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_production_managers_source_type'
  ) THEN
    ALTER TABLE phwb_production_managers
      ADD CONSTRAINT chk_production_managers_source_type
      CHECK (source_type IN ('artist', 'non_artist'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_managers_artist_id_unique
  ON phwb_production_managers(artist_id)
  WHERE artist_id IS NOT NULL;

-- 2) Add unified PM reference on events
ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS production_manager_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_events_production_manager'
  ) THEN
    ALTER TABLE phwb_events
      ADD CONSTRAINT fk_events_production_manager
      FOREIGN KEY (production_manager_id)
      REFERENCES phwb_production_managers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN phwb_events.production_manager_id IS
  'Primary production manager assignment (artist-backed or non-artist) linked to phwb_production_managers.';

CREATE INDEX IF NOT EXISTS idx_phwb_events_production_manager_id
  ON phwb_events(production_manager_id)
  WHERE production_manager_id IS NOT NULL;

-- 3) Backfill PM rows for artists currently flagged as production managers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phwb_artists'
      AND column_name = 'is_production_manager'
  ) THEN
    INSERT INTO phwb_production_managers (
      full_name,
      legal_first_name,
      legal_last_name,
      email,
      phone,
      location,
      address,
      address_line_2,
      city,
      state,
      zip_code,
      artist_id,
      source_type
    )
    SELECT
      a.full_name,
      a.legal_first_name,
      a.legal_last_name,
      a.email,
      a.phone,
      a.location,
      a.address,
      a.address_line_2,
      a.city,
      a.state,
      a.zip_code,
      a.id,
      'artist'
    FROM phwb_artists a
    WHERE a.is_production_manager = true
      AND NOT EXISTS (
        SELECT 1
        FROM phwb_production_managers pm
        WHERE pm.artist_id = a.id
      );
  END IF;
END $$;

-- Keep source_type accurate for already linked rows
UPDATE phwb_production_managers
SET source_type = 'artist'
WHERE artist_id IS NOT NULL
  AND source_type <> 'artist';

-- 4) Backfill events.production_manager_id from legacy artist PM assignment
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phwb_events'
      AND column_name = 'production_manager_artist_id'
  ) THEN
    UPDATE phwb_events e
    SET production_manager_id = pm.id
    FROM phwb_production_managers pm
    WHERE e.production_manager_id IS NULL
      AND e.production_manager_artist_id IS NOT NULL
      AND pm.artist_id = e.production_manager_artist_id;
  END IF;
END $$;
