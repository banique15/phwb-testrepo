-- Migration 024: Add setlist_review_notes column to phwb_events
-- Bug #33 – Events: Add required setlist_review_notes field with migration
-- This column is nullable TEXT so existing rows (NULL value) remain safe.

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS
  'Free-text notes entered by staff during setlist review for this event. NULL means no review notes have been entered yet.';
