-- Migration: Add setlist_review_notes column to phwb_events
-- Bug #33: Events need a nullable TEXT field for setlist review notes.
-- Backward-safe: existing rows will have NULL (no data loss).
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to re-run.

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional free-text notes captured during setlist review for this event';
