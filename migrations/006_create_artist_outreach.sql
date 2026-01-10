-- Migration: Create artist outreach tracking table
-- Description: Adds support for tracking artist outreach attempts and confirmation workflow
-- Date: 2025-12-08

-- Create the outreach tracking table
CREATE TABLE IF NOT EXISTS phwb_artist_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES phwb_events(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES phwb_artists(id) ON DELETE CASCADE,

  -- Outreach details
  outreach_date timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL CHECK (method IN ('email', 'phone', 'text', 'in_person', 'other')),
  notes text,

  -- Who performed the outreach
  performed_by uuid REFERENCES auth.users(id),

  -- Response tracking (optional - filled in when artist responds)
  response_received_at timestamptz,
  response_type text CHECK (response_type IS NULL OR response_type IN ('confirmed', 'declined', 'maybe', 'no_response')),

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT outreach_notes_length CHECK (notes IS NULL OR length(notes) <= 2000)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_artist_outreach_event_id ON phwb_artist_outreach(event_id);
CREATE INDEX IF NOT EXISTS idx_artist_outreach_artist_id ON phwb_artist_outreach(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_outreach_date ON phwb_artist_outreach(outreach_date DESC);
CREATE INDEX IF NOT EXISTS idx_artist_outreach_event_artist ON phwb_artist_outreach(event_id, artist_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_artist_outreach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_artist_outreach_updated_at ON phwb_artist_outreach;
CREATE TRIGGER update_artist_outreach_updated_at
  BEFORE UPDATE ON phwb_artist_outreach
  FOR EACH ROW
  EXECUTE FUNCTION update_artist_outreach_updated_at();

-- Add comments for documentation
COMMENT ON TABLE phwb_artist_outreach IS 'Tracks outreach attempts to artists for event confirmation';
COMMENT ON COLUMN phwb_artist_outreach.event_id IS 'Reference to the event';
COMMENT ON COLUMN phwb_artist_outreach.artist_id IS 'Reference to the artist being contacted';
COMMENT ON COLUMN phwb_artist_outreach.outreach_date IS 'When the outreach attempt was made';
COMMENT ON COLUMN phwb_artist_outreach.method IS 'Communication method: email, phone, text, in_person, other';
COMMENT ON COLUMN phwb_artist_outreach.notes IS 'Notes about the outreach attempt';
COMMENT ON COLUMN phwb_artist_outreach.performed_by IS 'User who performed the outreach';
COMMENT ON COLUMN phwb_artist_outreach.response_received_at IS 'When the artist responded (if applicable)';
COMMENT ON COLUMN phwb_artist_outreach.response_type IS 'Artist response: confirmed, declined, maybe, no_response';
