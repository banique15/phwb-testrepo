-- Migration: Add LLC column to Payroll table
-- Description: Adds LLC column to track the LLC entity for each payroll entry
-- Date: 2025-10-22

ALTER TABLE phwb_payroll
ADD COLUMN IF NOT EXISTS llc text DEFAULT NULL;

COMMENT ON COLUMN phwb_payroll.llc IS 'LLC entity associated with the payroll entry';