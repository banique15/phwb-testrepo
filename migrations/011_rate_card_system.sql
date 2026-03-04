-- Migration: Rate Card System for Payroll Automation
-- This migration creates tables to manage rate cards, rate rules, and additional fees
-- Also adds new columns to phwb_payroll and program_type to phwb_programs

-- ============================================================================
-- PHASE 1: Rate Card Management Tables
-- ============================================================================

-- Rate card versions (FY25, FY26, etc.)
CREATE TABLE IF NOT EXISTS phwb_rate_cards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  effective_date DATE NOT NULL,
  expires_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE phwb_rate_cards IS 'Fiscal year rate cards containing rate rules for payroll calculation';
COMMENT ON COLUMN phwb_rate_cards.name IS 'Rate card name (e.g., FY26)';
COMMENT ON COLUMN phwb_rate_cards.is_active IS 'Only one rate card should be active at a time';

-- Rate rules within each card
CREATE TABLE IF NOT EXISTS phwb_rate_rules (
  id SERIAL PRIMARY KEY,
  rate_card_id INTEGER NOT NULL REFERENCES phwb_rate_cards(id) ON DELETE CASCADE,
  program_type TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('hourly', 'tiered', 'flat')),
  hourly_rate NUMERIC,
  first_hour_rate NUMERIC,
  subsequent_hour_rate NUMERIC,
  flat_rate NUMERIC,
  min_hours NUMERIC,
  max_hours NUMERIC,
  includes_travel BOOLEAN DEFAULT FALSE,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_rate_data CHECK (
    (rate_type = 'hourly' AND hourly_rate IS NOT NULL) OR
    (rate_type = 'tiered' AND first_hour_rate IS NOT NULL AND subsequent_hour_rate IS NOT NULL) OR
    (rate_type = 'flat' AND flat_rate IS NOT NULL)
  )
);

COMMENT ON TABLE phwb_rate_rules IS 'Rate rules for different program types within a rate card';
COMMENT ON COLUMN phwb_rate_rules.program_type IS 'Program type: healing_arts, transit_hub, virtual_artist, etc.';
COMMENT ON COLUMN phwb_rate_rules.rate_type IS 'How rate is calculated: hourly, tiered (first hour different), or flat';
COMMENT ON COLUMN phwb_rate_rules.first_hour_rate IS 'For tiered rates: rate for the first hour';
COMMENT ON COLUMN phwb_rate_rules.subsequent_hour_rate IS 'For tiered rates: rate for hours after the first';

-- Create index for common lookups
CREATE INDEX IF NOT EXISTS idx_rate_rules_card_type ON phwb_rate_rules(rate_card_id, program_type);

-- Additional fees (bandleader, bank deposit, training, etc.)
CREATE TABLE IF NOT EXISTS phwb_additional_fees (
  id SERIAL PRIMARY KEY,
  rate_card_id INTEGER NOT NULL REFERENCES phwb_rate_cards(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  min_musicians INTEGER,
  applies_to TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE phwb_additional_fees IS 'Additional fees like bandleader, bank deposit, training';
COMMENT ON COLUMN phwb_additional_fees.fee_type IS 'Type of fee: bandleader, bank_deposit, training, etc.';
COMMENT ON COLUMN phwb_additional_fees.min_musicians IS 'Minimum number of musicians to apply this fee (e.g., 4 for bandleader)';
COMMENT ON COLUMN phwb_additional_fees.applies_to IS 'Who receives this fee: leader, all, specific_role';

-- Create index for fee lookups
CREATE INDEX IF NOT EXISTS idx_additional_fees_card_type ON phwb_additional_fees(rate_card_id, fee_type);

-- ============================================================================
-- PHASE 2: Add program_type to phwb_programs
-- ============================================================================

ALTER TABLE phwb_programs 
  ADD COLUMN IF NOT EXISTS program_type TEXT;

-- Add check constraint for valid program types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phwb_programs_program_type_check'
  ) THEN
    ALTER TABLE phwb_programs 
      ADD CONSTRAINT phwb_programs_program_type_check 
      CHECK (program_type IS NULL OR program_type IN (
        'healing_arts', 
        'transit_hub', 
        'virtual_artist',
        'virtual_teaching',
        'teaching_in_person',
        'newark_airport',
        'donor_event',
        'holiday_special',
        'training',
        'pm',
        'other'
      ));
  END IF;
END $$;

COMMENT ON COLUMN phwb_programs.program_type IS 'Program type for rate card lookup: healing_arts, transit_hub, etc.';

-- ============================================================================
-- PHASE 3: Add new columns to phwb_payroll
-- ============================================================================

-- Add program_id column
ALTER TABLE phwb_payroll 
  ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES phwb_programs(id);

-- Add number_of_musicians column
ALTER TABLE phwb_payroll 
  ADD COLUMN IF NOT EXISTS number_of_musicians INTEGER;

-- Add gig_duration column (actual event duration vs billable hours)
ALTER TABLE phwb_payroll 
  ADD COLUMN IF NOT EXISTS gig_duration NUMERIC;

-- Add rate_card_id reference
ALTER TABLE phwb_payroll 
  ADD COLUMN IF NOT EXISTS rate_card_id INTEGER REFERENCES phwb_rate_cards(id);

-- Add rate_rule_id reference for audit trail
ALTER TABLE phwb_payroll 
  ADD COLUMN IF NOT EXISTS rate_rule_id INTEGER REFERENCES phwb_rate_rules(id);

-- Update employee_contractor_status to include LLC
ALTER TABLE phwb_payroll 
  DROP CONSTRAINT IF EXISTS phwb_payroll_employee_contractor_status_check;

ALTER TABLE phwb_payroll 
  ADD CONSTRAINT phwb_payroll_employee_contractor_status_check 
  CHECK (employee_contractor_status IS NULL OR employee_contractor_status IN (
    'employee', 
    'contractor', 
    'roster_artist', 
    'llc'
  ));

-- Add comments
COMMENT ON COLUMN phwb_payroll.program_id IS 'Reference to the program this payroll entry is for';
COMMENT ON COLUMN phwb_payroll.number_of_musicians IS 'Number of musicians in the ensemble for this event';
COMMENT ON COLUMN phwb_payroll.gig_duration IS 'Actual event duration in hours (may differ from billable hours)';
COMMENT ON COLUMN phwb_payroll.rate_card_id IS 'Reference to the rate card used for calculation';
COMMENT ON COLUMN phwb_payroll.rate_rule_id IS 'Reference to the specific rate rule applied';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payroll_program ON phwb_payroll(program_id);
CREATE INDEX IF NOT EXISTS idx_payroll_rate_card ON phwb_payroll(rate_card_id);

-- ============================================================================
-- PHASE 4: Create automation log table for tracking payroll generation
-- ============================================================================

CREATE TABLE IF NOT EXISTS phwb_payroll_generation_log (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  events_processed INTEGER NOT NULL DEFAULT 0,
  entries_created INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  skipped_events INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  generated_by UUID REFERENCES auth.users(id),
  generation_method TEXT CHECK (generation_method IN ('manual', 'automated')),
  notes TEXT
);

COMMENT ON TABLE phwb_payroll_generation_log IS 'Audit log for payroll generation runs';

-- ============================================================================
-- PHASE 5: Create trigger for updated_at columns
-- ============================================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to new tables
DROP TRIGGER IF EXISTS update_rate_cards_updated_at ON phwb_rate_cards;
CREATE TRIGGER update_rate_cards_updated_at
  BEFORE UPDATE ON phwb_rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_rules_updated_at ON phwb_rate_rules;
CREATE TRIGGER update_rate_rules_updated_at
  BEFORE UPDATE ON phwb_rate_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_additional_fees_updated_at ON phwb_additional_fees;
CREATE TRIGGER update_additional_fees_updated_at
  BEFORE UPDATE ON phwb_additional_fees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
