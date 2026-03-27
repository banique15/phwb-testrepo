-- Migration: Ensure bug label assignment foreign keys exist
-- Purpose: Fix PostgREST relationship resolution between phwb_bug_label_assignments and phwb_bug_labels

-- 1) Remove orphaned label assignments so FK creation succeeds.
DELETE FROM phwb_bug_label_assignments bla
WHERE NOT EXISTS (
  SELECT 1
  FROM phwb_bug_labels bl
  WHERE bl.id = bla.label_id
);

DELETE FROM phwb_bug_label_assignments bla
WHERE NOT EXISTS (
  SELECT 1
  FROM phwb_bugs b
  WHERE b.id = bla.bug_id
);

-- 2) Ensure explicit FK to labels exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'fk_bug_label_assignments_label_id'
      AND c.conrelid = 'phwb_bug_label_assignments'::regclass
  ) THEN
    ALTER TABLE phwb_bug_label_assignments
      ADD CONSTRAINT fk_bug_label_assignments_label_id
      FOREIGN KEY (label_id)
      REFERENCES phwb_bug_labels(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Ensure explicit FK to bugs exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'fk_bug_label_assignments_bug_id'
      AND c.conrelid = 'phwb_bug_label_assignments'::regclass
  ) THEN
    ALTER TABLE phwb_bug_label_assignments
      ADD CONSTRAINT fk_bug_label_assignments_bug_id
      FOREIGN KEY (bug_id)
      REFERENCES phwb_bugs(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 4) Keep lookup performant.
CREATE INDEX IF NOT EXISTS idx_bug_label_assignments_label_id
  ON phwb_bug_label_assignments(label_id);

CREATE INDEX IF NOT EXISTS idx_bug_label_assignments_bug_id
  ON phwb_bug_label_assignments(bug_id);

-- 5) Ask PostgREST to refresh schema cache (safe no-op if listener unavailable).
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

