-- Migration: Create dev agent logs and bug testing sessions tables
-- Description: Adds missing tables referenced by bug detail/dev-fix UI and API routes
-- Date: 2026-03-24

-- Dev agent workflow logs (used by /api/bugs/:id/dev-logs and bug detail live logs)
CREATE TABLE IF NOT EXISTS phwb_dev_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  step text NOT NULL,
  message text NOT NULL,
  level text DEFAULT 'info' NOT NULL,
  workflow_id text,
  CONSTRAINT phwb_dev_logs_level_check CHECK (level IN ('info', 'success', 'warning', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_phwb_dev_logs_bug_id ON phwb_dev_logs(bug_id);
CREATE INDEX IF NOT EXISTS idx_phwb_dev_logs_created_at ON phwb_dev_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_phwb_dev_logs_workflow_id ON phwb_dev_logs(workflow_id);

-- Structured testing sessions for bugs (used by BugTesting.svelte and bug detail page load)
CREATE TABLE IF NOT EXISTS phwb_bug_testing_sessions (
  id BIGSERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  tester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Testing Session',
  status text NOT NULL DEFAULT 'pass',
  environment text,
  transcript text,
  summary text,
  media jsonb DEFAULT '[]'::jsonb,
  tested_issue_ids integer[] DEFAULT '{}'::integer[],
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT phwb_bug_testing_sessions_status_check CHECK (status IN ('pass', 'fail', 'partial', 'blocked')),
  CONSTRAINT phwb_bug_testing_sessions_title_not_empty CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_phwb_bug_testing_sessions_bug_id ON phwb_bug_testing_sessions(bug_id);
CREATE INDEX IF NOT EXISTS idx_phwb_bug_testing_sessions_tester_id ON phwb_bug_testing_sessions(tester_id);
CREATE INDEX IF NOT EXISTS idx_phwb_bug_testing_sessions_created_at ON phwb_bug_testing_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_phwb_bug_testing_sessions_status ON phwb_bug_testing_sessions(status);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_bug_testing_sessions_updated_at ON phwb_bug_testing_sessions;
CREATE TRIGGER update_bug_testing_sessions_updated_at
  BEFORE UPDATE ON phwb_bug_testing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE phwb_dev_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_testing_sessions ENABLE ROW LEVEL SECURITY;

-- Logs: all authenticated users can read/write in app context
DROP POLICY IF EXISTS "All authenticated users can view dev logs" ON phwb_dev_logs;
CREATE POLICY "All authenticated users can view dev logs"
  ON phwb_dev_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "All authenticated users can insert dev logs" ON phwb_dev_logs;
CREATE POLICY "All authenticated users can insert dev logs"
  ON phwb_dev_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "All authenticated users can delete dev logs" ON phwb_dev_logs;
CREATE POLICY "All authenticated users can delete dev logs"
  ON phwb_dev_logs FOR DELETE
  TO authenticated
  USING (true);

-- Testing sessions: all authenticated users can view/create; manage own updates/deletes
DROP POLICY IF EXISTS "All authenticated users can view testing sessions" ON phwb_bug_testing_sessions;
CREATE POLICY "All authenticated users can view testing sessions"
  ON phwb_bug_testing_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "All authenticated users can create testing sessions" ON phwb_bug_testing_sessions;
CREATE POLICY "All authenticated users can create testing sessions"
  ON phwb_bug_testing_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own testing sessions" ON phwb_bug_testing_sessions;
CREATE POLICY "Users can update their own testing sessions"
  ON phwb_bug_testing_sessions FOR UPDATE
  TO authenticated
  USING (tester_id = auth.uid() OR tester_id IS NULL)
  WITH CHECK (tester_id = auth.uid() OR tester_id IS NULL);

DROP POLICY IF EXISTS "Users can delete their own testing sessions" ON phwb_bug_testing_sessions;
CREATE POLICY "Users can delete their own testing sessions"
  ON phwb_bug_testing_sessions FOR DELETE
  TO authenticated
  USING (tester_id = auth.uid() OR tester_id IS NULL);

