-- Ensure phwb_bug_attachments.id is auto-generated correctly.
-- Fixes runtime errors like:
--   null value in column "id" of relation "phwb_bug_attachments" violates not-null constraint

DO $$
DECLARE
  seq_name text := 'phwb_bug_attachments_id_seq';
  max_id bigint := 0;
BEGIN
  -- Guard for environments where bug tables are not present yet.
  IF to_regclass('public.phwb_bug_attachments') IS NULL THEN
    RAISE NOTICE 'Table public.phwb_bug_attachments not found; skipping id default repair.';
    RETURN;
  END IF;

  -- Recreate the sequence when it is missing.
  IF to_regclass('public.' || seq_name) IS NULL THEN
    EXECUTE format('CREATE SEQUENCE public.%I', seq_name);
  END IF;

  -- Ensure the id column uses sequence-backed defaults.
  EXECUTE format(
    'ALTER TABLE public.phwb_bug_attachments ALTER COLUMN id SET DEFAULT nextval(''public.%I''::regclass)',
    seq_name
  );
  EXECUTE format(
    'ALTER SEQUENCE public.%I OWNED BY public.phwb_bug_attachments.id',
    seq_name
  );
  EXECUTE 'ALTER TABLE public.phwb_bug_attachments ALTER COLUMN id SET NOT NULL';

  -- Sync sequence with existing rows so next inserts do not collide.
  EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM public.phwb_bug_attachments' INTO max_id;
  IF max_id > 0 THEN
    EXECUTE format('SELECT setval(''public.%I''::regclass, %s, true)', seq_name, max_id);
  ELSE
    EXECUTE format('SELECT setval(''public.%I''::regclass, 1, false)', seq_name);
  END IF;
END $$;

