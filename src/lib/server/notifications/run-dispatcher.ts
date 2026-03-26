import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWithResend } from '$lib/server/notifications/resend-provider'
import { areNotificationsGloballyEnabled } from '$lib/notifications/system-toggle'

export async function dispatchNotificationRunNow(supabaseAdmin: SupabaseClient, runId: string) {
  const notificationsEnabled = await areNotificationsGloballyEnabled(supabaseAdmin)
  if (!notificationsEnabled) {
    return { ok: false as const, status: 409, message: 'Global notifications are disabled' }
  }

  const { data: existingRun } = await supabaseAdmin
    .from('phwb_notification_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle()

  if (!existingRun) {
    return { ok: false as const, status: 404, message: 'Notification run not found' }
  }

  const nextAttempt = (existingRun.attempt_count || 0) + 1
  const { data: claimedRun, error: claimError } = await supabaseAdmin
    .from('phwb_notification_runs')
    .update({
      status: 'sending',
      attempt_count: nextAttempt,
      updated_at: new Date().toISOString(),
      last_error: null
    })
    .eq('id', existingRun.id)
    .in('status', ['pending', 'scheduled'])
    .select('*')
    .maybeSingle()

  if (claimError) {
    return { ok: false as const, status: 500, message: `Claim failed: ${claimError.message}` }
  }
  if (!claimedRun) {
    return { ok: true as const, skipped: true, message: 'Run was already claimed or processed' }
  }

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

    await supabaseAdmin.from('phwb_notification_attempts').insert([
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

    await supabaseAdmin
      .from('phwb_notification_runs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        next_attempt_at: null,
        updated_at: new Date().toISOString(),
        last_error: null
      })
      .eq('id', claimedRun.id)

    return { ok: true as const, run_id: claimedRun.id }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown dispatch error'
    const canRetry = nextAttempt < (claimedRun.max_attempts || 3)
    const nextAttemptAt = new Date(Date.now() + 15 * 60_000).toISOString()

    await supabaseAdmin.from('phwb_notification_attempts').insert([
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

    await supabaseAdmin
      .from('phwb_notification_runs')
      .update({
        status: canRetry ? 'scheduled' : 'failed',
        next_attempt_at: canRetry ? nextAttemptAt : null,
        updated_at: new Date().toISOString(),
        last_error: errorMessage
      })
      .eq('id', claimedRun.id)

    return { ok: false as const, status: 500, message: errorMessage }
  }
}

