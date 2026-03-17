-- Migration: Create notification engine tables
-- Description:
--   1) Store editable notification templates and policy/dunning configuration
--   2) Track runtime notification runs (outbox/state machine)
--   3) Track attempt-level delivery logs
-- Date: 2026-03-16

-- 1) Templates
CREATE TABLE IF NOT EXISTS phwb_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notification_type text NOT NULL UNIQUE,
  name text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  available_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  brand_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by text,
  updated_by text
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_type
  ON phwb_notification_templates(notification_type);

CREATE INDEX IF NOT EXISTS idx_notification_templates_active
  ON phwb_notification_templates(is_active)
  WHERE is_active = true;

-- 2) Policies / dunning rules
CREATE TABLE IF NOT EXISTS phwb_notification_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  template_id uuid NOT NULL,
  notification_type text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  trigger_event text NOT NULL,
  initial_delay_minutes integer NOT NULL DEFAULT 0,
  dunning_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_attempts integer NOT NULL DEFAULT 3,
  stop_conditions jsonb NOT NULL DEFAULT '["accepted","declined","manual_resolved"]'::jsonb,
  quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notification_policies_template'
  ) THEN
    ALTER TABLE phwb_notification_policies
      ADD CONSTRAINT fk_notification_policies_template
      FOREIGN KEY (template_id)
      REFERENCES phwb_notification_templates(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_policies_enabled
  ON phwb_notification_policies(enabled)
  WHERE enabled = true;

-- 3) Runtime runs / outbox
CREATE TABLE IF NOT EXISTS phwb_notification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  template_id uuid NOT NULL,
  policy_id uuid,
  notification_type text NOT NULL,
  artist_id uuid,
  event_id integer,
  recipient_email text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz,
  sent_at timestamptz,
  next_attempt_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  dedupe_key text UNIQUE,
  external_workflow_id text,
  rendered_subject text,
  rendered_body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  manual_override_reason text
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notification_runs_template'
  ) THEN
    ALTER TABLE phwb_notification_runs
      ADD CONSTRAINT fk_notification_runs_template
      FOREIGN KEY (template_id)
      REFERENCES phwb_notification_templates(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notification_runs_policy'
  ) THEN
    ALTER TABLE phwb_notification_runs
      ADD CONSTRAINT fk_notification_runs_policy
      FOREIGN KEY (policy_id)
      REFERENCES phwb_notification_policies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notification_runs_artist'
  ) THEN
    ALTER TABLE phwb_notification_runs
      ADD CONSTRAINT fk_notification_runs_artist
      FOREIGN KEY (artist_id)
      REFERENCES phwb_artists(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notification_runs_event'
  ) THEN
    ALTER TABLE phwb_notification_runs
      ADD CONSTRAINT fk_notification_runs_event
      FOREIGN KEY (event_id)
      REFERENCES phwb_events(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_notification_runs_status'
  ) THEN
    ALTER TABLE phwb_notification_runs
      ADD CONSTRAINT chk_notification_runs_status
      CHECK (status IN ('pending', 'scheduled', 'sending', 'sent', 'failed', 'cancelled', 'suppressed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_runs_status_scheduled
  ON phwb_notification_runs(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_notification_runs_artist
  ON phwb_notification_runs(artist_id)
  WHERE artist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_runs_event
  ON phwb_notification_runs(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_runs_workflow
  ON phwb_notification_runs(external_workflow_id)
  WHERE external_workflow_id IS NOT NULL;

-- 4) Attempt history
CREATE TABLE IF NOT EXISTS phwb_notification_attempts (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  attempt_no integer NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notification_attempts_run'
  ) THEN
    ALTER TABLE phwb_notification_attempts
      ADD CONSTRAINT fk_notification_attempts_run
      FOREIGN KEY (run_id)
      REFERENCES phwb_notification_runs(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_notification_attempts_status'
  ) THEN
    ALTER TABLE phwb_notification_attempts
      ADD CONSTRAINT chk_notification_attempts_status
      CHECK (status IN ('queued', 'sent', 'failed', 'callback_received'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_attempts_run
  ON phwb_notification_attempts(run_id, attempt_no DESC);

-- Seed defaults for artist/admin notifications
INSERT INTO phwb_notification_templates (
  notification_type,
  name,
  subject_template,
  body_template,
  available_fields,
  brand_config
)
VALUES
  (
    'artist_added_to_system',
    'Artist Added To System',
    'Welcome to Sing for Hope, {{artist_name}}',
    '<p>Hi {{artist_name}},</p><p>Welcome to the Sing for Hope system. We are excited to have you with us.</p>',
    '["artist_name","artist_email"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_added_to_event_invited',
    'Artist Invited To Event',
    'You are invited: {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>You were invited to <strong>{{event_title}}</strong> on {{event_date}} at {{event_start_time}}.</p><p>{{accept_link}}</p><p>{{decline_link}}</p>',
    '["artist_name","artist_email","event_title","event_date","event_start_time","facility_name","accept_link","decline_link"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_invitation_reminder',
    'Artist Invitation Reminder',
    'Reminder: Please respond to {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>This is a reminder to respond to your invitation for {{event_title}} on {{event_date}}.</p>',
    '["artist_name","event_title","event_date","event_start_time","accept_link","decline_link"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_booking_confirmation',
    'Artist Booking Confirmation',
    'Booking confirmed: {{event_title}} on {{event_date}}',
    '<p>Hi {{artist_name}},</p><p>Your booking is confirmed for <strong>{{event_title}}</strong> on {{event_date}} at {{event_start_time}}.</p><p>Compensation: {{compensation_amount}}</p><p>Arrival details: {{arrival_instructions}}</p>',
    '["artist_name","event_title","event_date","event_start_time","facility_name","compensation_amount","arrival_instructions","event_contact_name","event_contact_phone"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_contract_signature_request',
    'Artist Contract Signature Request',
    'Action required: Sign agreement for {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>Please sign your agreement for {{event_title}} to complete the booking.</p><p><a href="{{contract_link}}">Sign agreement</a></p>',
    '["artist_name","event_title","event_date","contract_link"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_contract_signature_reminder',
    'Artist Contract Signature Reminder',
    'Reminder: Signature needed for {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>This is a reminder to sign your event agreement for {{event_title}}.</p><p><a href="{{contract_link}}">Sign agreement</a></p>',
    '["artist_name","event_title","event_date","contract_link"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_briefing_packet',
    'Artist Briefing Packet',
    'Event briefing: {{event_title}} ({{event_date}})',
    '<p>Hi {{artist_name}},</p><p>Here is your briefing packet for {{event_title}}.</p><p>Audience context, schedule, and logistics are included.</p><p>Contact: {{event_contact_name}} ({{event_contact_phone}})</p>',
    '["artist_name","event_title","event_date","event_start_time","facility_name","event_contact_name","event_contact_phone","arrival_instructions"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_pre_event_reminder_48h',
    'Artist Pre-Event Reminder (48h)',
    'Reminder: {{event_title}} in 48 hours',
    '<p>Hi {{artist_name}},</p><p>Your event {{event_title}} is coming up in 48 hours.</p><p>Contact: {{event_contact_name}} ({{event_contact_phone}})</p><p>{{arrival_instructions}}</p>',
    '["artist_name","event_title","event_date","event_start_time","facility_name","event_contact_name","event_contact_phone","arrival_instructions"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_pre_event_reminder_24h',
    'Artist Pre-Event Reminder (24h)',
    'Reminder: {{event_title}} in 24 hours',
    '<p>Hi {{artist_name}},</p><p>Your event {{event_title}} starts tomorrow at {{event_start_time}}.</p><p>Contact: {{event_contact_name}} ({{event_contact_phone}})</p><p>{{arrival_instructions}}</p>',
    '["artist_name","event_title","event_date","event_start_time","facility_name","event_contact_name","event_contact_phone","arrival_instructions"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_accepted_invitation',
    'Artist Accepted Invitation',
    '{{artist_name}} accepted {{event_title}}',
    '<p>{{artist_name}} has accepted the invitation for {{event_title}}.</p>',
    '["artist_name","event_title","event_date"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_declined_invitation',
    'Artist Declined Invitation',
    '{{artist_name}} declined {{event_title}}',
    '<p>{{artist_name}} has declined the invitation for {{event_title}}.</p>',
    '["artist_name","event_title","event_date"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'booking_request_received_admin',
    'Booking Request Received (Admin)',
    'New booking request: {{event_title}}',
    '<p>A new booking request has been created for {{event_title}} on {{event_date}}.</p><p>Please review requirements and artist matching.</p>',
    '["event_title","event_date","event_start_time","facility_name"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'booking_confirmed_admin',
    'Booking Confirmed (Admin)',
    'Booking confirmed: {{artist_name}} for {{event_title}}',
    '<p>{{artist_name}} is confirmed for {{event_title}} on {{event_date}}.</p><p>Contact: {{artist_email}}</p>',
    '["artist_name","artist_email","event_title","event_date","event_start_time","facility_name"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'partner_requested_artist_not_found_admin',
    'Partner Requested Artist Not Found (Admin)',
    'Partner request needs onboarding: {{artist_name}}',
    '<p>A partner requested {{artist_name}}, but the artist is not found in PHWB.</p><p>Please start onboarding and notify the program manager.</p>',
    '["artist_name","event_title","event_date","facility_name"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_event_starting_reminder',
    'Artist Event Starting Reminder',
    'Upcoming event reminder: {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>Your event <strong>{{event_title}}</strong> starts soon at {{event_start_time}}.</p>',
    '["artist_name","event_title","event_date","event_start_time","facility_name"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_thank_you_after_completed',
    'Artist Thank You',
    'Thank you for performing at {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>Thank you for your performance at {{event_title}}. We appreciate your work.</p>',
    '["artist_name","event_title","event_date","facility_name"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_feedback_request',
    'Artist Feedback Request',
    'We value your feedback for {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>Thank you again for performing at {{event_title}}.</p><p>Please share your feedback here: <a href="{{feedback_form_link}}">Submit feedback</a>.</p>',
    '["artist_name","event_title","event_date","feedback_form_link"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  ),
  (
    'artist_payout_processed',
    'Artist Payout Processed',
    'Your payout has been processed for {{event_title}}',
    '<p>Hi {{artist_name}},</p><p>Your payout of {{compensation_amount}} for {{event_title}} has been processed.</p><p>Payout date: {{payout_date}}</p>',
    '["artist_name","event_title","event_date","compensation_amount","payout_date"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#0f766e","brand_accent":"#14b8a6"}'::jsonb
  )
ON CONFLICT (notification_type) DO NOTHING;

INSERT INTO phwb_notification_policies (
  template_id,
  notification_type,
  enabled,
  trigger_event,
  initial_delay_minutes,
  dunning_rules,
  max_attempts,
  stop_conditions
)
SELECT
  t.id,
  t.notification_type,
  true,
  t.notification_type,
  CASE
    WHEN t.notification_type = 'artist_briefing_packet' THEN -5760
    WHEN t.notification_type = 'artist_pre_event_reminder_48h' THEN -2880
    WHEN t.notification_type = 'artist_pre_event_reminder_24h' THEN -1440
    WHEN t.notification_type = 'artist_event_starting_reminder' THEN -60
    ELSE 0
  END,
  CASE
    WHEN t.notification_type = 'artist_added_to_event_invited' THEN
      '[{"offset_minutes":4320},{"offset_minutes":10080}]'::jsonb
    WHEN t.notification_type = 'artist_contract_signature_request' THEN
      '[{"offset_minutes":1440},{"offset_minutes":2880},{"offset_minutes":4320}]'::jsonb
    ELSE
      '[]'::jsonb
  END,
  CASE
    WHEN t.notification_type = 'artist_contract_signature_request' THEN 5
    ELSE 3
  END,
  '["accepted","declined","manual_resolved"]'::jsonb
FROM phwb_notification_templates t
LEFT JOIN phwb_notification_policies p
  ON p.notification_type = t.notification_type
WHERE p.id IS NULL;
