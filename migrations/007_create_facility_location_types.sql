-- Migration: Create facility_types and location_types tables
-- Description: Creates lookup tables for facility and location types, migrates existing data, and updates foreign keys
-- Date: 2026-01-09

-- Create facility_types table
CREATE TABLE IF NOT EXISTS phwb_facility_types (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  active boolean DEFAULT true NOT NULL,
  CONSTRAINT name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- Create location_types table
CREATE TABLE IF NOT EXISTS phwb_location_types (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  active boolean DEFAULT true NOT NULL,
  CONSTRAINT name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_facility_types_active ON phwb_facility_types(active);
CREATE INDEX IF NOT EXISTS idx_facility_types_name ON phwb_facility_types(name);
CREATE INDEX IF NOT EXISTS idx_location_types_active ON phwb_location_types(active);
CREATE INDEX IF NOT EXISTS idx_location_types_name ON phwb_location_types(name);

-- Migrate existing facility types from phwb_facilities.type
-- First, insert unique facility types that exist in the data
INSERT INTO phwb_facility_types (name, description, active)
SELECT DISTINCT 
  type as name,
  NULL as description,
  true as active
FROM phwb_facilities
WHERE type IS NOT NULL 
  AND trim(type) != ''
  AND type NOT IN (SELECT name FROM phwb_facility_types)
ON CONFLICT (name) DO NOTHING;

-- Add temporary column to store the new facility_type_id
ALTER TABLE phwb_facilities
  ADD COLUMN IF NOT EXISTS facility_type_id integer;

-- Map existing facility.type strings to facility_type_id
UPDATE phwb_facilities f
SET facility_type_id = ft.id
FROM phwb_facility_types ft
WHERE f.type = ft.name
  AND f.type IS NOT NULL
  AND trim(f.type) != '';

-- Add foreign key constraint for facility_type_id
ALTER TABLE phwb_facilities
  ADD CONSTRAINT fk_facility_type
  FOREIGN KEY (facility_type_id)
  REFERENCES phwb_facility_types(id)
  ON DELETE SET NULL;

-- Create index for facility_type_id
CREATE INDEX IF NOT EXISTS idx_facilities_type_id ON phwb_facilities(facility_type_id);

-- Add location_type_id column to phwb_locations
ALTER TABLE phwb_locations
  ADD COLUMN IF NOT EXISTS location_type_id integer;

-- Add foreign key constraint for location_type_id
ALTER TABLE phwb_locations
  ADD CONSTRAINT fk_location_type
  FOREIGN KEY (location_type_id)
  REFERENCES phwb_location_types(id)
  ON DELETE SET NULL;

-- Create index for location_type_id
CREATE INDEX IF NOT EXISTS idx_locations_type_id ON phwb_locations(location_type_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_facility_types_updated_at
  BEFORE UPDATE ON phwb_facility_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_types_updated_at
  BEFORE UPDATE ON phwb_location_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE phwb_facility_types IS 'Lookup table for facility types';
COMMENT ON TABLE phwb_location_types IS 'Lookup table for location types';
COMMENT ON COLUMN phwb_facilities.facility_type_id IS 'Foreign key reference to phwb_facility_types';
COMMENT ON COLUMN phwb_locations.location_type_id IS 'Foreign key reference to phwb_location_types';

-- Note: The old 'type' column in phwb_facilities is kept for now to allow gradual migration
-- It can be dropped in a future migration after verifying all data is migrated
