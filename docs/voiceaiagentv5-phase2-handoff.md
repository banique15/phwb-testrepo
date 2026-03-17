# PHWB -> voiceaiagentv5 Phase 2 Handoff

## Purpose

This document is the implementation handoff for the agent/team working on `voiceaiagentv5`, aligned to PHWB Phase 2 notification integration.

PHWB is the source of truth for notification lifecycle and configuration.  
voiceaiagentv5 is the workflow execution and delivery engine.

## Current VoiceAI Readiness Gaps (Observed)

- No authenticated inbound API for PHWB notification enqueue.
- No signed callback endpoints/emitters for PHWB status sync.
- No idempotency/replay protection for cross-system events.
- Temporal queue mismatch:
  - Worker listens on `voiceai-email-queue-v3`
  - Some workflow starters use `voiceai-email-queue`

## Integration Boundary

## PHWB Owns

- Template/policy definitions and admin UI:
  - `phwb_notification_templates`
  - `phwb_notification_policies`
- Runtime tracking/audit:
  - `phwb_notification_runs`
  - `phwb_notification_attempts`
- Trigger generation from domain events:
  - artist/event/payroll workflows

## voiceaiagentv5 Owns

- Workflow orchestration (Temporal)
- Email provider execution/retries
- Callback notifications back to PHWB

## Contract v1 (Required)

All payloads should include:

- `contract_version` (string, e.g. `v1`)
- `sent_at` (ISO timestamp)
- `idempotency_key` (unique per event delivery)

### 1) PHWB -> voiceai enqueue

`POST /api/notifications/enqueue`

Auth (initially both supported):

- `Authorization: Bearer <token>`
- `X-Webhook-Timestamp`, `X-Webhook-Signature` (HMAC)

Request:

```json
{
  "contract_version": "v1",
  "run_id": "uuid",
  "dedupe_key": "string",
  "notification_type": "artist_added_to_event_invited",
  "recipient": {
    "email": "artist@example.com",
    "name": "Artist Name"
  },
  "context": {
    "artist_id": "uuid",
    "event_id": 123
  },
  "content": {
    "subject": "You are invited: {{event_title}}",
    "html": "<p>...</p>"
  },
  "schedule": {
    "scheduled_for": "2026-03-18T15:00:00Z",
    "max_attempts": 3
  }
}
```

Response:

```json
{
  "ok": true,
  "external_workflow_id": "string",
  "accepted_at": "2026-03-18T14:00:00Z"
}
```

### 2) voiceai -> PHWB delivery status callback

`POST /api/notifications/callbacks/status` (PHWB endpoint)

Request:

```json
{
  "contract_version": "v1",
  "idempotency_key": "string",
  "run_id": "uuid",
  "external_workflow_id": "string",
  "attempt_no": 1,
  "provider": "resend",
  "provider_message_id": "string",
  "status": "queued|sent|failed|callback_received",
  "error": {
    "code": "optional_code",
    "message": "optional_message"
  },
  "sent_at": "2026-03-18T15:01:00Z"
}
```

### 3) voiceai -> PHWB artist response callback

`POST /api/notifications/callbacks/response` (PHWB endpoint)

Request:

```json
{
  "contract_version": "v1",
  "idempotency_key": "string",
  "run_id": "uuid",
  "external_workflow_id": "string",
  "response": "accepted|declined",
  "artist_id": "uuid",
  "event_id": 123,
  "responded_at": "2026-03-18T16:20:00Z"
}
```

## Auth and Replay Rules

- HMAC verification should cover: `method + path + timestamp + raw_body`.
- Reject when timestamp drift > 5 minutes.
- Bearer token must be validated against configured shared secret/token.
- Either HMAC or Bearer accepted initially; long-term recommendation is HMAC required.

## Idempotency Rules

- `idempotency_key` must be unique per delivered event (enqueue/callback).
- Duplicate keys must return success/no-op response.
- Workflow correlation:
  - `run_id` = PHWB canonical row id
  - `external_workflow_id` = voiceai canonical workflow id

## Required VoiceAI Changes (Checklist)

- Add authenticated enqueue endpoint for PHWB payloads.
- Add callback sender for status transitions and response events.
- Add idempotency table/store for keys and processing result.
- Unify Temporal task queue naming for worker + starters.
- Add structured logs with:
  - `run_id`
  - `external_workflow_id`
  - `notification_type`
  - `attempt_no`

## PHWB File Map (for cross-reference)

Use these PHWB files/symbols when wiring voiceai integration:

- Trigger and outbox producers:
  - `src/lib/stores/artists.ts` -> `createArtist`
  - `src/lib/stores/events.ts` -> `eventsStore.update`
  - `src/lib/stores/payroll.ts` -> `processBatch`
  - `src/routes/api/events/[id]/artists/+server.ts` -> assignment API path
- Notification config UI:
  - `src/routes/settings/notifications/+page.svelte`
- Notification schema/types:
  - `src/lib/schemas/notification-template.ts`
  - `src/lib/schemas/notification-policy.ts`
  - `src/lib/schemas/notification-run.ts`
  - `src/lib/schemas/notification-attempt.ts`
- Database contracts:
  - `migrations/017_create_notification_engine.sql`

## Clarifications For VoiceAI Agent

- When the PHWB team says "reuse PHWB notification component/state", they are referring to:
  - the template/policy model in `src/routes/settings/notifications/+page.svelte`
  - and DB-backed state in `phwb_notification_runs`/`phwb_notification_attempts`.
- VoiceAI should not create alternate source-of-truth statuses; it should report execution state back to PHWB callbacks.
- Notification type names must remain exactly as PHWB enum values to avoid mapping drift.

## Minimal End-to-End Test Matrix

- Enqueue one run for each category:
  - artist-facing (invitation, reminder, payout)
  - admin-facing (accepted/declined updates)
- Verify:
  - enqueue accepted
  - workflow executed
  - status callback reaches PHWB
  - retries are bounded and logged
  - duplicate callback with same `idempotency_key` is no-op

