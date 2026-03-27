-- Migration: Add missing FK between locations and facilities
-- Description: Fixes PostgREST relationship lookup used by facilities page nested select
-- Date: 2026-03-24

-- Ensure orphaned facility references do not block FK creation
UPDATE phwb_locations l
SET facility_id = NULL
WHERE facility_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM phwb_facilities f
    WHERE f.id = l.facility_id
  );

-- Add FK only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_locations_facility'
  ) THEN
    ALTER TABLE phwb_locations
      ADD CONSTRAINT fk_locations_facility
      FOREIGN KEY (facility_id)
      REFERENCES phwb_facilities(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locations_facility_id ON phwb_locations(facility_id);

