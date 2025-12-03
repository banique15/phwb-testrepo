-- Migration: Add CSV import fields to phwb_artists
-- Description: Adds columns to support HR CSV data import
-- Date: 2025-12-03

-- Add missing columns to phwb_artists table
ALTER TABLE phwb_artists
  -- HR System Reference
  ADD COLUMN IF NOT EXISTS associate_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS worker_category text,
  ADD COLUMN IF NOT EXISTS position_status text DEFAULT 'active',

  -- Employment Dates
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS termination_date date,

  -- Address Components (granular)
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS lived_in_state text,
  ADD COLUMN IF NOT EXISTS worked_in_state text,

  -- Additional Demographics
  ADD COLUMN IF NOT EXISTS marital_status text,

  -- Music-specific
  ADD COLUMN IF NOT EXISTS sight_reading_level text,
  ADD COLUMN IF NOT EXISTS ensembles_text text,

  -- Onboarding
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS llc_name text;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_artists_associate_id ON phwb_artists(associate_id);
CREATE INDEX IF NOT EXISTS idx_artists_position_status ON phwb_artists(position_status);
CREATE INDEX IF NOT EXISTS idx_artists_job_title ON phwb_artists(job_title);
CREATE INDEX IF NOT EXISTS idx_artists_hire_date ON phwb_artists(hire_date);

-- Add check constraint for position_status
ALTER TABLE phwb_artists
  DROP CONSTRAINT IF EXISTS position_status_check;
ALTER TABLE phwb_artists
  ADD CONSTRAINT position_status_check
  CHECK (position_status IS NULL OR position_status IN ('active', 'terminated', 'on_leave'));

-- Add comments for documentation
COMMENT ON COLUMN phwb_artists.associate_id IS 'HR system associate ID (e.g., VYWWIIH9H)';
COMMENT ON COLUMN phwb_artists.job_title IS 'Job title code (MUSC, ARPRT, ARPTS, etc.)';
COMMENT ON COLUMN phwb_artists.worker_category IS 'Worker category (P - Part Time, etc.)';
COMMENT ON COLUMN phwb_artists.position_status IS 'Position status: active, terminated, on_leave';
COMMENT ON COLUMN phwb_artists.hire_date IS 'Date of hire';
COMMENT ON COLUMN phwb_artists.termination_date IS 'Date of termination (if applicable)';
COMMENT ON COLUMN phwb_artists.address_line_2 IS 'Secondary address line (apt, unit, etc.)';
COMMENT ON COLUMN phwb_artists.city IS 'City of residence';
COMMENT ON COLUMN phwb_artists.state IS 'State/territory of residence';
COMMENT ON COLUMN phwb_artists.zip_code IS 'ZIP/postal code';
COMMENT ON COLUMN phwb_artists.lived_in_state IS 'State where artist lives (for tax purposes)';
COMMENT ON COLUMN phwb_artists.worked_in_state IS 'State where artist works (for tax purposes)';
COMMENT ON COLUMN phwb_artists.marital_status IS 'Marital status description';
COMMENT ON COLUMN phwb_artists.sight_reading_level IS 'Level of sight reading ability (text description)';
COMMENT ON COLUMN phwb_artists.ensembles_text IS 'Raw ensemble text from CSV (before linking)';
COMMENT ON COLUMN phwb_artists.onboarding_complete IS 'Whether artist has completed onboarding';
COMMENT ON COLUMN phwb_artists.llc_name IS 'LLC or company name (for 1099 contractors)';
