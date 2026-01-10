-- Migration: Add replication data field to bugs table
-- Description: Adds JSONB field to store markdown report and screenshot references for bug replication
-- Date: 2026-01-10

-- Add replication_data column to phwb_bugs table
ALTER TABLE phwb_bugs 
ADD COLUMN IF NOT EXISTS replication_data jsonb;

-- Add comment for documentation
COMMENT ON COLUMN phwb_bugs.replication_data IS 'Stores replication report and screenshot references. Structure: { report: string, screenshot_ids: number[] }';
