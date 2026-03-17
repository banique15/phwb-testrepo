import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { z } from 'zod'
import { env } from '$env/dynamic/private'
import { getOutboundIntegrationAuthHeaders, verifyIntegrationAuth } from '$lib/server/integration-auth'

const dispatchRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(25)
  })
  .partial()

export const POST: RequestHandler = async ({ request, locals, url }) => {
  const rawBody = await request.text()
  const parsedBody = rawBody ? JSON.parse(rawBody) : {}
  const body = dispatchRequestSchema.parse(parsedBody)

  const authResult = verifyIntegrationAuth({
    method: request.method,
    path: url.pathname,
    rawBody,
    headers: request.headers
  })
  const hasSession = !!locals.session

  if (!hasSession && !authResult.ok) {
    return json({ error: authResult.reason || 'Unauthorized' }, { status: 401 })
  }

  const voiceaiBaseUrl = env.VOICEAI_BASE_URL || env.VOICEAI_AGENT_BASE_URL || ''
  if (!voiceaiBaseUrl) {
    return json({ error: 'VOICEAI_BASE_URL is not configured' }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  const { data: candidates, error: fetchError } = await locals.supabaseAdmin
    .from('phwb_notification_runs')
    .select('*')
    .in('status', ['pending', 'scheduled'])
    .order('created_at', { ascending: true })
    .limit(body.limit ?? 25)

  if (fetchError) {
    return json({ error: fetchError.message }, { status: 500 })
  }

  const runnable = (candidates || []).filter((row) => {
    const scheduledFor = row.next_attempt_at || row.scheduled_for
    if (!scheduledFor) return true
    return new Date(scheduledFor).getTime() <= new Date(nowIso).getTime()
  })

  const results: Array<{ run_id: string; ok: boolean; message?: string }> = []
  let claimedCount = 0

  for (const run of runnable) {
    const nextAttempt = (run.attempt_count || 0) + 1
    const { data: claimedRun, error: claimError } = await locals.supabaseAdmin
      .from('phwb_notification_runs')
      .update({
        status: 'sending',
        attempt_count: nextAttempt,
        updated_at: new Date().toISOString(),
        last_error: null
      })
      .eq('id', run.id)
      .in('status', ['pending', 'scheduled'])
      .select('*')
      .maybeSingle()

    if (claimError) {
      results.push({ run_id: run.id, ok: false, message: `Claim failed: ${claimError.message}` })
      continue
    }
    if (!claimedRun) {
      // Another dispatcher already claimed this run.
      continue
    }
    claimedCount += 1

    const outboundPayload = {
      contract_version: 'v1',
      run_id: claimedRun.id,
      dedupe_key: claimedRun.dedupe_key,
      notification_type: claimedRun.notification_type,
      recipient: {
        email: claimedRun.recipient_email,
        name: claimedRun.recipient_name
      },
      context: {
        artist_id: claimedRun.artist_id,
        event_id: claimedRun.event_id
      },
      content: {
        subject: claimedRun.rendered_subject,
        html: claimedRun.rendered_body
      },
      schedule: {
        scheduled_for: claimedRun.scheduled_for,
        max_attempts: claimedRun.max_attempts
      }
    }

    const outboundRawBody = JSON.stringify(outboundPayload)
    const enqueuePath = '/api/notifications/enqueue'

    try {
      const response = await fetch(`${voiceaiBaseUrl}${enqueuePath}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getOutboundIntegrationAuthHeaders(enqueuePath, 'POST', outboundRawBody)
        },
        body: outboundRawBody
      })

      const responsePayload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responsePayload?.error || `voiceai enqueue failed with status ${response.status}`)
      }

      await locals.supabaseAdmin.from('phwb_notification_attempts').insert([
        {
          run_id: claimedRun.id,
          attempt_no: nextAttempt,
          provider: 'voiceai',
          status: 'queued',
          provider_message_id: responsePayload?.external_workflow_id || null,
          request_payload: outboundPayload,
          response_payload: responsePayload
        }
      ])

      await locals.supabaseAdmin
        .from('phwb_notification_runs')
        .update({
          status: 'scheduled',
          external_workflow_id: responsePayload?.external_workflow_id || claimedRun.external_workflow_id,
          updated_at: new Date().toISOString(),
          last_error: null
        })
        .eq('id', claimedRun.id)

      results.push({ run_id: claimedRun.id, ok: true })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown dispatch error'
      const canRetry = nextAttempt < (claimedRun.max_attempts || 3)
      const nextAttemptAt = new Date(Date.now() + 15 * 60_000).toISOString()

      await locals.supabaseAdmin.from('phwb_notification_attempts').insert([
        {
          run_id: claimedRun.id,
          attempt_no: nextAttempt,
          provider: 'voiceai',
          status: 'failed',
          request_payload: outboundPayload,
          response_payload: {},
          error_message: errorMessage
        }
      ])

      await locals.supabaseAdmin
        .from('phwb_notification_runs')
        .update({
          status: canRetry ? 'scheduled' : 'failed',
          next_attempt_at: canRetry ? nextAttemptAt : null,
          updated_at: new Date().toISOString(),
          last_error: errorMessage
        })
        .eq('id', claimedRun.id)

      results.push({ run_id: claimedRun.id, ok: false, message: errorMessage })
    }
  }

  return json({
    processed: claimedCount,
    results
  })
}
