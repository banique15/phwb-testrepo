import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { z } from 'zod'
import { Webhook } from 'svix'
import { env } from '$env/dynamic/private'

const resendWebhookSchema = z.object({
  type: z.string().min(1),
  created_at: z.string().optional().nullable(),
  data: z
    .object({
      email_id: z.string().optional().nullable(),
      to: z.array(z.string()).optional().nullable(),
      subject: z.string().optional().nullable(),
      tags: z.array(z.object({ name: z.string(), value: z.string() })).optional().nullable()
    })
    .passthrough()
    .optional()
    .nullable()
})

function mapRunStatusFromEvent(eventType: string): 'sent' | 'failed' | 'scheduled' {
  if (eventType === 'email.bounced' || eventType === 'email.complained') return 'failed'
  if (eventType === 'email.delivery_delayed') return 'scheduled'
  return 'sent'
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const webhookSecret = env.RESEND_WEBHOOK_SECRET || ''
  if (!webhookSecret) {
    return json({ error: 'RESEND_WEBHOOK_SECRET is not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const svixId = request.headers.get('svix-id') || ''
  const svixTimestamp = request.headers.get('svix-timestamp') || ''
  const svixSignature = request.headers.get('svix-signature') || ''

  if (!svixId || !svixTimestamp || !svixSignature) {
    return json({ error: 'Missing svix signature headers' }, { status: 400 })
  }

  let payload: z.infer<typeof resendWebhookSchema>
  try {
    const webhook = new Webhook(webhookSecret)
    webhook.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    })
    payload = resendWebhookSchema.parse(JSON.parse(rawBody))
  } catch (error) {
    return json(
      { error: 'Invalid webhook signature or payload', details: error instanceof Error ? error.message : error },
      { status: 400 }
    )
  }

  const eventId = svixId
  const eventType = payload.type
  const emailId = payload.data?.email_id || null
  const runIdFromTags = payload.data?.tags?.find((tag) => tag.name === 'run_id')?.value || null

  let runId: string | null = runIdFromTags
  let matchedAttemptNo = 1

  if (!runId && emailId) {
    const { data: attemptByEmail } = await locals.supabaseAdmin
      .from('phwb_notification_attempts')
      .select('run_id, attempt_no')
      .eq('provider', 'resend')
      .eq('provider_message_id', emailId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    runId = attemptByEmail?.run_id || null
    matchedAttemptNo = attemptByEmail?.attempt_no || 1
  }

  if (!runId) {
    return json({ ok: true, ignored: true, reason: 'run not resolved' })
  }

  const { data: run } = await locals.supabaseAdmin
    .from('phwb_notification_runs')
    .select('id,payload,status,attempt_count,max_attempts')
    .eq('id', runId)
    .maybeSingle()
  if (!run) {
    return json({ ok: true, ignored: true, reason: 'run not found' })
  }

  const currentPayload = (run.payload || {}) as Record<string, unknown>
  const processedWebhookIds = Array.isArray(currentPayload.resend_webhook_event_ids)
    ? (currentPayload.resend_webhook_event_ids as string[])
    : []
  if (processedWebhookIds.includes(eventId)) {
    return json({ ok: true, duplicate: true })
  }

  const callbackAttemptNo = run.attempt_count || matchedAttemptNo || 1
  await locals.supabaseAdmin.from('phwb_notification_attempts').insert([
    {
      run_id: run.id,
      attempt_no: callbackAttemptNo,
      provider: 'resend',
      status: 'callback_received',
      provider_message_id: emailId,
      request_payload: {
        event_id: eventId,
        event_type: eventType
      },
      response_payload: payload
    }
  ])

  const nextStatus = mapRunStatusFromEvent(eventType)
  const isFailure = nextStatus === 'failed'
  const canRetry = isFailure && (run.attempt_count || 0) < (run.max_attempts || 3)

  const runUpdates: Record<string, unknown> = {
    status: canRetry ? 'scheduled' : nextStatus,
    updated_at: new Date().toISOString(),
    next_attempt_at: canRetry ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
    last_error: isFailure ? `Resend webhook event: ${eventType}` : null,
    payload: {
      ...currentPayload,
      last_resend_webhook_at: new Date().toISOString(),
      last_resend_webhook_event_type: eventType,
      resend_webhook_event_ids: [...processedWebhookIds, eventId].slice(-50)
    }
  }
  if (nextStatus === 'sent') {
    runUpdates.sent_at = new Date().toISOString()
  }

  await locals.supabaseAdmin.from('phwb_notification_runs').update(runUpdates).eq('id', run.id)

  return json({ ok: true })
}

