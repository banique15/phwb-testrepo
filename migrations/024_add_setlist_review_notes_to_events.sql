-- Migration: Add setlist_review_notes column to phwb_events
-- Bug #33: Events need a nullable TEXT field for setlist review notes.
-- Backward-safe: nullable column, existing rows get NULL automatically.

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional notes for setlist review, populated when a setlist review is required for this event';
