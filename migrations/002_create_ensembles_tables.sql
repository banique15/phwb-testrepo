-- Migration: Create ensembles tables
-- Description: Creates phwb_ensembles and phwb_ensemble_members tables
-- Date: 2025-10-22

-- Create ensembles table
CREATE TABLE IF NOT EXISTS phwb_ensembles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Core fields
  name text NOT NULL,
  description text,
  ensemble_type text NOT NULL, -- e.g., 'band', 'orchestra', 'quartet', 'duo'
  status text NOT NULL DEFAULT 'active',
  website text,

  -- Leader/director
  leader_id uuid REFERENCES phwb_artists(id) ON DELETE SET NULL,

  -- Migration tracking
  instant_id text UNIQUE,

  -- Constraints
  CONSTRAINT status_check CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT name_not_empty CHECK (char_length(name) > 0)
);

-- Create ensemble members junction table
CREATE TABLE IF NOT EXISTS phwb_ensemble_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Relationships
  ensemble_id uuid NOT NULL REFERENCES phwb_ensembles(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES phwb_artists(id) ON DELETE CASCADE,

  -- Member details
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  role text, -- e.g., 'vocalist', 'pianist', 'guitarist'
  is_active boolean DEFAULT true,

  -- Prevent duplicate memberships
  UNIQUE(ensemble_id, artist_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ensembles_status ON phwb_ensembles(status);
CREATE INDEX IF NOT EXISTS idx_ensembles_type ON phwb_ensembles(ensemble_type);
CREATE INDEX IF NOT EXISTS idx_ensembles_leader ON phwb_ensembles(leader_id);
CREATE INDEX IF NOT EXISTS idx_ensembles_instant_id ON phwb_ensembles(instant_id);

CREATE INDEX IF NOT EXISTS idx_ensemble_members_ensemble ON phwb_ensemble_members(ensemble_id);
CREATE INDEX IF NOT EXISTS idx_ensemble_members_artist ON phwb_ensemble_members(artist_id);
CREATE INDEX IF NOT EXISTS idx_ensemble_members_active ON phwb_ensemble_members(is_active) WHERE is_active = true;

-- Create updated_at trigger for ensembles
DROP TRIGGER IF EXISTS update_phwb_ensembles_updated_at ON phwb_ensembles;
CREATE TRIGGER update_phwb_ensembles_updated_at
    BEFORE UPDATE ON phwb_ensembles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE phwb_ensembles IS 'Musical ensembles and groups';
COMMENT ON COLUMN phwb_ensembles.ensemble_type IS 'Type of ensemble (band, orchestra, quartet, etc.)';
COMMENT ON COLUMN phwb_ensembles.status IS 'Current status: active, inactive, or archived';
COMMENT ON COLUMN phwb_ensembles.leader_id IS 'Artist who leads or directs the ensemble';
COMMENT ON COLUMN phwb_ensembles.instant_id IS 'Original Instant DB ID for migration tracking';

COMMENT ON TABLE phwb_ensemble_members IS 'Junction table linking artists to ensembles';
COMMENT ON COLUMN phwb_ensemble_members.role IS 'Artist role in the ensemble (vocalist, pianist, etc.)';
COMMENT ON COLUMN phwb_ensemble_members.is_active IS 'Whether the artist is currently active in the ensemble';
COMMENT ON COLUMN phwb_ensemble_members.left_at IS 'When the artist left the ensemble (if applicable)';

-- Create view for active ensemble memberships
CREATE OR REPLACE VIEW active_ensemble_members AS
SELECT
  em.id,
  em.ensemble_id,
  e.name as ensemble_name,
  em.artist_id,
  a.full_name as artist_name,
  em.role,
  em.joined_at
FROM phwb_ensemble_members em
JOIN phwb_ensembles e ON em.ensemble_id = e.id
JOIN phwb_artists a ON em.artist_id = a.id
WHERE em.is_active = true
  AND e.status = 'active';

COMMENT ON VIEW active_ensemble_members IS 'Active memberships in active ensembles with artist and ensemble names';
