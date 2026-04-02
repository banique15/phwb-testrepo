-- Migration: Add is_band_manager to phwb_artists
-- Description: Allows identifying artists who are band managers / band leaders for ensembles.
--              Parallels the existing is_production_manager flag.
-- Date: 2026-03-12

-- Add column (idempotent via IF NOT EXISTS)
ALTER TABLE phwb_artists
  ADD COLUMN IF NOT EXISTS is_band_manager boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN phwb_artists.is_band_manager IS
  'True when this artist can serve as a band manager / band leader for an ensemble.';

-- Index for filtering "Band managers" on Artists page
CREATE INDEX IF NOT EXISTS idx_phwb_artists_is_band_manager
  ON phwb_artists(is_band_manager)
  WHERE is_band_manager = true;
