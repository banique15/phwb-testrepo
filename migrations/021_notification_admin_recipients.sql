-- Migration: Admin notification recipients
-- Description:
--   1) Add recipient table for all admin notification types
--   2) Seed from legacy config options when available
-- Date: 2026-03-23

CREATE TABLE IF NOT EXISTS phwb_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notification_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_recipients_type_email
  ON phwb_notification_recipients(notification_type, recipient_email);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_type_active
  ON phwb_notification_recipients(notification_type, active)
  WHERE active = true;

-- Backfill legacy booking-confirmed admin recipients from config options.
INSERT INTO phwb_notification_recipients (notification_type, recipient_email, recipient_name, active)
SELECT
  'booking_confirmed_admin',
  TRIM(value),
  NULL,
  true
FROM phwb_config_options
WHERE entity = 'notifications'
  AND field = 'booking_confirmed_admin_recipient'
  AND active = true
  AND value IS NOT NULL
  AND TRIM(value) <> ''
ON CONFLICT (notification_type, recipient_email) DO NOTHING;

