-- Migration 024: Add setlist_review_notes column to phwb_events
-- Bug #33 - [STRICT E2E Full-Stack] Events: Add required setlist_review_notes field with migration
--
-- Adds a nullable TEXT column so existing events (NULL value) render safely.
-- The field is managed through the Events create/edit UI and persisted via the
-- existing event save/update flow (eventsStore + /api/events/[id] PATCH route).

ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS setlist_review_notes TEXT;

COMMENT ON COLUMN phwb_events.setlist_review_notes IS 'Optional setlist review notes for the event. NULL for events that do not require a setlist review.';
