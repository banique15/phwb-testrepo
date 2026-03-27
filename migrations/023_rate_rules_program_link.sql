-- Migration: Link rate rules to specific programs (optional)
-- Allows program-specific rate rules while preserving program_type fallback.

ALTER TABLE phwb_rate_rules
  ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES phwb_programs(id) ON DELETE SET NULL;

COMMENT ON COLUMN phwb_rate_rules.program_id IS 'Optional specific program this rule applies to; null means all programs of the selected program_type';

CREATE INDEX IF NOT EXISTS idx_rate_rules_card_program ON phwb_rate_rules(rate_card_id, program_id);
