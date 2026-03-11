-- Migration: Update issue statuses - replace Closed with QA passed
-- Description: Remove the Closed status, add QA passed, and update the status check constraint
-- Date: 2026-03-11

-- Step 1: Migrate existing data
-- Map any existing 'closed' issues to 'resolved' so they remain valid after constraint change
UPDATE phwb_bugs
SET status = 'resolved'
WHERE status = 'closed';

-- Step 2: Update the status check constraint on phwb_bugs
ALTER TABLE phwb_bugs
  DROP CONSTRAINT IF EXISTS status_check;

ALTER TABLE phwb_bugs
  ADD CONSTRAINT status_check
  CHECK (status IN ('new', 'planning', 'in_progress', 'testing', 'review', 'qa_passed', 'resolved'));

-- Note: We keep existing resolved/closed timestamp columns for historical data.

