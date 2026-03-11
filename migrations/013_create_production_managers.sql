-- Migration: Create production managers table and link to location contacts
-- Description: Adds phwb_production_managers table and optional production_manager_id on phwb_location_contacts
-- Date: 2026-03-11

-- Create production managers table
CREATE TABLE IF NOT EXISTS phwb_production_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Core identity fields (modeled after artists but simplified)
  full_name text,
  legal_first_name text,
  legal_last_name text,
  email text,
  phone text,
  location text,
  address text,
  address_line_2 text,
  city text,
  state text,
  zip_code text,
  notes text,
  -- Optional linkage to auth.users for future authenticated PM accounts
  user_id uuid,
  -- Optional primary facility linkage
  facility_id integer
);

-- Add foreign key for facility_id if facilities table exists
ALTER TABLE phwb_production_managers
  ADD CONSTRAINT IF NOT EXISTS fk_production_managers_facility
  FOREIGN KEY (facility_id)
  REFERENCES phwb_facilities(id)
  ON DELETE SET NULL;

-- Add index to speed up lookups by user_id
CREATE INDEX IF NOT EXISTS idx_production_managers_user_id
  ON phwb_production_managers(user_id);

-- Add index for facility_id lookups
CREATE INDEX IF NOT EXISTS idx_production_managers_facility_id
  ON phwb_production_managers(facility_id);

-- Link location contacts to production managers (optional association)
ALTER TABLE phwb_location_contacts
  ADD COLUMN IF NOT EXISTS production_manager_id uuid;

ALTER TABLE phwb_location_contacts
  ADD CONSTRAINT IF NOT EXISTS fk_location_contacts_production_manager
  FOREIGN KEY (production_manager_id)
  REFERENCES phwb_production_managers(id)
  ON DELETE SET NULL;

