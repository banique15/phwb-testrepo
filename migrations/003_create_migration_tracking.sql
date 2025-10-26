-- Migration: Create migration tracking table
-- Description: Tracks the migration process from Instant to Supabase
-- Date: 2025-10-22

-- Create migration log table
CREATE TABLE IF NOT EXISTS migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Migration details
  entity_type text NOT NULL, -- 'artist', 'ensemble', 'employment_record', etc.
  instant_id text NOT NULL,
  supabase_id uuid,

  -- Status tracking
  status text DEFAULT 'pending' NOT NULL,
  -- pending, processing, completed, failed, skipped

  -- Error handling
  error_message text,
  retry_count integer DEFAULT 0,

  -- Metadata
  metadata jsonb, -- Store any additional migration context
  migrated_by text, -- Who/what triggered the migration

  -- Constraints
  CONSTRAINT status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
  ),
  CONSTRAINT entity_instant_unique UNIQUE (entity_type, instant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_migration_log_status ON migration_log(status);
CREATE INDEX IF NOT EXISTS idx_migration_log_entity_type ON migration_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_migration_log_instant_id ON migration_log(instant_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_supabase_id ON migration_log(supabase_id);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_migration_log_updated_at ON migration_log;
CREATE TRIGGER update_migration_log_updated_at
    BEFORE UPDATE ON migration_log
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE migration_log IS 'Tracks data migration from Instant DB to Supabase';
COMMENT ON COLUMN migration_log.entity_type IS 'Type of entity being migrated';
COMMENT ON COLUMN migration_log.instant_id IS 'Original ID in Instant DB';
COMMENT ON COLUMN migration_log.supabase_id IS 'New UUID in Supabase';
COMMENT ON COLUMN migration_log.status IS 'Current migration status';
COMMENT ON COLUMN migration_log.error_message IS 'Error message if migration failed';
COMMENT ON COLUMN migration_log.metadata IS 'Additional migration context and data as JSON';

-- Create view for migration summary
CREATE OR REPLACE VIEW migration_summary AS
SELECT
  entity_type,
  status,
  COUNT(*) as count,
  MAX(updated_at) as last_updated
FROM migration_log
GROUP BY entity_type, status
ORDER BY entity_type, status;

COMMENT ON VIEW migration_summary IS 'Summary of migration progress by entity type and status';

-- Create view for failed migrations
CREATE OR REPLACE VIEW failed_migrations AS
SELECT
  *
FROM migration_log
WHERE status = 'failed'
ORDER BY updated_at DESC;

COMMENT ON VIEW failed_migrations IS 'All failed migration attempts for debugging';
