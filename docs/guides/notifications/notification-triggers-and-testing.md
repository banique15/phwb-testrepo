# Notification Triggers and Testing

## Overview

This guide explains which notification types are currently triggered by PHWB code and how to test each flow safely.

This is intended for QA, operations, and developers managing PHWB's in-app Resend notification engine.

## Delivery Model

- **Transactional notifications** send immediately when the business trigger happens.
- **Reminder notifications** are scheduled and sent by cron via `/api/notifications/dispatch`.
- **Retries** (for both categories) are queued using `status='scheduled'` + `next_attempt_at` and picked up by cron.
- **Admin recipients** are configured per admin notification type in **Settings > Notifications**.

## Prerequisites

- Notification migration applied, including templates/policies:
  - `migrations/017_create_notification_engine.sql`
  - `migrations/020_resend_notification_engine.sql`
- Integration environment variables set in PHWB:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_WEBHOOK_SECRET`
  - `CRON_SECRET` (recommended, for Vercel cron auth)
  - `PHWB_INTEGRATION_BEARER_TOKEN`
  - `PHWB_INTEGRATION_HMAC_SECRET`
  - `PHWB_INTEGRATION_MAX_SKEW_SECONDS` (optional)
- At least one active template and enabled policy for the type you are testing.
- Artist records used in tests have valid `email`.

## Trigger Matrix

## Live Triggers (implemented now)

| Notification Type | Trigger Action in PHWB | Source Path |
|---|---|---|
| `artist_added_to_system` | Create a new artist | `src/lib/stores/artists.ts` via `createArtist()` |
| `artist_added_to_event_invited` | Add a new artist assignment to an existing event | `src/lib/stores/events.ts` update path and `src/routes/api/events/[id]/artists/+server.ts` |
| `artist_thank_you_after_completed` | Change event status to `completed` | `src/lib/stores/events.ts` |
| `artist_feedback_request` | Change event status to `completed` | `src/lib/stores/events.ts` |
| `artist_payout_processed` | Process payroll batch to `Paid` | `src/lib/stores/payroll.ts` via `processBatch()` |

## Config-Only Types (present in templates, not yet auto-triggered in PHWB)

These exist in template/policy setup, but do not yet have automatic producer hooks in PHWB:

- `artist_invitation_reminder`
- `artist_booking_confirmation`
- `artist_contract_signature_request`
- `artist_contract_signature_reminder`
- `artist_briefing_packet`
- `artist_pre_event_reminder_48h`
- `artist_pre_event_reminder_24h`
- `artist_accepted_invitation`
- `artist_declined_invitation`
- `booking_request_received_admin`
- `booking_confirmed_admin`
- `partner_requested_artist_not_found_admin`
- `artist_event_starting_reminder`

## End-to-End Test Steps

## 1) Artist Added to System

1. Go to Artists and create a new artist with a valid email.
2. Open `Settings > Notifications` and check the **Notification Runs** table.
3. Confirm a new run appears with:
   - `notification_type = artist_added_to_system`
   - `status = sent` (or `scheduled/failed` when retry/failure path is hit)
4. Verify:
   - attempt record exists
   - run status reflects immediate dispatch (`sent` on success).

## 2) Artist Invited to Event

1. Open an existing event and add one artist not previously assigned.
2. Save event.
3. Verify run appears with:
   - `notification_type = artist_added_to_event_invited`
   - recipient is assigned artist email.
4. Validate immediate status transition to `sent` (or `scheduled/failed` on error path).

## 3) Event Completed Notifications

1. Ensure event has one or more assigned artists with emails.
2. Update event status to `completed`.
3. Verify two runs per artist are created:
   - `artist_thank_you_after_completed`
   - `artist_feedback_request`
4. Validate immediate status updates for each generated run.

## 4) Payout Processed

1. Create/prepare payroll entries for artists with emails.
2. Run payroll batch processing so entries become `Paid`.
3. Verify run appears with:
   - `notification_type = artist_payout_processed`
   - payload includes `compensation_amount` and `payout_date`.
4. Validate immediate status update (`sent` expected on success).

## Reminder/Cron Validation

1. Create a reminder-style run (for a reminder template/policy) with a future `scheduled_for`.
2. Confirm it remains `pending` until due time.
3. Wait for cron cycle and verify:
   - run transitions to `sent` (or retry/failure path),
   - attempt row is created with `provider='resend'`.

For invitation follow-ups, configure `artist_invitation_reminder` policy `dunning_rules` with two offsets, for example:

```json
[
  { "offset_days": 3 },
  { "offset_days": 7 }
]
```

These values determine first/second follow-up scheduling for invitation reminders.

## Webhook/Idempotency Verification

Resend delivery webhooks:

- Endpoint: `/api/notifications/webhooks/resend`
- Duplicate webhook events (same `svix-id`) should return duplicate/no-op behavior.

Response callbacks:

- Endpoint: `/api/notifications/callbacks/response`
- Duplicate callback with same `idempotency_key` should be ignored safely.

## Admin Run Actions

In `Settings > Notifications` run table:

- **Retry**: available for `failed` and `cancelled` runs.
- **Cancel**: available for `pending`, `scheduled`, and `sending` runs.

Use these to validate operational recovery without editing DB rows directly.

## Success Criteria

- Trigger actions create the expected `phwb_notification_runs` records.
- Immediate transactional sends create `phwb_notification_attempts` records without manual dispatch.
- Cron dispatch creates attempts for scheduled reminders and retry workloads.
- Status callbacks update run state correctly.
- Duplicate callbacks do not create duplicate side effects.
- Retry/Cancel actions correctly transition run state.

## Related Documentation

- [VoiceAI v2 Handoff (Legacy)](../../voiceaiagentv5-phase2-handoff.md)
- [Process Payroll](../payroll/process-payroll.md)
- [Edit Event](../events/edit-event.md)
- [Create Artist](../artists/create-artist.md)
