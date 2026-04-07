-- Migration 024: Add setlist_review_notes column to phwb_events
-- Ticket: #33 – Events: Add required setlist_review_notes field
-- Nullable TEXT column; existing rows will have NULL (backward-safe).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Free-text notes captured during the setlist review process for this event. NULL for events that pre-date this column or have no review notes yet.';
