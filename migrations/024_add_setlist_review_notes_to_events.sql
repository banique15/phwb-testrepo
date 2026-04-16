-- Migration: Add setlist_review_notes column to phwb_events
-- Bug #33: Events require a nullable TEXT field for setlist review notes.
-- Backward-safe: existing rows get NULL (valid for a nullable column).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional notes written during setlist review for this event. NULL is valid for events that have not undergone setlist review.';
