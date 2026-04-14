-- Migration: Add setlist_review_notes column to phwb_events
-- Bug #33: Events – Add required setlist_review_notes field
-- Column is nullable TEXT so existing rows with NULL render safely (backward compatible).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional notes from the setlist review process for this event.';
