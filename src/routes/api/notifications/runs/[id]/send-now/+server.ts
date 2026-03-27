import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { dispatchNotificationRunNow } from '$lib/server/notifications/run-dispatcher'

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.session) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = params.id
  if (!runId) {
    return json({ error: 'Missing run id' }, { status: 400 })
  }

  const result = await dispatchNotificationRunNow(locals.supabaseAdmin, runId)
  if (!result.ok) {
    return json({ error: result.message }, { status: result.status || 500 })
  }
  return json(result)
}

