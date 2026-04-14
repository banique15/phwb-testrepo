-- Migration: Add setlist_review_notes column to phwb_events
-- Description: Adds a nullable TEXT column for setlist review notes on events
-- Bug: #33 - [STRICT E2E Full-Stack] Events: Add required setlist_review_notes field with migration
-- Date: 2026-04-14

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS
  'Optional notes related to setlist review for this event. NULL for events that do not require setlist review.';
