import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { z } from 'zod'

// Simplified event creation schema
const createEventSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
	venue_id: z.number(),
	title: z.string().optional(),
	program_id: z.number().optional(),
	status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled']).default('scheduled').optional()
})

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Check authentication
		if (!locals.session) {
			return json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		
		// Validate input
		const validationResult = createEventSchema.safeParse(body)
		if (!validationResult.success) {
			return json({ 
				error: 'Invalid input', 
				details: validationResult.error.errors 
			}, { status: 400 })
		}

		const eventData = validationResult.data

		// Generate a default title if not provided
		if (!eventData.title) {
			// Fetch venue name for default title
			const { data: venue } = await locals.supabase
				.from('phwb_venues')
				.select('name')
				.eq('id', eventData.venue_id)
				.single()
			
			eventData.title = venue ? `Event at ${venue.name}` : 'Untitled Event'
		}

		// Create the event
		const { data: event, error } = await locals.supabase
			.from('phwb_events')
			.insert([{
				...eventData,
				created_by: locals.session.user.id
			}])
			.select()
			.single()

		if (error) {
			console.error('Error creating event:', error)
			return json({ error: 'Failed to create event' }, { status: 500 })
		}

		return json({ data: event }, { status: 201 })
	} catch (error) {
		console.error('Unexpected error:', error)
		return json({ error: 'Internal server error' }, { status: 500 })
	}
}