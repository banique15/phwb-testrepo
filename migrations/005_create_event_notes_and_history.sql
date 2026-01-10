-- Migration: Create event notes and history tables
-- Description: Adds support for multiple notes with timestamps and comprehensive history tracking
-- Date: 2025-01-XX

-- Create event notes table
CREATE TABLE IF NOT EXISTS phwb_event_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES phwb_events(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT notes_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create event history table
CREATE TABLE IF NOT EXISTS phwb_event_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES phwb_events(id) ON DELETE CASCADE,
  action text NOT NULL,
  field text,
  previous_value text,
  new_value text,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT history_action_check CHECK (
    action IN ('create', 'update', 'delete', 'note_added', 'note_updated', 'note_deleted', 'field_changed')
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_notes_event_id ON phwb_event_notes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_notes_created_at ON phwb_event_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_history_event_id ON phwb_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_event_history_created_at ON phwb_event_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_history_action ON phwb_event_history(action);

-- Create updated_at trigger for event notes
CREATE OR REPLACE FUNCTION update_event_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_event_notes_updated_at ON phwb_event_notes;
CREATE TRIGGER update_event_notes_updated_at
  BEFORE UPDATE ON phwb_event_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_event_notes_updated_at();

-- Add comments for documentation
COMMENT ON TABLE phwb_event_notes IS 'Stores multiple notes for events with timestamps and user tracking';
COMMENT ON COLUMN phwb_event_notes.event_id IS 'Reference to the event';
COMMENT ON COLUMN phwb_event_notes.content IS 'Note content';
COMMENT ON COLUMN phwb_event_notes.created_by IS 'User who created the note';
COMMENT ON COLUMN phwb_event_notes.updated_by IS 'User who last updated the note';

COMMENT ON TABLE phwb_event_history IS 'Comprehensive audit log for all event changes';
COMMENT ON COLUMN phwb_event_history.event_id IS 'Reference to the event';
COMMENT ON COLUMN phwb_event_history.action IS 'Type of action performed';
COMMENT ON COLUMN phwb_event_history.field IS 'Field that was changed (for update actions)';
COMMENT ON COLUMN phwb_event_history.previous_value IS 'Previous value (for update actions)';
COMMENT ON COLUMN phwb_event_history.new_value IS 'New value (for update actions)';
COMMENT ON COLUMN phwb_event_history.metadata IS 'Additional metadata about the change';
COMMENT ON COLUMN phwb_event_history.created_by IS 'User who performed the action';

