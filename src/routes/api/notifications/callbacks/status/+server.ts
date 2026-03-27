import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { z } from 'zod'
import { verifyIntegrationAuth } from '$lib/server/integration-auth'

const statusCallbackSchema = z.object({
  contract_version: z.string().default('v1'),
  idempotency_key: z.string().min(1),
  run_id: z.string().uuid().optional(),
  external_workflow_id: z.string().optional().nullable(),
  attempt_no: z.number().int().min(1).default(1),
  provider: z.string().default('voiceai'),
  provider_message_id: z.string().optional().nullable(),
  status: z.enum(['queued', 'sent', 'failed', 'callback_received']),
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional()
    })
    .optional()
    .nullable(),
  sent_at: z.string().optional().nullable()
})

function mapRunStatus(status: z.infer<typeof statusCallbackSchema>['status']) {
  if (status === 'queued') return 'scheduled'
  if (status === 'sent' || status === 'callback_received') return 'sent'
  return 'failed'
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
  const rawBody = await request.text()
  const authResult = verifyIntegrationAuth({
    method: request.method,
    path: url.pathname,
    rawBody,
    headers: request.headers
  })
  if (!authResult.ok) {
    return json({ error: authResult.reason || 'Unauthorized' }, { status: 401 })
  }

  let payload: z.infer<typeof statusCallbackSchema>
  try {
    payload = statusCallbackSchema.parse(rawBody ? JSON.parse(rawBody) : {})
  } catch (error) {
    return json({ error: 'Invalid payload', details: error }, { status: 400 })
  }

  const runQuery = payload.run_id
    ? locals.supabaseAdmin.from('phwb_notification_runs').select('*').eq('id', payload.run_id)
    : locals.supabaseAdmin
        .from('phwb_notification_runs')
        .select('*')
        .eq('external_workflow_id', payload.external_workflow_id || '')

  const { data: run, error: runError } = await runQuery.maybeSingle()
  if (runError || !run) {
    return json({ error: 'Notification run not found' }, { status: 404 })
  }

  const currentPayload = (run.payload || {}) as Record<string, unknown>
  const processedStatusKeys = Array.isArray(currentPayload.status_callback_idempotency_keys)
    ? (currentPayload.status_callback_idempotency_keys as string[])
    : []
  if (processedStatusKeys.includes(payload.idempotency_key)) {
    return json({ ok: true, duplicate: true })
  }

  const { data: existingAttempt } = await locals.supabaseAdmin
    .from('phwb_notification_attempts')
    .select('id')
    .eq('run_id', run.id)
    .eq('attempt_no', payload.attempt_no)
    .eq('provider', payload.provider)
    .eq('provider_message_id', payload.provider_message_id || '')
    .maybeSingle()

  if (existingAttempt) {
    return json({ ok: true, duplicate: true })
  }

  await locals.supabaseAdmin.from('phwb_notification_attempts').insert([
    {
      run_id: run.id,
      attempt_no: payload.attempt_no,
      provider: payload.provider,
      status: payload.status,
      provider_message_id: payload.provider_message_id || null,
      request_payload: {
        idempotency_key: payload.idempotency_key
      },
      response_payload: payload,
      error_message: payload.error?.message || null
    }
  ])

  const nextStatus = mapRunStatus(payload.status)
  const updates: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
    external_workflow_id: payload.external_workflow_id || run.external_workflow_id,
    last_error: payload.error?.message || null,
    payload: {
      ...currentPayload,
      last_status_callback_at: new Date().toISOString(),
      last_status_callback_idempotency_key: payload.idempotency_key,
      status_callback_idempotency_keys: [...processedStatusKeys, payload.idempotency_key].slice(-25)
    }
  }
  if (nextStatus === 'sent') {
    updates.sent_at = payload.sent_at || new Date().toISOString()
  }

  await locals.supabaseAdmin.from('phwb_notification_runs').update(updates).eq('id', run.id)

  return json({ ok: true })
}
