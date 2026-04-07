-- Migration: 024_add_setlist_review_notes_to_events.sql
-- Description: Add nullable TEXT column setlist_review_notes to phwb_events
-- Backward-safe: existing rows will have NULL value which is handled safely in UI
-- Idempotent: uses IF NOT EXISTS guard

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Internal notes captured during the setlist review process for an event. Nullable – existing events default to NULL.';
