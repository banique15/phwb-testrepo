-- Migration: Add artist-level bandleader flag for ensemble preselection

ALTER TABLE phwb_artists
  ADD COLUMN IF NOT EXISTS is_bandleader BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN phwb_artists.is_bandleader IS
  'True when this artist should be preselected as bandleader when added in ensembles/events.';

CREATE INDEX IF NOT EXISTS idx_phwb_artists_is_bandleader
  ON phwb_artists(is_bandleader)
  WHERE is_bandleader = true;
