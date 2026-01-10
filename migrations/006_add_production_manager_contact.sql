-- Migration: Add production_manager_contact_id to phwb_events
-- Description: Adds column to link events to production manager contacts from location contacts
-- Date: 2026-01-09

-- Add production_manager_contact_id column to phwb_events table
ALTER TABLE phwb_events
  ADD COLUMN IF NOT EXISTS production_manager_contact_id integer;

-- Add foreign key constraint to phwb_location_contacts
ALTER TABLE phwb_events
  ADD CONSTRAINT fk_production_manager_contact
  FOREIGN KEY (production_manager_contact_id)
  REFERENCES phwb_location_contacts(id)
  ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN phwb_events.production_manager_contact_id IS 'Reference to the production manager contact from phwb_location_contacts';
