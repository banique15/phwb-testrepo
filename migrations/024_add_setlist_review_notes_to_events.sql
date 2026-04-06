-- Migration: Add setlist_review_notes column to phwb_events
-- Bug #33 — Events: Add required setlist_review_notes field
-- Adds a nullable TEXT column so existing rows remain unaffected (backward-compatible).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS
  'Optional reviewer notes about the event setlist; null for events that do not require setlist review.';
