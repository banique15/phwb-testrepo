import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.session) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = params.id
  const { data: run, error: fetchError } = await locals.supabaseAdmin
    .from('phwb_notification_runs')
    .select('id, status')
    .eq('id', runId)
    .maybeSingle()

  if (fetchError || !run) {
    return json({ error: 'Notification run not found' }, { status: 404 })
  }

  const { data, error } = await locals.supabaseAdmin
    .from('phwb_notification_runs')
    .update({
      status: 'cancelled',
      next_attempt_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', runId)
    .select('*')
    .single()

  if (error) {
    return json({ error: error.message }, { status: 500 })
  }

  return json({ ok: true, data })
}
