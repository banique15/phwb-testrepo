import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { z } from 'zod'
import { verifyIntegrationAuth } from '$lib/server/integration-auth'
import { isReminderNotificationType } from '$lib/notifications/dispatch-classification'
import { areNotificationsGloballyEnabled } from '$lib/notifications/system-toggle'
import { sendWithResend } from '$lib/server/notifications/resend-provider'

const dispatchRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(25)
  })
  .partial()

async function runDispatch(locals: App.Locals, limit: number) {
  const notificationsEnabled = await areNotificationsGloballyEnabled(locals.supabaseAdmin as any)
  if (!notificationsEnabled) {
    return json({
      processed: 0,
      skipped: true,
      reason: 'Global notifications are disabled'
    })
  }

  const nowIso = new Date().toISOString()
  const { data: candidates, error: fetchError } = await locals.supabaseAdmin
    .from('phwb_notification_runs')
    .select('*')
    .in('status', ['pending', 'scheduled'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (fetchError) {
    return json({ error: fetchError.message }, { status: 500 })
  }

  const nowMs = new Date(nowIso).getTime()
  const runnable = (candidates || []).filter((row) => {
    if (row.status === 'pending') {
      // Cron dispatch is only for reminder-like scheduled work.
      if (!isReminderNotificationType(row.notification_type || '')) return false
      const scheduledFor = row.scheduled_for
      if (!scheduledFor) return true
      return new Date(scheduledFor).getTime() <= nowMs
    }

    if (row.status === 'scheduled') {
      const nextAttemptAtMs = row.next_attempt_at ? new Date(row.next_attempt_at).getTime() : null
      const scheduledForMs = row.scheduled_for ? new Date(row.scheduled_for).getTime() : null
      // Retry workload can include any notification type.
      if (nextAttemptAtMs !== null) return nextAttemptAtMs <= nowMs
      // Scheduled non-retry workload should stay reminder-only.
      if (!isReminderNotificationType(row.notification_type || '')) return false
      if (scheduledForMs !== null) return scheduledForMs <= nowMs
      return true
    }

    return false
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
      run_id: claimedRun.id,
      dedupe_key: claimedRun.dedupe_key,
      notification_type: claimedRun.notification_type,
      recipient_email: claimedRun.recipient_email,
      recipient_name: claimedRun.recipient_name,
      subject: claimedRun.rendered_subject,
      html: claimedRun.rendered_body,
      scheduled_for: claimedRun.scheduled_for
    }

    try {
      const sendResult = await sendWithResend({
        to: claimedRun.recipient_email,
        subject: claimedRun.rendered_subject || '',
        html: claimedRun.rendered_body || '',
        tags: {
          run_id: claimedRun.id,
          notification_type: claimedRun.notification_type
        }
      })
      if (!sendResult.ok) {
        throw new Error(sendResult.errorMessage || 'Failed to send with Resend')
      }

      await locals.supabaseAdmin.from('phwb_notification_attempts').insert([
        {
          run_id: claimedRun.id,
          attempt_no: nextAttempt,
          provider: 'resend',
          status: 'sent',
          provider_message_id: sendResult.messageId || null,
          request_payload: outboundPayload,
          response_payload: sendResult.responsePayload || {}
        }
      ])

      await locals.supabaseAdmin
        .from('phwb_notification_runs')
        .update({
          status: 'sent',
          sent_at: nowIso,
          next_attempt_at: null,
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
          provider: 'resend',
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

function parseLimitFromBody(rawBody: string) {
  let parsedBody: Record<string, unknown> = {}
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return { ok: false as const, error: json({ error: 'Invalid JSON payload' }, { status: 400 }) }
  }

  const parsed = dispatchRequestSchema.safeParse(parsedBody)
  if (!parsed.success) {
    return { ok: false as const, error: json({ error: parsed.error.flatten() }, { status: 400 }) }
  }
  return { ok: true as const, limit: parsed.data.limit ?? 25 }
}

function parseLimitFromQuery(url: URL) {
  const rawLimit = url.searchParams.get('limit')
  const limitValue = rawLimit ? Number(rawLimit) : undefined
  const parsed = dispatchRequestSchema.safeParse({ limit: limitValue })
  if (!parsed.success) {
    return { ok: false as const, error: json({ error: parsed.error.flatten() }, { status: 400 }) }
  }
  return { ok: true as const, limit: parsed.data.limit ?? 25 }
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
  const rawBody = await request.text()
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

  const parsedLimit = parseLimitFromBody(rawBody)
  if (!parsedLimit.ok) return parsedLimit.error
  return runDispatch(locals, parsedLimit.limit)
}

export const GET: RequestHandler = async ({ request, locals, url }) => {
  const authResult = verifyIntegrationAuth({
    method: request.method,
    path: url.pathname,
    rawBody: '',
    headers: request.headers
  })
  const hasSession = !!locals.session
  if (!hasSession && !authResult.ok) {
    return json({ error: authResult.reason || 'Unauthorized' }, { status: 401 })
  }

  const parsedLimit = parseLimitFromQuery(url)
  if (!parsedLimit.ok) return parsedLimit.error
  return runDispatch(locals, parsedLimit.limit)
}
