-- Migration: Create bug testing sessions table
-- Description: Creates table to store manual testing sessions with transcripts, media, and results
-- Date: 2026-01-23

-- Create bug testing sessions table
CREATE TABLE IF NOT EXISTS phwb_bug_testing_sessions (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Bug and tester references
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  tester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Session metadata
  title text NOT NULL,
  status text NOT NULL,
  environment text,
  
  -- Testing content
  transcript text,
  summary text,
  media jsonb,
  tested_issue_ids integer[],
  
  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Constraints
  CONSTRAINT testing_status_check CHECK (status IN ('pass', 'fail', 'partial', 'blocked')),
  CONSTRAINT title_not_empty CHECK (char_length(trim(title)) > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bug_testing_sessions_bug_id ON phwb_bug_testing_sessions(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_testing_sessions_tester_id ON phwb_bug_testing_sessions(tester_id);
CREATE INDEX IF NOT EXISTS idx_bug_testing_sessions_status ON phwb_bug_testing_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bug_testing_sessions_created_at ON phwb_bug_testing_sessions(created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_bug_testing_sessions_updated_at
  BEFORE UPDATE ON phwb_bug_testing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE phwb_bug_testing_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phwb_bug_testing_sessions
-- All authenticated users can view testing sessions
CREATE POLICY "All authenticated users can view testing sessions"
  ON phwb_bug_testing_sessions FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create testing sessions
CREATE POLICY "All authenticated users can create testing sessions"
  ON phwb_bug_testing_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own testing sessions
CREATE POLICY "Users can update their own testing sessions"
  ON phwb_bug_testing_sessions FOR UPDATE
  TO authenticated
  USING (tester_id = auth.uid())
  WITH CHECK (tester_id = auth.uid());

-- All authenticated users can delete testing sessions (for now - can restrict later)
CREATE POLICY "Users can delete testing sessions"
  ON phwb_bug_testing_sessions FOR DELETE
  TO authenticated
  USING (true);

-- Add table comment
COMMENT ON TABLE phwb_bug_testing_sessions IS 'Manual testing sessions with transcripts, screenshots, and test results';
COMMENT ON COLUMN phwb_bug_testing_sessions.media IS 'JSONB array storing media items: [{ url: string, type: string, caption: string }]';
COMMENT ON COLUMN phwb_bug_testing_sessions.tested_issue_ids IS 'Array of bug IDs that were tested in this session';
