-- Migration 024: Add setlist_review_notes column to phwb_events
-- Bug #33: Events: Add required setlist_review_notes field with migration
-- Adds a nullable TEXT column for setlist review notes.
-- Backward-safe: existing rows with NULL value render safely.

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS
  'Optional notes for setlist review. Populated by staff when reviewing the event setlist.';
