-- Migration: Payroll event flow enhancements and canonical type/status updates
-- Date: 2026-03-23

-- ----------------------------------------------------------------------------
-- Artist model: default LLC pay-through owner linkage
-- ----------------------------------------------------------------------------
ALTER TABLE phwb_artists
  ADD COLUMN IF NOT EXISTS paid_through_artist_id UUID REFERENCES phwb_artists(id) ON DELETE SET NULL;

COMMENT ON COLUMN phwb_artists.paid_through_artist_id IS
  'Default LLC owner artist id this artist is paid through; can be overridden per event assignment.';

CREATE INDEX IF NOT EXISTS idx_artists_paid_through_artist_id
  ON phwb_artists(paid_through_artist_id);

-- ----------------------------------------------------------------------------
-- Payroll model additions
-- ----------------------------------------------------------------------------
ALTER TABLE phwb_payroll
  ADD COLUMN IF NOT EXISTS linked_payroll_id BIGINT REFERENCES phwb_payroll(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjustment_type TEXT,
  ADD COLUMN IF NOT EXISTS payee_name TEXT,
  ADD COLUMN IF NOT EXISTS is_production_manager BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'phwb_payroll_adjustment_type_check'
  ) THEN
    ALTER TABLE phwb_payroll
      ADD CONSTRAINT phwb_payroll_adjustment_type_check
      CHECK (adjustment_type IS NULL OR adjustment_type IN ('increase', 'decrease', 'correction'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payroll_linked_payroll_id ON phwb_payroll(linked_payroll_id);

COMMENT ON COLUMN phwb_payroll.linked_payroll_id IS
  'Optional link to original payroll row when this row is an adjustment.';
COMMENT ON COLUMN phwb_payroll.adjustment_type IS
  'Adjustment direction/type: increase, decrease, correction.';
COMMENT ON COLUMN phwb_payroll.payee_name IS
  'Display fallback when artist_id is null (e.g. non-artist production manager).';
COMMENT ON COLUMN phwb_payroll.is_production_manager IS
  'True when this payroll row represents production manager compensation.';

-- ----------------------------------------------------------------------------
-- Canonical status updates for payroll
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Drop any existing payroll status check constraint first so status remaps are safe.
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'phwb_payroll'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE phwb_payroll DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

UPDATE phwb_payroll SET status = 'Planned' WHERE status = 'Unpaid';
UPDATE phwb_payroll SET status = 'Paid' WHERE status = 'Completed';

ALTER TABLE phwb_payroll
  ADD CONSTRAINT phwb_payroll_status_check
  CHECK (status IN ('Planned', 'Approved', 'Paid', 'With Issues', 'Cancelled'));

-- ----------------------------------------------------------------------------
-- Canonical worker type updates (W-2 / 1099)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Drop any existing payroll employee_contractor_status check constraint,
  -- regardless of its exact generated/name variant.
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'phwb_payroll'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%employee_contractor_status%'
  LOOP
    EXECUTE format('ALTER TABLE phwb_payroll DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

UPDATE phwb_payroll
SET employee_contractor_status = CASE
  WHEN employee_contractor_status IN ('employee', 'roster_artist', 'W-2', 'W2') THEN 'W-2'
  WHEN employee_contractor_status IN ('contractor', 'llc', '1099') THEN '1099'
  ELSE employee_contractor_status
END
WHERE employee_contractor_status IS NOT NULL;

ALTER TABLE phwb_payroll
  ADD CONSTRAINT phwb_payroll_employee_contractor_status_check
  CHECK (
    employee_contractor_status IS NULL
    OR employee_contractor_status IN ('W-2', '1099')
  );

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Drop any existing artist employment_status check constraint first,
  -- so canonical updates cannot violate legacy value checks.
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'phwb_artists'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%employment_status%'
  LOOP
    EXECUTE format('ALTER TABLE phwb_artists DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

UPDATE phwb_artists
SET employment_status = CASE
  WHEN employment_status IN ('Employee', 'employee', 'roster_artist', 'W2', 'W-2') THEN 'W-2'
  WHEN employment_status IN ('Contractor', 'contractor', 'llc', 'LLC', '1099') THEN '1099'
  ELSE employment_status
END
WHERE employment_status IS NOT NULL;

ALTER TABLE phwb_artists
  ADD CONSTRAINT phwb_artists_employment_status_check
  CHECK (employment_status IS NULL OR employment_status IN ('W-2', '1099'));

-- ----------------------------------------------------------------------------
-- Backfill payee_name for existing rows where possible
-- ----------------------------------------------------------------------------
UPDATE phwb_payroll p
SET payee_name = COALESCE(
  a.full_name,
  NULLIF(TRIM(CONCAT(COALESCE(a.legal_first_name, ''), ' ', COALESCE(a.legal_last_name, ''))), ''),
  a.artist_name
)
FROM phwb_artists a
WHERE p.artist_id = a.id
  AND p.payee_name IS NULL;
