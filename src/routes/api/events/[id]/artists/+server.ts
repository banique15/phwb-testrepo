import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { supabase } from '$lib/supabase'
import { z } from 'zod'
import { queueInvitationNotificationsForEvent } from '$lib/services/notification-producer'

// Schema for associating artists with an event
const associateArtistsSchema = z.object({
	assignments: z.array(z.object({
		artist_id: z.string().uuid('Invalid artist ID'),
		artist_name: z.string().optional(),
		role: z.string().optional(),
		status: z.string().optional(),
		num_hours: z.number().optional(),
		hourly_rate: z.number().optional()
	})).min(1, 'At least one artist must be selected')
})

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		// Check authentication
		if (!locals.session) {
			return json({ error: 'Unauthorized' }, { status: 401 })
		}

		const eventId = params.id
		const body = await request.json()
		
		// Validate input
		const validationResult = associateArtistsSchema.safeParse(body)
		if (!validationResult.success) {
			return json({ 
				error: 'Invalid input', 
				details: validationResult.error.errors 
			}, { status: 400 })
		}

		const { assignments } = validationResult.data

		// Verify event exists
		const { data: event, error: eventError } = await supabase
			.from('phwb_events')
			.select('id, artists')
			.eq('id', eventId)
			.single()

		if (eventError || !event) {
			return json({ error: 'Event not found' }, { status: 404 })
		}

		// Update the event with the artist assignments
		const artistsData = {
			assignments
		}

		const { data: updatedEvent, error: updateError } = await supabase
			.from('phwb_events')
			.update({ artists: artistsData })
			.eq('id', eventId)
			.select()
			.single()

		if (updateError) {
			console.error('Error associating artists:', updateError)
			return json({ error: 'Failed to associate artists with event' }, { status: 500 })
		}

		try {
			await queueInvitationNotificationsForEvent(updatedEvent, event.artists, artistsData)
		} catch (notificationError) {
			console.error('Failed queuing invitation notifications:', notificationError)
		}

		return json({ 
			data: {
				event_id: eventId,
				assignments,
				message: 'Artists successfully associated with event'
			}
		}, { status: 200 })
	} catch (error) {
		console.error('Unexpected error:', error)
		return json({ error: 'Internal server error' }, { status: 500 })
	}
}

// GET endpoint to retrieve artists for an event
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		// Check authentication
		if (!locals.session) {
			return json({ error: 'Unauthorized' }, { status: 401 })
		}

		const eventId = params.id

		// Get event with artist associations
		const { data: event, error } = await supabase
			.from('phwb_events')
			.select('id, artists')
			.eq('id', eventId)
			.single()

		if (error || !event) {
			return json({ error: 'Event not found' }, { status: 404 })
		}

		// Return the artist assignments from the event
		const assignments = event.artists?.assignments || []

		// If we have assignments, enrich them with additional artist data
		if (assignments.length > 0) {
			const artistIds = assignments.map((a: any) => a.artist_id)
			const { data: artists, error: artistError } = await supabase
				.from('phwb_artists')
				.select('id, full_name, legal_first_name, legal_last_name, email')
				.in('id', artistIds)

			if (!artistError && artists) {
				// Merge artist details into assignments
				const enrichedAssignments = assignments.map((assignment: any) => {
					const artist = artists.find(a => a.id === assignment.artist_id)
					return {
						...assignment,
						artist_details: artist
					}
				})

				return json({ 
					data: {
						event_id: eventId,
						assignments: enrichedAssignments
					}
				}, { status: 200 })
			}
		}

		return json({ 
			data: {
				event_id: eventId,
				assignments
			}
		}, { status: 200 })
	} catch (error) {
		console.error('Unexpected error:', error)
		return json({ error: 'Internal server error' }, { status: 500 })
	}
}