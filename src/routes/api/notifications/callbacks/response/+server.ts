import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { z } from 'zod'
import { verifyIntegrationAuth } from '$lib/server/integration-auth'
import { queueBookingConfirmationNotificationsForEvent } from '$lib/services/notification-producer'
import { dispatchNotificationRunNow } from '$lib/server/notifications/run-dispatcher'

const responseCallbackSchema = z.object({
  contract_version: z.string().default('v1'),
  idempotency_key: z.string().min(1),
  run_id: z.string().uuid().optional(),
  external_workflow_id: z.string().optional().nullable(),
  response: z.enum(['accepted', 'declined']),
  artist_id: z.string().uuid(),
  event_id: z.number().int().positive(),
  responded_at: z.string().optional().nullable()
})

function normalizeArtistsField(artistsField: unknown): { assignments: Array<Record<string, unknown>> } {
  if (Array.isArray(artistsField)) {
    return {
      assignments: artistsField.reduce<Array<Record<string, unknown>>>((acc, artistId) => {
        if (typeof artistId === 'string') {
          acc.push({
            artist_id: artistId,
            role: 'performer',
            status: 'pending'
          })
        }
        return acc
      }, [])
    }
  }

  if (
    typeof artistsField === 'object' &&
    artistsField !== null &&
    'assignments' in artistsField &&
    Array.isArray((artistsField as { assignments?: unknown }).assignments)
  ) {
    return artistsField as { assignments: Array<Record<string, unknown>> }
  }

  return { assignments: [] }
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

  let payload: z.infer<typeof responseCallbackSchema>
  try {
    payload = responseCallbackSchema.parse(rawBody ? JSON.parse(rawBody) : {})
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
  const processedResponseKeys = Array.isArray(currentPayload.response_callback_idempotency_keys)
    ? (currentPayload.response_callback_idempotency_keys as string[])
    : []
  if (
    currentPayload.last_response_idempotency_key === payload.idempotency_key ||
    processedResponseKeys.includes(payload.idempotency_key)
  ) {
    return json({ ok: true, duplicate: true })
  }

  const { data: eventRow, error: eventError } = await locals.supabaseAdmin
    .from('phwb_events')
    .select('id, artists')
    .eq('id', payload.event_id)
    .maybeSingle()

  if (eventError || !eventRow) {
    return json({ error: 'Event not found for response callback' }, { status: 404 })
  }

  const artistsObject = normalizeArtistsField(eventRow.artists)
  const updatedAssignments = artistsObject.assignments.map((assignment) => {
    if (assignment.artist_id === payload.artist_id) {
      return {
        ...assignment,
        status: payload.response === 'accepted' ? 'confirmed' : 'declined'
      }
    }
    return assignment
  })

  await locals.supabaseAdmin
    .from('phwb_events')
    .update({ artists: { assignments: updatedAssignments } })
    .eq('id', payload.event_id)

  try {
    if (payload.response === 'accepted') {
      const queuedRunIds = await queueBookingConfirmationNotificationsForEvent(
        {
          id: eventRow.id,
          title: run.payload?.event_title as string | undefined,
          date: run.payload?.event_date as string | undefined,
          start_time: run.payload?.event_start_time as string | undefined
        },
        eventRow.artists,
        { assignments: updatedAssignments }
      )
      await Promise.all(queuedRunIds.map((runId) => dispatchNotificationRunNow(locals.supabaseAdmin, runId)))
    }
  } catch (error) {
    console.error('Failed to queue booking confirmation after response callback:', error)
  }

  await locals.supabaseAdmin
    .from('phwb_notification_runs')
    .update({
      status: 'sent',
      updated_at: new Date().toISOString(),
      payload: {
        ...currentPayload,
        last_response: payload.response,
        responded_at: payload.responded_at || new Date().toISOString(),
        last_response_idempotency_key: payload.idempotency_key,
        response_callback_idempotency_keys: [...processedResponseKeys, payload.idempotency_key].slice(-25)
      }
    })
    .eq('id', run.id)

  return json({ ok: true })
}
