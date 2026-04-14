-- Migration 024: Add setlist_review_notes column to phwb_events
-- Bug #33: Events need a nullable TEXT field for setlist review notes.
-- Backward-safe: existing rows default to NULL, which is handled gracefully in the UI.

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS
  'Optional notes entered by staff when reviewing the event setlist. NULL for events where no review notes exist.';
