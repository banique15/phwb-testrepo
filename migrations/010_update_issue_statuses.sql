-- Migration: Update bug/issue statuses and consolidate priority/severity
-- Description: Rename Bugs to Issues, update statuses (remove triage/reopened, add planning/review), consolidate priority/severity
-- Date: 2026-01-15

-- Step 1: Migrate existing data before changing constraints
-- Move all 'triage' bugs to 'new'
UPDATE phwb_bugs SET status = 'new' WHERE status = 'triage';

-- Move all 'reopened' bugs to 'new'
UPDATE phwb_bugs SET status = 'new' WHERE status = 'reopened';

-- Step 2: Drop the old status constraint
ALTER TABLE phwb_bugs DROP CONSTRAINT IF EXISTS status_check;

-- Step 3: Add new status constraint with updated values
ALTER TABLE phwb_bugs ADD CONSTRAINT status_check 
  CHECK (status IN ('new', 'planning', 'in_progress', 'testing', 'review', 'resolved', 'closed'));

-- Step 4: Consolidate priority and severity into a single "priority" field
-- We'll keep the priority column and map severity values into it where appropriate
-- For existing bugs, if severity is more urgent than priority, use severity instead

-- Map severity to priority equivalent:
-- cosmetic -> low
-- minor -> low  
-- moderate -> medium
-- major -> high
-- critical -> critical

-- Update priority based on higher severity (only upgrade, don't downgrade)
UPDATE phwb_bugs 
SET priority = 'critical' 
WHERE severity = 'critical' AND priority != 'critical';

UPDATE phwb_bugs 
SET priority = 'high' 
WHERE severity = 'major' AND priority NOT IN ('critical', 'high');

-- Step 5: Drop severity constraint and column (optional - keeping for now for data preservation)
-- We'll keep the severity column but make it optional and deprecated
-- ALTER TABLE phwb_bugs DROP CONSTRAINT IF EXISTS severity_check;

-- Add comment to indicate severity is deprecated
COMMENT ON COLUMN phwb_bugs.severity IS 'DEPRECATED: Use priority instead. Kept for historical data.';

-- Step 6: Update activity action check to remove 'reopened' action
ALTER TABLE phwb_bug_activity DROP CONSTRAINT IF EXISTS action_check;
ALTER TABLE phwb_bug_activity ADD CONSTRAINT action_check 
  CHECK (action IN ('created', 'updated', 'status_changed', 'assigned', 'commented', 'attachment_added', 'label_added', 'label_removed', 'resolved', 'closed'));

-- Add table comment update
COMMENT ON TABLE phwb_bugs IS 'Issue tracking table (formerly bugs)';
