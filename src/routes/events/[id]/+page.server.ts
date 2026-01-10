import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import type { EnhancedEvent } from '$lib/stores/events'

export const load: PageServerLoad = async ({ params, locals, url }) => {
	// Check authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	// Get Supabase instance from locals (server-side client)
	const supabase = locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	// Parse event ID from route params
	const eventId = parseInt(params.id, 10)
	if (isNaN(eventId)) {
		throw error(400, 'Invalid event ID')
	}

	// Get optional tab parameter from query string
	const tab = url.searchParams.get('tab') || null
	const shouldEdit = url.searchParams.get('edit') === 'true'

	try {
		// Fetch the event
		const { data: event, error: fetchError } = await supabase
			.from('phwb_events')
			.select('*')
			.eq('id', eventId)
			.single()

		if (fetchError) {
			console.error('Event fetch error:', fetchError)
			if (fetchError.code === 'PGRST116') {
				// No rows returned
				throw error(404, 'Event not found')
			}
			throw error(500, `Failed to fetch event: ${fetchError.message}`)
		}

		if (!event) {
			throw error(404, 'Event not found')
		}

		// Fetch lookup data for enhancements
		const [venuesResult, programsResult, partnersResult, facilitiesResult, locationsResult, artistsResult] = await Promise.all([
			supabase.from('phwb_venues').select('id, name').order('name'),
			supabase.from('phwb_programs').select('id, title, partner').order('title'),
			supabase.from('phwb_partners').select('id, name').order('name'),
			supabase.from('phwb_facilities').select('id, name').order('name'),
			supabase.from('phwb_locations').select('id, name, facility_id').eq('active', true).order('name'),
			supabase.from('phwb_artists').select('id, full_name, legal_first_name, public_first_name')
		])

		const venues = venuesResult.data || []
		const programs = programsResult.data || []
		const partners = partnersResult.data || []
		const facilities = facilitiesResult.data || []
		const locations = locationsResult.data || []
		const artists = artistsResult.data || []

		// Enhance event with related data
		const enhanced: EnhancedEvent = { ...event }

		// Add venue information (legacy)
		if (event.venue) {
			const venue = venues.find(v => v.id === event.venue)
			enhanced.venue_name = venue?.name || 'Unknown Venue'
			enhanced.venue_object = venue
		}

		// Add location information (new two-level structure)
		if (event.location_id) {
			const location = locations.find(l => l.id === event.location_id)
			if (location) {
				enhanced.location_name = location.name
				enhanced.location_object = location

				// Add facility information via location
				const facility = facilities.find(f => f.id === location.facility_id)
				if (facility) {
					enhanced.facility_name = facility.name
					enhanced.facility_object = facility
				}
			}
		}

		// Add program information
		if (event.program) {
			const program = programs.find(p => p.id === event.program)
			enhanced.program_name = program?.title || 'Unknown Program'
			enhanced.program_object = program

			// Add partner information via program
			if (program?.partner) {
				const partnerObj = partners.find(pt => pt.id === program.partner)
				enhanced.partner_name = partnerObj?.name || 'Unknown Partner'
				enhanced.partner_object = partnerObj
				enhanced.partner_id = program.partner
			}
		}

		// Enhance artist assignments if they exist
		if (event.artists && typeof event.artists === 'object' && (event.artists as any).assignments) {
			enhanced.artist_assignments = (event.artists as any).assignments.map((assignment: any) => {
				// Use existing artist_name if available, otherwise look it up
				if (assignment.artist_name) {
					return assignment
				}

				const artist = artists.find(a => a.id === assignment.artist_id)
				return {
					...assignment,
					artist_name: artist?.full_name || artist?.legal_first_name || artist?.public_first_name || 'Unknown Artist'
				}
			})
		}

		return {
			event: enhanced,
			tab,
			shouldEdit,
			lookupData: {
				venues,
				programs,
				partners,
				facilities,
				locations,
				artists
			}
		}
	} catch (err) {
		console.error('Event page load error:', err)
		// Re-throw SvelteKit errors as-is
		if (err && typeof err === 'object' && 'status' in err) {
			throw err
		}
		throw error(500, 'Failed to load event data')
	}
}
