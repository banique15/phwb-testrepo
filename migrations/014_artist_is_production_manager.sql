-- Migration: Add is_production_manager to phwb_artists
-- Description: Allows identifying artists who are production managers (Option B from production-manager-artist-plan)
-- Date: 2026-03-11

-- Add column
ALTER TABLE phwb_artists
  ADD COLUMN IF NOT EXISTS is_production_manager boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN phwb_artists.is_production_manager IS 'True when this artist is a production manager (type of artist).';

-- Index for filtering "Production managers" on Artists page
CREATE INDEX IF NOT EXISTS idx_phwb_artists_is_production_manager
  ON phwb_artists(is_production_manager)
  WHERE is_production_manager = true;

-- Backfill: set true where job_title is a known production manager title
UPDATE phwb_artists
SET is_production_manager = true
WHERE job_title IN (
  'PRMG - PRODUCTION MANAGER',
  'PPMG - PROGRAM & PRODUCTION MANAGER'
);
