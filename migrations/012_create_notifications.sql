-- Migration: Create notifications table for in-app alerts
-- Description: Adds generic notifications table and triggers for bug comment notifications
-- Date: 2026-02-28

-- Create notifications table
CREATE TABLE IF NOT EXISTS phwb_notifications (
  id SERIAL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  read_at timestamptz,
  
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  
  bug_id integer REFERENCES phwb_bugs(id) ON DELETE CASCADE,
  bug_comment_id integer REFERENCES phwb_bug_comments(id) ON DELETE CASCADE,
  
  metadata jsonb,
  is_read boolean NOT NULL DEFAULT false,
  
  CONSTRAINT notification_type_check CHECK (type IN ('bug_comment'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at 
  ON phwb_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON phwb_notifications(user_id, is_read, created_at DESC);

-- Enable Row Level Security
ALTER TABLE phwb_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view only their own notifications
CREATE POLICY "Users can view their own notifications"
  ON phwb_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: Users can update (mark read) only their own notifications
CREATE POLICY "Users can update their own notifications"
  ON phwb_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS: Allow inserts (typically via triggers or server-side logic)
CREATE POLICY "System can insert notifications"
  ON phwb_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger function to create notifications when a new bug comment is added
CREATE OR REPLACE FUNCTION create_bug_comment_notifications()
RETURNS TRIGGER AS $$
DECLARE
  bug_record phwb_bugs;
BEGIN
  -- Load the related bug to determine recipients
  SELECT * INTO bug_record
  FROM phwb_bugs
  WHERE id = NEW.bug_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Notify reporter (if any, not the commenting user)
  IF bug_record.reported_by IS NOT NULL
     AND bug_record.reported_by <> NEW.user_id THEN
    INSERT INTO phwb_notifications (
      user_id,
      type,
      title,
      message,
      bug_id,
      bug_comment_id,
      metadata
    )
    VALUES (
      bug_record.reported_by,
      'bug_comment',
      'New comment on issue #' || NEW.bug_id,
      left(NEW.content, 200),
      NEW.bug_id,
      NEW.id,
      jsonb_build_object(
        'bug_id', NEW.bug_id,
        'comment_id', NEW.id,
        'is_internal', NEW.is_internal
      )
    );
  END IF;

  -- Notify assignee (if any, and different from reporter and commenting user)
  IF bug_record.assigned_to IS NOT NULL
     AND bug_record.assigned_to <> NEW.user_id
     AND bug_record.assigned_to IS DISTINCT FROM bug_record.reported_by THEN
    INSERT INTO phwb_notifications (
      user_id,
      type,
      title,
      message,
      bug_id,
      bug_comment_id,
      metadata
    )
    VALUES (
      bug_record.assigned_to,
      'bug_comment',
      'New comment on issue #' || NEW.bug_id,
      left(NEW.content, 200),
      NEW.bug_id,
      NEW.id,
      jsonb_build_object(
        'bug_id', NEW.bug_id,
        'comment_id', NEW.id,
        'is_internal', NEW.is_internal
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to invoke notification creation after a bug comment is inserted
CREATE TRIGGER bug_comment_notifications_trigger
  AFTER INSERT ON phwb_bug_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_bug_comment_notifications();

