# Vercel Cron Setup for Notification Dispatch

## Overview

This guide explains how to configure Vercel Cron to trigger PHWB notification dispatch on a schedule.

It is designed for the current simplified notification engine:

- PHWB stores notification runs in `phwb_notification_runs`
- dispatch is executed by `GET /api/notifications/dispatch` for scheduled reminders/retries
- outbound delivery uses Resend
- retries are controlled by run status + `next_attempt_at`

Important behavior:

- Transactional notifications are sent immediately at trigger time.
- Cron dispatch is responsible for reminder sends and retries.

## Prerequisites

- The notification engine migrations are applied:
  - `migrations/017_create_notification_engine.sql`
  - `migrations/020_resend_notification_engine.sql`
- Dispatch route exists at `src/routes/api/notifications/dispatch/+server.ts`
- Vercel project is connected to this repository

## Required Environment Variables (Vercel)

Set these in **Vercel Project Settings -> Environment Variables**:

- `CRON_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_WEBHOOK_SECRET`

Optional compatibility variables:

- `PHWB_INTEGRATION_BEARER_TOKEN`
- `PHWB_INTEGRATION_HMAC_SECRET`
- `PHWB_INTEGRATION_MAX_SKEW_SECONDS`

Notes:

- Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
- In this codebase, dispatch auth accepts signed-in session OR integration bearer/HMAC.

## Cron Configuration

Create or update `vercel.json` at repo root:

```json
{
  "crons": [
    {
      "path": "/api/notifications/dispatch",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Schedule Guidance

- `*/5 * * * *`: every 5 minutes (recommended default)
- `*/1 * * * *`: every minute (higher load, faster pickup)
- `*/10 * * * *`: every 10 minutes (lower load, slower pickup)
- `0 9 * * *`: daily at 09:00 UTC (works well if reminder workload is daily)

## Deployment Steps

1. Commit `vercel.json` (and notification changes if not yet deployed).
2. Push to the branch connected to your Vercel environment.
3. Verify the deployment succeeds.
4. Open Vercel dashboard:
   - **Project -> Cron Jobs** to confirm cron is registered.

## Verify Cron Is Running

### 1) Create a reminder-type pending run

Use a reminder template/policy with future scheduling so the run is intended for cron dispatch.

### 2) Wait for next cron interval

After cron runs, confirm:

- `phwb_notification_runs.status` transitions from `pending/scheduled` to `sent` or `failed`
- `phwb_notification_attempts` row is created with `provider='resend'`

### 3) Validate retry behavior

If Resend fails:

- run becomes `scheduled` (if attempts remain)
- `next_attempt_at` is set
- a failed attempt row is recorded

## Manual Testing (Without Waiting for Cron)

You can manually trigger dispatch with integration auth.

`GET` example:

```bash
curl -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/notifications/dispatch?limit=25"
```

`POST` example:

```bash
curl -i \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"limit":25}' \
  "https://<your-domain>/api/notifications/dispatch"
```

## Troubleshooting

### 401 Unauthorized on cron calls

- Confirm `CRON_SECRET` is set in Vercel.
- Confirm deployment is using latest code.
- Confirm cron path exactly matches `/api/notifications/dispatch`.

### Runs remain pending

- Check cron schedule and latest run status in Vercel dashboard.
- Ensure `scheduled_for` and `next_attempt_at` are due.
- Confirm the run is a reminder-type notification (transactional notifications should not wait for cron).
- Verify route is reachable and not blocked by middleware.

### Runs fail immediately

- Verify `RESEND_API_KEY` is valid.
- Verify `RESEND_FROM_EMAIL` is a verified sender/domain in Resend.
- Check `last_error` and `phwb_notification_attempts.error_message`.

### No webhook updates

- Verify webhook endpoint is configured in Resend:
  - `POST /api/notifications/webhooks/resend`
- Verify `RESEND_WEBHOOK_SECRET` matches the signing secret from Resend.

## Related Guides

- `docs/guides/notifications/notification-triggers-and-testing.md`
- `src/routes/api/notifications/dispatch/+server.ts`
- `src/routes/api/notifications/webhooks/resend/+server.ts`

