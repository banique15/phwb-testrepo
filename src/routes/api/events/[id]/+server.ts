import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ request, params, locals }) => {
	try {
		if (!locals.session) {
			return json({ error: 'Unauthorized' }, { status: 401 })
		}

		const eventId = parseInt(params.id, 10)
		if (Number.isNaN(eventId)) {
			return json({ error: 'Invalid event ID' }, { status: 400 })
		}

		const updates = await request.json()
		if (!updates || typeof updates !== 'object') {
			return json({ error: 'Invalid update payload' }, { status: 400 })
		}

		// Prefer admin client to bypass RLS for server-side trusted update.
		const supabase = locals.supabaseAdmin || locals.supabase
		if (!supabase) {
			return json({ error: 'Database connection not available' }, { status: 500 })
		}

		const { data, error } = await supabase
			.from('phwb_events')
			.update(updates)
			.eq('id', eventId)
			.select()
			.maybeSingle()

		if (error) {
			return json({ error: `Failed to update event: ${error.message}` }, { status: 500 })
		}
		if (!data) {
			return json({ error: `Event ${eventId} not found or no rows updated` }, { status: 404 })
		}

		return json(data)
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error'
		return json({ error: `Internal server error: ${message}` }, { status: 500 })
	}
}

