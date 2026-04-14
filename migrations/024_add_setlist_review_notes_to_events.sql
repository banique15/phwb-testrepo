-- Migration 024: Add setlist_review_notes to phwb_events
-- Ticket: #33 - Events: Add required setlist_review_notes field
-- This column is nullable TEXT so existing rows remain valid (backward-compatible).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional notes for setlist review process; null for events that do not require setlist review.';
