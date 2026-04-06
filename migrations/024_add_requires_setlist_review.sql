-- Migration: Add requires_setlist_review boolean column to phwb_events
-- Bug #32: Events – Add Requires Setlist Review toggle with persistence
-- This column defaults to FALSE so all existing events are unaffected.

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS requires_setlist_review BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN phwb_events.requires_setlist_review IS
  'When TRUE, coordinators have flagged this event as requiring a setlist review before approval.';
