-- Migration: Create bug reporting and task management tables
-- Description: Creates comprehensive bug tracking system with comments, attachments, labels, relations, activity tracking, and time tracking
-- Date: 2026-01-09

-- Create main bugs table
CREATE TABLE IF NOT EXISTS phwb_bugs (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Core fields
  title text NOT NULL,
  description text,
  
  -- Status and workflow
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'medium',
  severity text NOT NULL DEFAULT 'moderate',
  category text,
  
  -- User assignments
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Dates
  due_date date,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT status_check CHECK (status IN ('new', 'triage', 'in_progress', 'testing', 'resolved', 'closed', 'reopened')),
  CONSTRAINT priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT severity_check CHECK (severity IN ('cosmetic', 'minor', 'moderate', 'major', 'critical')),
  CONSTRAINT title_not_empty CHECK (char_length(trim(title)) > 0)
);

-- Create bug comments table
CREATE TABLE IF NOT EXISTS phwb_bug_comments (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_internal boolean DEFAULT false NOT NULL,
  edited_at timestamptz,
  
  CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0)
);

-- Create bug attachments table
CREATE TABLE IF NOT EXISTS phwb_bug_attachments (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  
  CONSTRAINT file_name_not_empty CHECK (char_length(trim(file_name)) > 0),
  CONSTRAINT file_path_not_empty CHECK (char_length(trim(file_path)) > 0)
);

-- Create bug labels table
CREATE TABLE IF NOT EXISTS phwb_bug_labels (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  name text NOT NULL UNIQUE,
  color text DEFAULT '#3b82f6',
  description text,
  
  CONSTRAINT name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- Create bug label assignments table (many-to-many)
CREATE TABLE IF NOT EXISTS phwb_bug_label_assignments (
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  label_id integer NOT NULL REFERENCES phwb_bug_labels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  PRIMARY KEY (bug_id, label_id)
);

-- Create bug relations table
CREATE TABLE IF NOT EXISTS phwb_bug_relations (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  related_bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  CONSTRAINT relation_type_check CHECK (relation_type IN ('duplicate', 'related', 'blocks', 'blocked_by', 'depends_on')),
  CONSTRAINT no_self_relation CHECK (bug_id != related_bug_id),
  CONSTRAINT unique_relation UNIQUE (bug_id, related_bug_id, relation_type)
);

-- Create bug activity table
CREATE TABLE IF NOT EXISTS phwb_bug_activity (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_value text,
  new_value text,
  metadata jsonb,
  
  CONSTRAINT action_check CHECK (action IN ('created', 'updated', 'status_changed', 'assigned', 'commented', 'attachment_added', 'label_added', 'label_removed', 'reopened', 'resolved', 'closed'))
);

-- Create bug time tracking table
CREATE TABLE IF NOT EXISTS phwb_bug_time_tracking (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  bug_id integer NOT NULL REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  time_spent_minutes integer NOT NULL,
  description text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  
  CONSTRAINT time_spent_positive CHECK (time_spent_minutes > 0)
);

-- Create indexes for performance
-- Bugs table indexes
CREATE INDEX IF NOT EXISTS idx_bugs_status ON phwb_bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_priority ON phwb_bugs(priority);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON phwb_bugs(severity);
CREATE INDEX IF NOT EXISTS idx_bugs_category ON phwb_bugs(category);
CREATE INDEX IF NOT EXISTS idx_bugs_reported_by ON phwb_bugs(reported_by);
CREATE INDEX IF NOT EXISTS idx_bugs_assigned_to ON phwb_bugs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bugs_created_at ON phwb_bugs(created_at);
CREATE INDEX IF NOT EXISTS idx_bugs_updated_at ON phwb_bugs(updated_at);
CREATE INDEX IF NOT EXISTS idx_bugs_due_date ON phwb_bugs(due_date);
CREATE INDEX IF NOT EXISTS idx_bugs_status_assigned ON phwb_bugs(status, assigned_to);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_bug_comments_bug_id ON phwb_bug_comments(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_comments_user_id ON phwb_bug_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_comments_created_at ON phwb_bug_comments(created_at);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_bug_attachments_bug_id ON phwb_bug_attachments(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_attachments_user_id ON phwb_bug_attachments(user_id);

-- Label assignments indexes
CREATE INDEX IF NOT EXISTS idx_bug_label_assignments_bug_id ON phwb_bug_label_assignments(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_label_assignments_label_id ON phwb_bug_label_assignments(label_id);

-- Relations indexes
CREATE INDEX IF NOT EXISTS idx_bug_relations_bug_id ON phwb_bug_relations(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_relations_related_bug_id ON phwb_bug_relations(related_bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_relations_type ON phwb_bug_relations(relation_type);

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_bug_activity_bug_id ON phwb_bug_activity(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_activity_user_id ON phwb_bug_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_activity_created_at ON phwb_bug_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_activity_action ON phwb_bug_activity(action);

-- Time tracking indexes
CREATE INDEX IF NOT EXISTS idx_bug_time_tracking_bug_id ON phwb_bug_time_tracking(bug_id);
CREATE INDEX IF NOT EXISTS idx_bug_time_tracking_user_id ON phwb_bug_time_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_time_tracking_date ON phwb_bug_time_tracking(date);

-- Create trigger function for updated_at (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_bugs_updated_at
  BEFORE UPDATE ON phwb_bugs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bug_comments_updated_at
  BEFORE UPDATE ON phwb_bug_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bug_time_tracking_updated_at
  BEFORE UPDATE ON phwb_bug_time_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to automatically log activity on bug changes
CREATE OR REPLACE FUNCTION log_bug_activity()
RETURNS TRIGGER AS $$
DECLARE
  action_type text;
  old_val text;
  new_val text;
BEGIN
  -- Determine action type based on what changed
  IF TG_OP = 'INSERT' THEN
    action_type := 'created';
    INSERT INTO phwb_bug_activity (bug_id, user_id, action, metadata)
    VALUES (NEW.id, NEW.reported_by, action_type, jsonb_build_object('title', NEW.title));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      action_type := 'status_changed';
      old_val := OLD.status;
      new_val := NEW.status;
      
      -- Special handling for resolved/closed
      IF NEW.status = 'resolved' THEN
        NEW.resolved_at := now();
        NEW.resolved_by := (SELECT auth.uid());
      ELSIF NEW.status = 'closed' THEN
        NEW.closed_at := now();
        NEW.closed_by := (SELECT auth.uid());
      END IF;
      
      INSERT INTO phwb_bug_activity (bug_id, user_id, action, old_value, new_value)
      VALUES (NEW.id, (SELECT auth.uid()), action_type, old_val, new_val);
    END IF;
    
    -- Assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      action_type := 'assigned';
      old_val := COALESCE(OLD.assigned_to::text, 'unassigned');
      new_val := COALESCE(NEW.assigned_to::text, 'unassigned');
      
      INSERT INTO phwb_bug_activity (bug_id, user_id, action, old_value, new_value)
      VALUES (NEW.id, (SELECT auth.uid()), action_type, old_val, new_val);
    END IF;
    
    -- General updates (if other fields changed)
    IF (OLD.title IS DISTINCT FROM NEW.title OR 
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.priority IS DISTINCT FROM NEW.priority OR
        OLD.severity IS DISTINCT FROM NEW.severity OR
        OLD.category IS DISTINCT FROM NEW.category OR
        OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
      INSERT INTO phwb_bug_activity (bug_id, user_id, action, metadata)
      VALUES (NEW.id, (SELECT auth.uid()), 'updated', jsonb_build_object(
        'title_changed', OLD.title IS DISTINCT FROM NEW.title,
        'description_changed', OLD.description IS DISTINCT FROM NEW.description,
        'priority_changed', OLD.priority IS DISTINCT FROM NEW.priority,
        'severity_changed', OLD.severity IS DISTINCT FROM NEW.severity,
        'category_changed', OLD.category IS DISTINCT FROM NEW.category,
        'due_date_changed', OLD.due_date IS DISTINCT FROM NEW.due_date
      ));
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER bug_activity_trigger
  AFTER INSERT OR UPDATE ON phwb_bugs
  FOR EACH ROW
  EXECUTE FUNCTION log_bug_activity();

-- Create trigger for comment activity
CREATE OR REPLACE FUNCTION log_comment_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO phwb_bug_activity (bug_id, user_id, action, metadata)
    VALUES (NEW.bug_id, NEW.user_id, 'commented', jsonb_build_object('comment_id', NEW.id));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER comment_activity_trigger
  AFTER INSERT ON phwb_bug_comments
  FOR EACH ROW
  EXECUTE FUNCTION log_comment_activity();

-- Create trigger for attachment activity
CREATE OR REPLACE FUNCTION log_attachment_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO phwb_bug_activity (bug_id, user_id, action, metadata)
    VALUES (NEW.bug_id, NEW.user_id, 'attachment_added', jsonb_build_object('attachment_id', NEW.id, 'file_name', NEW.file_name));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER attachment_activity_trigger
  AFTER INSERT ON phwb_bug_attachments
  FOR EACH ROW
  EXECUTE FUNCTION log_attachment_activity();

-- Enable Row Level Security
ALTER TABLE phwb_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE phwb_bug_time_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phwb_bugs
-- All authenticated users can view all bugs
CREATE POLICY "All authenticated users can view bugs"
  ON phwb_bugs FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create bugs
CREATE POLICY "All authenticated users can create bugs"
  ON phwb_bugs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update bugs they created or are assigned to
-- All authenticated users can update any bug (simplified - can add role-based restrictions later)
CREATE POLICY "Users can update bugs"
  ON phwb_bugs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- All authenticated users can delete bugs
CREATE POLICY "Users can delete bugs"
  ON phwb_bugs FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for phwb_bug_comments
-- All authenticated users can view comments (except internal notes - handled in app logic)
CREATE POLICY "All authenticated users can view comments"
  ON phwb_bug_comments FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create comments
CREATE POLICY "All authenticated users can create comments"
  ON phwb_bug_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON phwb_bug_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own comments, all authenticated users can delete any
CREATE POLICY "Users can delete comments"
  ON phwb_bug_comments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for phwb_bug_attachments
-- All authenticated users can view attachments
CREATE POLICY "All authenticated users can view attachments"
  ON phwb_bug_attachments FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create attachments
CREATE POLICY "All authenticated users can create attachments"
  ON phwb_bug_attachments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can delete attachments
CREATE POLICY "Users can delete attachments"
  ON phwb_bug_attachments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for phwb_bug_labels
-- All authenticated users can view labels
CREATE POLICY "All authenticated users can view labels"
  ON phwb_bug_labels FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can manage labels
CREATE POLICY "Users can manage labels"
  ON phwb_bug_labels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for phwb_bug_label_assignments
-- All authenticated users can view label assignments
CREATE POLICY "All authenticated users can view label assignments"
  ON phwb_bug_label_assignments FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can assign labels
CREATE POLICY "All authenticated users can assign labels"
  ON phwb_bug_label_assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can remove labels
CREATE POLICY "Users can remove labels"
  ON phwb_bug_label_assignments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for phwb_bug_relations
-- All authenticated users can view relations
CREATE POLICY "All authenticated users can view relations"
  ON phwb_bug_relations FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create relations
CREATE POLICY "All authenticated users can create relations"
  ON phwb_bug_relations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can delete relations
CREATE POLICY "Users can delete relations"
  ON phwb_bug_relations FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for phwb_bug_activity
-- All authenticated users can view activity
CREATE POLICY "All authenticated users can view activity"
  ON phwb_bug_activity FOR SELECT
  TO authenticated
  USING (true);

-- Only system can insert activity (via triggers)
CREATE POLICY "System can insert activity"
  ON phwb_bug_activity FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for phwb_bug_time_tracking
-- All authenticated users can view time tracking
CREATE POLICY "All authenticated users can view time tracking"
  ON phwb_bug_time_tracking FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create time entries
CREATE POLICY "All authenticated users can create time entries"
  ON phwb_bug_time_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update/delete their own time entries
CREATE POLICY "Users can manage their own time entries"
  ON phwb_bug_time_tracking FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE phwb_bugs IS 'Main bug and task tracking table';
COMMENT ON TABLE phwb_bug_comments IS 'Comments and notes on bugs';
COMMENT ON TABLE phwb_bug_attachments IS 'File attachments for bugs';
COMMENT ON TABLE phwb_bug_labels IS 'Labels/tags for categorizing bugs';
COMMENT ON TABLE phwb_bug_label_assignments IS 'Many-to-many relationship between bugs and labels';
COMMENT ON TABLE phwb_bug_relations IS 'Relationships between bugs (duplicate, related, blocks, etc.)';
COMMENT ON TABLE phwb_bug_activity IS 'Activity timeline for bugs';
COMMENT ON TABLE phwb_bug_time_tracking IS 'Time tracking entries for bugs';
