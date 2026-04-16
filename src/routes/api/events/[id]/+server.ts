import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { updateEventSchema } from '$lib/schemas/event'

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
		if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
			return json({ error: 'Invalid update payload' }, { status: 400 })
		}

		// Reject unknown fields: use strict schema so unrecognised keys return 400.
		const validation = updateEventSchema.strict().safeParse(updates)
		if (!validation.success) {
			const unknownKeyIssue = validation.error.issues.find(
				(issue) => issue.code === 'unrecognized_keys'
			)
			if (unknownKeyIssue && 'keys' in unknownKeyIssue) {
				const unknownKeys = (unknownKeyIssue as { keys: string[] }).keys
				return json(
					{
						error: `Unknown field(s) in update payload: ${unknownKeys.join(', ')}`,
						invalid_fields: unknownKeys
					},
					{ status: 400 }
				)
			}
			// Other validation errors (type mismatches, format errors, etc.)
			return json(
				{
					error: 'Invalid update payload',
					details: validation.error.issues.map((issue) => ({
						field: issue.path.join('.'),
						message: issue.message
					}))
				},
				{ status: 400 }
			)
		}

		// Prefer admin client to bypass RLS for server-side trusted update.
		const supabase = locals.supabaseAdmin || locals.supabase
		if (!supabase) {
			return json({ error: 'Database connection not available' }, { status: 500 })
		}

		const { data, error } = await supabase
			.from('phwb_events')
			.update(validation.data)
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
