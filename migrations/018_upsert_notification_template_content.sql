-- Migration: Upsert notification template content
-- Description:
--   Overwrite seeded notification template copy/HTML/brand config in existing environments.
--   Use this after 017 in environments where template rows already exist.
-- Date: 2026-03-18

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
    $html$<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background-color:#f4f7f6;font-family:Arial,Helvetica,sans-serif;"><tr><td align="center" style="padding:28px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><tr><td style="background:#339933;padding:20px;text-align:center;"><img src="{{logo_url}}" alt="Sing for Hope" width="140" style="display:block;margin:0 auto;border:0;max-width:140px;height:auto;"></td></tr><tr><td style="padding:28px 24px;color:#111827;"><p style="margin:0 0 14px 0;font-size:16px;line-height:24px;">Hi {{artist_name}},</p><p style="margin:0 0 14px 0;font-size:16px;line-height:24px;">Welcome to Sing for Hope. We are thrilled to have you in our artist community.</p><p style="margin:0;font-size:16px;line-height:24px;">Our team will share opportunities and updates as new engagements become available.</p></td></tr><tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">Sing for Hope</td></tr></table></td></tr></table>$html$,
    '["artist_name","artist_email","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_added_to_event_invited',
    'Artist Invited To Event',
    'You are invited: {{event_title}}',
    $html$<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background-color:#f4f7f6;font-family:Arial,Helvetica,sans-serif;"><tr><td align="center" style="padding:28px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><tr><td style="background:#339933;padding:20px;text-align:center;"><img src="{{logo_url}}" alt="Sing for Hope" width="140" style="display:block;margin:0 auto;border:0;max-width:140px;height:auto;"></td></tr><tr><td style="padding:28px 24px;color:#111827;"><p style="margin:0 0 14px 0;font-size:16px;line-height:24px;">Hi {{artist_name}},</p><p style="margin:0 0 14px 0;font-size:16px;line-height:24px;">You are invited to <strong>{{event_title}}</strong>.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;"><tr><td style="padding:14px;color:#374151;font-size:15px;line-height:22px;"><p style="margin:0 0 6px 0;"><strong>Date:</strong> {{event_date}}</p><p style="margin:0 0 6px 0;"><strong>Start Time:</strong> {{event_start_time}}</p><p style="margin:0;"><strong>Location:</strong> {{facility_name}}</p></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px 0;"><tr><td style="background:#339933;border-radius:8px;"><a href="{{accept_link}}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:bold;">Accept Invitation</a></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0;"><tr><td style="background:#dc2626;border-radius:8px;"><a href="{{decline_link}}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:bold;">Decline Invitation</a></td></tr></table></td></tr><tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">Sing for Hope</td></tr></table></td></tr></table>$html$,
    '["artist_name","artist_email","event_title","event_date","event_start_time","facility_name","accept_link","decline_link","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_invitation_reminder',
    'Artist Invitation Reminder',
    'Reminder: Please respond to {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>This is a friendly reminder to respond to your invitation for <strong>{{event_title}}</strong> on {{event_date}} at {{event_start_time}}.</p><p><a href="{{accept_link}}">Accept invitation</a> | <a href="{{decline_link}}">Decline invitation</a></p>$html$,
    '["artist_name","event_title","event_date","event_start_time","accept_link","decline_link","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_booking_confirmation',
    'Artist Booking Confirmation',
    'Booking confirmed: {{event_title}} on {{event_date}}',
    $html$<p>Hi {{artist_name}},</p><p>Your booking is confirmed for <strong>{{event_title}}</strong> on {{event_date}} at {{event_start_time}}.</p><p><strong>Location:</strong> {{facility_name}}<br><strong>Compensation:</strong> {{compensation_amount}}</p><p>{{arrival_instructions}}</p><p>Questions? {{event_contact_name}} · {{event_contact_phone}}</p>$html$,
    '["artist_name","event_title","event_date","event_start_time","facility_name","compensation_amount","arrival_instructions","event_contact_name","event_contact_phone","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_contract_signature_request',
    'Artist Contract Signature Request',
    'Action required: Sign agreement for {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>To finalize your booking for <strong>{{event_title}}</strong> on {{event_date}}, please complete your agreement.</p><p><a href="{{contract_link}}" style="display:inline-block;padding:10px 18px;background:#339933;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Review and Sign Agreement</a></p>$html$,
    '["artist_name","event_title","event_date","contract_link","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_contract_signature_reminder',
    'Artist Contract Signature Reminder',
    'Reminder: Signature needed for {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>This is a reminder to sign your agreement for <strong>{{event_title}}</strong> on {{event_date}}.</p><p><a href="{{contract_link}}">Sign agreement now</a></p>$html$,
    '["artist_name","event_title","event_date","contract_link","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_briefing_packet',
    'Artist Briefing Packet',
    'Event briefing: {{event_title}} ({{event_date}})',
    $html$<p>Hi {{artist_name}},</p><p>Your briefing packet for <strong>{{event_title}}</strong> is now ready.</p><p><strong>Date:</strong> {{event_date}} at {{event_start_time}}<br><strong>Location:</strong> {{facility_name}}</p><p>{{arrival_instructions}}</p><p>Primary contact: {{event_contact_name}} · {{event_contact_phone}}</p>$html$,
    '["artist_name","event_title","event_date","event_start_time","facility_name","event_contact_name","event_contact_phone","arrival_instructions","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_pre_event_reminder_48h',
    'Artist Pre-Event Reminder (48h)',
    'Reminder: {{event_title}} in 48 hours',
    $html$<p>Hi {{artist_name}},</p><p>Your performance for <strong>{{event_title}}</strong> is in 48 hours.</p><p><strong>Date:</strong> {{event_date}} at {{event_start_time}}<br><strong>Location:</strong> {{facility_name}}</p><p>{{arrival_instructions}}</p><p>Contact: {{event_contact_name}} · {{event_contact_phone}}</p>$html$,
    '["artist_name","event_title","event_date","event_start_time","facility_name","event_contact_name","event_contact_phone","arrival_instructions","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_pre_event_reminder_24h',
    'Artist Pre-Event Reminder (24h)',
    'Reminder: {{event_title}} in 24 hours',
    $html$<p>Hi {{artist_name}},</p><p>Your performance for <strong>{{event_title}}</strong> is tomorrow at {{event_start_time}}.</p><p><strong>Date:</strong> {{event_date}}<br><strong>Location:</strong> {{facility_name}}</p><p>{{arrival_instructions}}</p><p>Contact: {{event_contact_name}} · {{event_contact_phone}}</p>$html$,
    '["artist_name","event_title","event_date","event_start_time","facility_name","event_contact_name","event_contact_phone","arrival_instructions","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_accepted_invitation',
    'Artist Accepted Invitation',
    '{{artist_name}} accepted {{event_title}}',
    $html$<p><strong>{{artist_name}}</strong> accepted the invitation for <strong>{{event_title}}</strong> on {{event_date}}.</p>$html$,
    '["artist_name","event_title","event_date","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_declined_invitation',
    'Artist Declined Invitation',
    '{{artist_name}} declined {{event_title}}',
    $html$<p><strong>{{artist_name}}</strong> declined the invitation for <strong>{{event_title}}</strong> on {{event_date}}.</p>$html$,
    '["artist_name","event_title","event_date","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'booking_request_received_admin',
    'Booking Request Received (Admin)',
    'New booking request: {{event_title}}',
    $html$<p>A new booking request has been created.</p><p><strong>Event:</strong> {{event_title}}<br><strong>Date:</strong> {{event_date}} at {{event_start_time}}<br><strong>Location:</strong> {{facility_name}}</p><p>Please review and begin artist matching.</p>$html$,
    '["event_title","event_date","event_start_time","facility_name","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'booking_confirmed_admin',
    'Booking Confirmed (Admin)',
    'Booking confirmed: {{artist_name}} for {{event_title}}',
    $html$<p>Booking confirmed.</p><p><strong>Artist:</strong> {{artist_name}} ({{artist_email}})<br><strong>Event:</strong> {{event_title}}<br><strong>Date:</strong> {{event_date}} at {{event_start_time}}<br><strong>Location:</strong> {{facility_name}}</p>$html$,
    '["artist_name","artist_email","event_title","event_date","event_start_time","facility_name","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'partner_requested_artist_not_found_admin',
    'Partner Requested Artist Not Found (Admin)',
    'Partner request needs onboarding: {{artist_name}}',
    $html$<p>A partner requested <strong>{{artist_name}}</strong>, but no matching artist record was found.</p><p><strong>Event:</strong> {{event_title}} on {{event_date}} at {{facility_name}}</p><p>Please initiate onboarding and follow up with the requesting partner.</p>$html$,
    '["artist_name","event_title","event_date","facility_name","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_event_starting_reminder',
    'Artist Event Starting Reminder',
    'Upcoming event reminder: {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>Your event <strong>{{event_title}}</strong> starts soon at {{event_start_time}}.</p><p><strong>Date:</strong> {{event_date}}<br><strong>Location:</strong> {{facility_name}}</p>$html$,
    '["artist_name","event_title","event_date","event_start_time","facility_name","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_thank_you_after_completed',
    'Artist Thank You',
    'Thank you for performing at {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>Thank you for sharing your artistry at <strong>{{event_title}}</strong> on {{event_date}}.</p><p>Your contribution brought meaningful impact to our community.</p>$html$,
    '["artist_name","event_title","event_date","facility_name","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_feedback_request',
    'Artist Feedback Request',
    'We value your feedback for {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>Thank you again for performing at <strong>{{event_title}}</strong> on {{event_date}}.</p><p>We would appreciate your feedback to help us improve future artist experiences.</p><p><a href="{{feedback_form_link}}" style="display:inline-block;padding:10px 18px;background:#339933;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Share Feedback</a></p>$html$,
    '["artist_name","event_title","event_date","feedback_form_link","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  ),
  (
    'artist_payout_processed',
    'Artist Payout Processed',
    'Your payout has been processed for {{event_title}}',
    $html$<p>Hi {{artist_name}},</p><p>Your payout for <strong>{{event_title}}</strong> has been processed.</p><p><strong>Amount:</strong> {{compensation_amount}}<br><strong>Payout date:</strong> {{payout_date}}</p><p>Thank you for your partnership with Sing for Hope.</p>$html$,
    '["artist_name","event_title","event_date","compensation_amount","payout_date","logo_url"]'::jsonb,
    '{"logo_url":"/sfh-logo.png","brand_primary":"#339933","brand_accent":"#66bb66"}'::jsonb
  )
ON CONFLICT (notification_type) DO UPDATE
SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  available_fields = EXCLUDED.available_fields,
  brand_config = EXCLUDED.brand_config,
  updated_at = now();
