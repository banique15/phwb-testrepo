-- Migration: Prepare phwb_artists table for Instant data import
-- Description: Adds missing columns to support full Instant artist data
-- Date: 2025-10-22

-- Add missing columns to phwb_artists table
ALTER TABLE phwb_artists
  -- Name fields
  ADD COLUMN IF NOT EXISTS middle_name text,

  -- Contact fields
  ADD COLUMN IF NOT EXISTS work_email text,

  -- Address fields
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA',

  -- Professional fields
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS tax_id text, -- Store encrypted

  -- Demographic fields
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS race text,
  ADD COLUMN IF NOT EXISTS disability text,

  -- Emergency contact (stored as JSONB)
  ADD COLUMN IF NOT EXISTS emergency_contact jsonb,
  -- Example: {"name": "John Doe", "phone": "+1234567890"}

  -- Tracking fields
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS instant_id text UNIQUE, -- Original Instant DB ID for reference

  -- Internal notes (if not already using history jsonb)
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Create index on instant_id for faster lookups during migration
CREATE INDEX IF NOT EXISTS idx_artists_instant_id ON phwb_artists(instant_id);

-- Create index on work_email for searching
CREATE INDEX IF NOT EXISTS idx_artists_work_email ON phwb_artists(work_email);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_phwb_artists_updated_at ON phwb_artists;
CREATE TRIGGER update_phwb_artists_updated_at
    BEFORE UPDATE ON phwb_artists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to new columns for documentation
COMMENT ON COLUMN phwb_artists.middle_name IS 'Artist middle name from Instant DB';
COMMENT ON COLUMN phwb_artists.work_email IS 'Artist work/professional email';
COMMENT ON COLUMN phwb_artists.country IS 'Country of residence, defaults to USA';
COMMENT ON COLUMN phwb_artists.company_name IS 'Company or organization name';
COMMENT ON COLUMN phwb_artists.employment_type IS 'Employment type from Instant (employee, contractor, etc.)';
COMMENT ON COLUMN phwb_artists.tax_id IS 'Tax ID or SSN - should be encrypted at application layer';
COMMENT ON COLUMN phwb_artists.gender IS 'Gender identity';
COMMENT ON COLUMN phwb_artists.ethnicity IS 'Ethnicity information';
COMMENT ON COLUMN phwb_artists.race IS 'Race information';
COMMENT ON COLUMN phwb_artists.disability IS 'Disability information';
COMMENT ON COLUMN phwb_artists.emergency_contact IS 'Emergency contact information as JSON: {name, phone}';
COMMENT ON COLUMN phwb_artists.updated_at IS 'Last updated timestamp, auto-updated on changes';
COMMENT ON COLUMN phwb_artists.instant_id IS 'Original Instant DB ID for migration tracking';
COMMENT ON COLUMN phwb_artists.internal_notes IS 'Internal administrative notes';
