import { supabase } from '$lib/supabase'
import { logger } from '$lib/utils/logger'

type NotificationType =
  | 'artist_added_to_system'
  | 'artist_added_to_event_invited'
  | 'artist_booking_confirmation'
  | 'artist_thank_you_after_completed'
  | 'artist_feedback_request'
  | 'artist_payout_processed'

type EventLike = {
  id?: number | string | null
  title?: string | null
  date?: string | null
  start_time?: string | null
  location_id?: number | null
}

type ArtistAssignment = {
  artist_id?: string
  artist_name?: string
  status?: string
}

type NotificationSeed = {
  notificationType: NotificationType
  recipientEmail: string
  recipientName?: string | null
  artistId?: string | null
  eventId?: number | null
  payload?: Record<string, unknown>
  dedupeKey: string
}

function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_match, key) => {
    const value = values[key]
    return value == null ? '' : String(value)
  })
}

function normalizeEventId(eventId?: string | number | null): number | null {
  if (eventId == null) return null
  const parsed = typeof eventId === 'string' ? Number.parseInt(eventId, 10) : eventId
  return Number.isNaN(parsed) ? null : parsed
}

function extractAssignments(artistsField: unknown): ArtistAssignment[] {
  if (!artistsField) return []

  if (Array.isArray(artistsField)) {
    return artistsField.reduce<ArtistAssignment[]>((acc, artistId) => {
      if (typeof artistId === 'string') {
        acc.push({
          artist_id: artistId,
          status: 'pending'
        })
      }
      return acc
    }, [])
  }

  if (
    typeof artistsField === 'object' &&
    artistsField !== null &&
    'assignments' in artistsField &&
    Array.isArray((artistsField as { assignments?: unknown }).assignments)
  ) {
    return (artistsField as { assignments: ArtistAssignment[] }).assignments
  }

  return []
}

function normalizeAssignmentStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : ''
}

function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

async function getLocationName(locationId?: number | null): Promise<string> {
  if (!locationId) return ''

  const { data } = await supabase
    .from('phwb_locations')
    .select('name')
    .eq('id', locationId)
    .maybeSingle()

  return data?.name || ''
}

async function getTemplateAndPolicy(notificationType: NotificationType) {
  const [{ data: template }, { data: policy }] = await Promise.all([
    supabase
      .from('phwb_notification_templates')
      .select('*')
      .eq('notification_type', notificationType)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('phwb_notification_policies')
      .select('*')
      .eq('notification_type', notificationType)
      .maybeSingle()
  ])

  return { template, policy }
}

async function insertRun(seed: NotificationSeed) {
  const { template, policy } = await getTemplateAndPolicy(seed.notificationType)
  if (!template) {
    logger.warn(`Notification template missing or inactive for type ${seed.notificationType}`)
    return
  }
  if (policy && policy.enabled === false) {
    return
  }

  const initialDelayMinutes = policy?.initial_delay_minutes ?? 0
  const scheduledFor = new Date(Date.now() + initialDelayMinutes * 60_000).toISOString()

  const interpolationPayload = {
    ...(seed.payload || {}),
    artist_name: seed.recipientName || ''
  }
  const renderedSubject = interpolate(template.subject_template || '', interpolationPayload)
  const renderedBody = interpolate(template.body_template || '', interpolationPayload)

  const row = {
    template_id: template.id,
    policy_id: policy?.id ?? null,
    notification_type: seed.notificationType,
    artist_id: seed.artistId ?? null,
    event_id: seed.eventId ?? null,
    recipient_email: seed.recipientEmail,
    recipient_name: seed.recipientName ?? null,
    status: 'pending',
    scheduled_for: scheduledFor,
    max_attempts: policy?.max_attempts ?? 3,
    dedupe_key: seed.dedupeKey,
    rendered_subject: renderedSubject,
    rendered_body: renderedBody,
    payload: seed.payload ?? {}
  }

  const { error } = await supabase.from('phwb_notification_runs').insert([row])
  if (error) {
    // dedupe collisions are expected; ignore them as idempotent behavior.
    if (error.code === '23505') return
    logger.error('Failed to create notification run', error)
  }
}

export async function queueArtistAddedNotification(artist: {
  id?: string | null
  full_name?: string | null
  email?: string | null
}) {
  if (!artist.id || !artist.email) return
  await insertRun({
    notificationType: 'artist_added_to_system',
    recipientEmail: artist.email,
    recipientName: artist.full_name ?? null,
    artistId: artist.id,
    dedupeKey: `artist_added_to_system:${artist.id}`,
    payload: {
      artist_name: artist.full_name ?? '',
      artist_email: artist.email
    }
  })
}

export async function queueInvitationNotificationsForEvent(
  event: EventLike,
  previousArtistsField: unknown,
  nextArtistsField: unknown
) {
  const eventId = normalizeEventId(event.id)
  if (!eventId) return

  const previousAssignments = extractAssignments(previousArtistsField)
  const nextAssignments = extractAssignments(nextArtistsField)
  if (nextAssignments.length === 0) return

  const previousArtistIds = new Set(
    previousAssignments.map((assignment) => assignment.artist_id).filter(Boolean) as string[]
  )

  const newAssignments = nextAssignments.filter(
    (assignment) =>
      !!assignment.artist_id &&
      !previousArtistIds.has(assignment.artist_id) &&
      assignment.status !== 'declined'
  )

  if (newAssignments.length === 0) return

  const locationName = await getLocationName(event.location_id ?? null)
  const artistIds = newAssignments
    .map((assignment) => assignment.artist_id)
    .filter((artistId): artistId is string => !!artistId)

  const { data: artists } = await supabase
    .from('phwb_artists')
    .select('id, full_name, email')
    .in('id', artistIds)

  const artistLookup = new Map((artists || []).map((artist) => [artist.id, artist]))
  const appBaseUrl = getAppBaseUrl()

  await Promise.all(
    newAssignments.map(async (assignment) => {
      const artist = assignment.artist_id ? artistLookup.get(assignment.artist_id) : null
      if (!artist?.email) return

      await insertRun({
        notificationType: 'artist_added_to_event_invited',
        recipientEmail: artist.email,
        recipientName: artist.full_name ?? assignment.artist_name ?? null,
        artistId: artist.id,
        eventId,
        dedupeKey: `artist_added_to_event_invited:${eventId}:${artist.id}`,
        payload: {
          artist_name: artist.full_name ?? assignment.artist_name ?? '',
          artist_email: artist.email,
          event_title: event.title ?? '',
          event_date: event.date ?? '',
          event_start_time: event.start_time ?? '',
          facility_name: locationName,
          accept_link: appBaseUrl
            ? `${appBaseUrl}/api/notifications/respond?action=accept&event_id=${eventId}&artist_id=${artist.id}`
            : '',
          decline_link: appBaseUrl
            ? `${appBaseUrl}/api/notifications/respond?action=decline&event_id=${eventId}&artist_id=${artist.id}`
            : ''
        }
      })
    })
  )
}

export async function queueBookingConfirmationNotificationsForEvent(
  event: EventLike,
  previousArtistsField: unknown,
  nextArtistsField: unknown
) {
  const eventId = normalizeEventId(event.id)
  if (!eventId) return

  const previousAssignments = extractAssignments(previousArtistsField)
  const nextAssignments = extractAssignments(nextArtistsField)
  if (nextAssignments.length === 0) return

  const previousStatusByArtist = new Map(
    previousAssignments
      .filter((assignment) => !!assignment.artist_id)
      .map((assignment) => [assignment.artist_id as string, normalizeAssignmentStatus(assignment.status)])
  )

  const newlyConfirmedArtistIds = nextAssignments
    .filter((assignment) => {
      if (!assignment.artist_id) return false
      const nextStatus = normalizeAssignmentStatus(assignment.status)
      const previousStatus = previousStatusByArtist.get(assignment.artist_id) || ''
      return nextStatus === 'confirmed' && previousStatus !== 'confirmed'
    })
    .map((assignment) => assignment.artist_id as string)

  if (newlyConfirmedArtistIds.length === 0) return

  const locationName = await getLocationName(event.location_id ?? null)
  const { data: artists } = await supabase
    .from('phwb_artists')
    .select('id, full_name, email')
    .in('id', newlyConfirmedArtistIds)

  await Promise.all(
    (artists || []).map(async (artist) => {
      if (!artist.email) return
      await insertRun({
        notificationType: 'artist_booking_confirmation',
        recipientEmail: artist.email,
        recipientName: artist.full_name ?? null,
        artistId: artist.id,
        eventId,
        dedupeKey: `artist_booking_confirmation:${eventId}:${artist.id}`,
        payload: {
          artist_name: artist.full_name ?? '',
          artist_email: artist.email,
          event_title: event.title ?? '',
          event_date: event.date ?? '',
          event_start_time: event.start_time ?? '',
          facility_name: locationName,
          compensation_amount: '',
          arrival_instructions: '',
          event_contact_name: '',
          event_contact_phone: ''
        }
      })
    })
  )
}

export async function queueEventCompletedNotifications(event: EventLike, artistsField: unknown) {
  const eventId = normalizeEventId(event.id)
  if (!eventId) return

  const assignments = extractAssignments(artistsField)
  const artistIds = assignments
    .map((assignment) => assignment.artist_id)
    .filter((artistId): artistId is string => !!artistId)
  if (artistIds.length === 0) return

  const { data: artists } = await supabase
    .from('phwb_artists')
    .select('id, full_name, email')
    .in('id', artistIds)

  const locationName = await getLocationName(event.location_id ?? null)
  await Promise.all(
    (artists || []).map(async (artist) => {
      if (!artist.email) return
      const basePayload = {
        artist_name: artist.full_name ?? '',
        artist_email: artist.email,
        event_title: event.title ?? '',
        event_date: event.date ?? '',
        event_start_time: event.start_time ?? '',
        facility_name: locationName
      }
      await insertRun({
        notificationType: 'artist_thank_you_after_completed',
        recipientEmail: artist.email,
        recipientName: artist.full_name ?? null,
        artistId: artist.id,
        eventId,
        dedupeKey: `artist_thank_you_after_completed:${eventId}:${artist.id}`,
        payload: basePayload
      })
      await insertRun({
        notificationType: 'artist_feedback_request',
        recipientEmail: artist.email,
        recipientName: artist.full_name ?? null,
        artistId: artist.id,
        eventId,
        dedupeKey: `artist_feedback_request:${eventId}:${artist.id}`,
        payload: {
          ...basePayload,
          feedback_form_link: ''
        }
      })
    })
  )
}

type PayrollLike = {
  id?: number
  artist_id?: string | null
  total_pay?: number | null
  event_id?: number | null
  source_event_id?: number | null
  event_date?: string | null
}

export async function queuePayoutProcessedNotifications(
  payrollEntries: PayrollLike[],
  payoutDateIso?: string
) {
  if (!payrollEntries.length) return

  const grouped = payrollEntries.filter((entry) => entry.artist_id)
  if (!grouped.length) return

  const artistIds = Array.from(
    new Set(grouped.map((entry) => entry.artist_id).filter((id): id is string => !!id))
  )
  const eventIds = Array.from(
    new Set(
      grouped
        .map((entry) => entry.event_id ?? entry.source_event_id)
        .filter((id): id is number => typeof id === 'number')
    )
  )

  const [{ data: artists }, { data: events }] = await Promise.all([
    supabase.from('phwb_artists').select('id, full_name, email').in('id', artistIds),
    eventIds.length
      ? supabase.from('phwb_events').select('id, title, date').in('id', eventIds)
      : Promise.resolve({ data: [] as { id: number; title?: string | null; date?: string | null }[] })
  ])

  const artistMap = new Map((artists || []).map((artist) => [artist.id, artist]))
  const eventMap = new Map((events || []).map((event) => [event.id, event]))

  await Promise.all(
    grouped.map(async (entry) => {
      if (!entry.artist_id) return
      const artist = artistMap.get(entry.artist_id)
      if (!artist?.email) return

      const resolvedEventId = entry.event_id ?? entry.source_event_id ?? null
      const event = resolvedEventId ? eventMap.get(resolvedEventId) : null
      const compensation = Number(entry.total_pay || 0).toFixed(2)
      const payoutDate = payoutDateIso ? payoutDateIso.slice(0, 10) : new Date().toISOString().slice(0, 10)

      await insertRun({
        notificationType: 'artist_payout_processed',
        recipientEmail: artist.email,
        recipientName: artist.full_name ?? null,
        artistId: artist.id,
        eventId: resolvedEventId ?? null,
        dedupeKey: `artist_payout_processed:${entry.id}`,
        payload: {
          artist_name: artist.full_name ?? '',
          artist_email: artist.email,
          event_title: event?.title ?? '',
          event_date: event?.date ?? entry.event_date ?? '',
          compensation_amount: `$${compensation}`,
          payout_date: payoutDate
        }
      })
    })
  )
}
