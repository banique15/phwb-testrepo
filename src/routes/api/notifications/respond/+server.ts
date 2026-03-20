import { queueBookingConfirmationNotificationsForEvent } from '$lib/services/notification-producer'
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

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

function htmlResult(message: string, ok = true) {
  const title = ok ? 'Response recorded' : 'Response failed'
  const color = ok ? '#339933' : '#b91c1c'
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f7f6;margin:0;padding:24px;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><div style="background:${color};color:#fff;padding:16px 20px;font-weight:700;">Sing for Hope</div><div style="padding:20px;color:#111827;line-height:1.5;">${message}</div></div></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const action = (url.searchParams.get('action') || '').toLowerCase()
  const artistId = url.searchParams.get('artist_id') || ''
  const eventIdRaw = url.searchParams.get('event_id') || ''
  const eventId = Number.parseInt(eventIdRaw, 10)

  if (!['accept', 'decline'].includes(action)) {
    return htmlResult('Invalid response action.', false)
  }
  if (!artistId || Number.isNaN(eventId)) {
    return htmlResult('Missing invitation response details.', false)
  }

  const { data: eventRow, error: eventError } = await locals.supabaseAdmin
    .from('phwb_events')
    .select('id, title, date, start_time, location_id, artists')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError || !eventRow) {
    return htmlResult('We could not find this event invitation.', false)
  }

  const previousArtists = eventRow.artists
  const artistsObject = normalizeArtistsField(previousArtists)
  const targetStatus = action === 'accept' ? 'confirmed' : 'declined'
  let foundAssignment = false

  const updatedAssignments = artistsObject.assignments.map((assignment) => {
    if (assignment.artist_id === artistId) {
      foundAssignment = true
      return {
        ...assignment,
        status: targetStatus
      }
    }
    return assignment
  })

  if (!foundAssignment) {
    return htmlResult('This artist is not assigned to the selected event.', false)
  }

  const { error: updateError } = await locals.supabaseAdmin
    .from('phwb_events')
    .update({ artists: { assignments: updatedAssignments } })
    .eq('id', eventId)

  if (updateError) {
    return htmlResult('We could not save your response. Please contact support.', false)
  }

  try {
    if (action === 'accept') {
      await queueBookingConfirmationNotificationsForEvent(
        eventRow,
        previousArtists,
        { assignments: updatedAssignments }
      )
    }
  } catch (error) {
    console.error('Failed to queue booking confirmation after invitation response:', error)
  }

  const message =
    action === 'accept'
      ? 'Thank you. Your invitation has been accepted and your booking is now confirmed.'
      : 'Your invitation has been declined. Thank you for the quick response.'

  return htmlResult(message, true)
}

export const POST: RequestHandler = async () => {
  return json({ error: 'Use GET with action query parameters.' }, { status: 405 })
}
