-- Migration: Resend notification engine compatibility
-- Description:
--   1) Add provider event metadata fields for webhook/audit reconciliation
--   2) Add lookup indexes for resend message/event identifiers
-- Date: 2026-03-23

ALTER TABLE phwb_notification_attempts
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS provider_event_type text,
  ADD COLUMN IF NOT EXISTS provider_event_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notification_attempts_provider_message
  ON phwb_notification_attempts(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_attempts_provider_event
  ON phwb_notification_attempts(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_runs_dispatch_queue
  ON phwb_notification_runs(status, next_attempt_at, scheduled_for, created_at)
  WHERE status IN ('pending', 'scheduled');

