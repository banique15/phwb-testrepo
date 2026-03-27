-- Add rate_type column to phwb_payroll for rate card calculation integration
-- rate_rule_id and rate_card_id may already exist from Issue #61; IF NOT EXISTS is safe

ALTER TABLE phwb_payroll
ADD COLUMN IF NOT EXISTS rate_type text CHECK (rate_type IN ('hourly', 'flat', 'tiered'));
