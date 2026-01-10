-- Migration: Add number_of_attendees to phwb_events
-- Description: Adds column to track expected number of attendees for an event
-- Date: 2026-01-09

-- Add number_of_attendees column to phwb_events table
ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS number_of_attendees integer;

-- Add comment for documentation
COMMENT ON COLUMN phwb_events.number_of_attendees IS 'Expected or actual number of attendees for the event';
