-- Migration: Ensure phwb_payroll has is_production_manager column
-- Reason: Some environments are missing this column, causing runtime query failures.

ALTER TABLE phwb_payroll
  ADD COLUMN IF NOT EXISTS is_production_manager BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN phwb_payroll.is_production_manager IS
  'True when this payroll row represents production manager compensation.';

CREATE INDEX IF NOT EXISTS idx_payroll_is_production_manager
  ON phwb_payroll(is_production_manager);

