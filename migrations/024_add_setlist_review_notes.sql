-- Migration: Add setlist_review_notes column to phwb_events
-- Bug #33: Events need a setlist_review_notes field for events that require setlist review.
-- This column is nullable TEXT so existing events with NULL render safely (backward-compatible).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional notes for setlist review. NULL for events that do not require review.';
