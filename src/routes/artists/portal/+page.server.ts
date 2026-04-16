import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Artist } from '$lib/schemas/artist'
import type { Payroll } from '$lib/schemas/payroll'

export const load: PageServerLoad = async ({ locals, url }) => {
	// Require authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	const supabase = locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	// The portal can be pre-loaded for a specific artist by query param
	// e.g. /artists/portal?artist_id=<uuid>
	const artistId = url.searchParams.get('artist_id')

	try {
		// Fetch all artists (for the selector dropdown)
		const { data: artists, error: artistsError } = await supabase
			.from('phwb_artists')
			.select('id, full_name, legal_first_name, legal_last_name, artist_name, email, profile_photo')
			.order('full_name', { ascending: true })

		if (artistsError) throw artistsError

		// If a specific artist is requested, fetch their full profile
		let selectedArtist: Artist | null = null
		if (artistId) {
			const { data, error: artistError } = await supabase
				.from('phwb_artists')
				.select('*')
				.eq('id', artistId)
				.single()

			if (!artistError && data) {
				selectedArtist = data as Artist
			}
		}

		// Fetch payroll records for the selected artist (if any)
		let payrollRecords: Payroll[] = []
		if (artistId) {
			const { data: payroll, error: payrollError } = await supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, email),
					venues:venue_id(id, name),
					programs:program_id(id, title, program_type)
				`)
				.eq('artist_id', artistId)
				.order('event_date', { ascending: false })
				.limit(100)

			if (!payrollError && payroll) {
				payrollRecords = payroll as Payroll[]
			}
		}

		// Fetch events for the selected artist (if any)
		let artistEvents: any[] = []
		if (artistId) {
			const { data: events, error: eventsError } = await supabase
				.from('phwb_events')
				.select(`
					id,
					title,
					date,
					start_time,
					end_time,
					status,
					event_type,
					total_hours_of_service,
					total_fee,
					location_id,
					program,
					artists,
					notes
				`)
				.contains('artists', JSON.stringify([artistId]))
				.order('date', { ascending: false })
				.limit(200)

			if (!eventsError && events) {
				// Enhance events with location/program names
				const locationIds = [...new Set(events.map((e: any) => e.location_id).filter(Boolean))]
				const programIds = [...new Set(events.map((e: any) => e.program).filter(Boolean))]

				let locationsMap: Map<number, string> = new Map()
				let programsMap: Map<number, string> = new Map()

				if (locationIds.length > 0) {
					const { data: locations } = await supabase
						.from('phwb_locations')
						.select('id, name')
						.in('id', locationIds)
					;(locations || []).forEach((l: any) => locationsMap.set(l.id, l.name))
				}

				if (programIds.length > 0) {
					const { data: programs } = await supabase
						.from('phwb_programs')
						.select('id, title')
						.in('id', programIds)
					;(programs || []).forEach((p: any) => programsMap.set(p.id, p.title))
				}

				artistEvents = events.map((event: any) => ({
					...event,
					location_name: event.location_id ? locationsMap.get(event.location_id) || null : null,
					program_name: event.program ? programsMap.get(event.program) || null : null
				}))
			}
		}

		return {
			artists: artists || [],
			selectedArtist,
			artistId,
			payrollRecords,
			artistEvents
		}
	} catch (err) {
		console.error('Artist portal load error:', err)
		throw error(500, 'Failed to load artist portal: ' + (err instanceof Error ? err.message : 'Unknown error'))
	}
}

export type ArtistPortalPageData = {
	artists: Pick<Artist, 'id' | 'full_name' | 'legal_first_name' | 'legal_last_name' | 'artist_name' | 'email' | 'profile_photo'>[]
	selectedArtist: Artist | null
	artistId: string | null
	payrollRecords: Payroll[]
	artistEvents: any[]
}
