import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import type { Event } from '$lib/schemas/event'
import { buildEventFilters, parseFiltersFromURL, filterByArtist, filterByEnsemble, filterByPartner, type EventFilters } from '$lib/utils/filters'

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	const startTime = performance.now()

	// Check authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	// Get Supabase instance from locals (server-side client)
	const supabase = locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	// Parse URL parameters for filtering and pagination
	const searchParams = url.searchParams
	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
	const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
	const sortBy = searchParams.get('sortBy') || 'date'
	const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

	// Parse all filter parameters using the unified filter utility
	const filters: EventFilters = {
		search: searchParams.get('search') || undefined,
		status: searchParams.get('status') || undefined,
		venue: searchParams.get('venue') ? parseInt(searchParams.get('venue')!) : undefined,
		location_id: searchParams.get('location_id') ? parseInt(searchParams.get('location_id')!) : undefined,
		facility_id: searchParams.get('facility_id') ? parseInt(searchParams.get('facility_id')!) : undefined,
		program: searchParams.get('program') ? parseInt(searchParams.get('program')!) : undefined,
		partner: searchParams.get('partner') ? parseInt(searchParams.get('partner')!) : undefined,
		artist_id: searchParams.get('artist_id') || undefined,
		ensemble_id: searchParams.get('ensemble_id') || undefined,
		event_type: searchParams.get('event_type') || undefined,
		confirmation_status: searchParams.get('confirmation_status') || undefined,
		dateFilter: searchParams.get('dateFilter') as any || undefined,
		dateFrom: searchParams.get('dateFrom') || undefined,
		dateTo: searchParams.get('dateTo') || undefined,
		musician_count_min: searchParams.get('musician_count_min') ? parseInt(searchParams.get('musician_count_min')!) : undefined,
		musician_count_max: searchParams.get('musician_count_max') ? parseInt(searchParams.get('musician_count_max')!) : undefined,
	}

	// Check if a specific event ID is requested (from dashboard calendar, etc.)
	const requestedEventId = searchParams.get('id') ? parseInt(searchParams.get('id')!) : null

	try {
		// Start timing individual operations
		const fetchStartTime = performance.now()

		// Build query with filters using unified filter utility
		let query = supabase
			.from('phwb_events')
			.select('*', { count: 'exact' })

		// Apply all server-side filters
		query = buildEventFilters(query, filters)

		// Add sorting
		query = query.order(sortBy, { ascending: sortOrder === 'asc' })

		// Add pagination
		const from = (page - 1) * limit
		const to = from + limit - 1
		query = query.range(from, to)

		const { data: events, error: fetchError, count } = await query

		if (fetchError) {
			console.error('Events fetch error:', fetchError)
			throw error(500, `Failed to fetch events: ${fetchError.message}`)
		}

		// If a specific event was requested and it's not in the results, fetch it separately
		let requestedEvent: Event | null = null
		if (requestedEventId && events && !events.find((e: Event) => e.id === requestedEventId)) {
			const { data: singleEvent } = await supabase
				.from('phwb_events')
				.select('*')
				.eq('id', requestedEventId)
				.single()

			if (singleEvent) {
				requestedEvent = singleEvent
			}
		}

		const fetchTime = performance.now() - fetchStartTime

		// Fetch lookup data for enhancements (venues and programs)
		const lookupsStartTime = performance.now()

		// Get lookup data for filtering and enhancement
		const { data: venues } = await supabase
			.from('phwb_venues')
			.select('id, name')
			.order('name')

		const { data: programs } = await supabase
			.from('phwb_programs')
			.select('id, title, partner')
			.order('title')

		const { data: partners } = await supabase
			.from('phwb_partners')
			.select('id, name')
			.order('name')

		// Get facilities and locations for the new two-level structure
		const { data: facilities } = await supabase
			.from('phwb_facilities')
			.select('id, name')
			.order('name')

		const { data: locations } = await supabase
			.from('phwb_locations')
			.select('id, name, facility_id')
			.eq('active', true)
			.order('name')

		// Get artists for enhancement
		const { data: artists } = await supabase
			.from('phwb_artists')
			.select('id, full_name, legal_first_name, public_first_name')

		// Get ensembles for filtering
		const { data: ensembles } = await supabase
			.from('phwb_ensembles')
			.select('id, name')
			.eq('status', 'active')
			.order('name')

		// Get unique event types for filtering
		const { data: eventTypes } = await supabase
			.from('phwb_events')
			.select('event_type')
			.not('event_type', 'is', null)
			.order('event_type')

		const lookupsTime = performance.now() - lookupsStartTime

		// Enhance events with venue, program, and partner names
		const enhancementStartTime = performance.now()
		let enhancedEvents = events?.map(event => {
			const enhanced = { ...event }

			// Add venue information (legacy)
			if (event.venue) {
				const venue = venues?.find(v => v.id === event.venue)
				enhanced.venue_name = venue?.name || 'Unknown Venue'
				enhanced.venue_object = venue
			}

			// Add location information (new two-level structure)
			if (event.location_id) {
				const location = locations?.find(l => l.id === event.location_id)
				if (location) {
					enhanced.location_name = location.name
					enhanced.location_object = location

					// Add facility information via location
					const facility = facilities?.find(f => f.id === location.facility_id)
					if (facility) {
						enhanced.facility_name = facility.name
						enhanced.facility_object = facility
					}
				}
			}

			// Add program information
			if (event.program) {
				const program = programs?.find(p => p.id === event.program)
				enhanced.program_name = program?.title || 'Unknown Program'
				enhanced.program_object = program

				// Add partner information via program
				if (program?.partner) {
					const partnerObj = partners?.find(pt => pt.id === program.partner)
					enhanced.partner_name = partnerObj?.name || 'Unknown Partner'
					enhanced.partner_object = partnerObj
					enhanced.partner_id = program.partner
				}
			}

			// Enhance artist assignments if they exist
			if (event.artists && typeof event.artists === 'object' && event.artists.assignments) {
				enhanced.artist_assignments = event.artists.assignments.map((assignment: any) => {
					// Use existing artist_name if available, otherwise look it up
					if (assignment.artist_name) {
						return assignment
					}

					const artist = artists?.find(a => a.id === assignment.artist_id)
					return {
						...assignment,
						artist_name: artist?.full_name || artist?.legal_first_name || artist?.public_first_name || 'Unknown Artist'
					}
				})
			}

			return enhanced
		}) || []

		// If we fetched a requested event separately, enhance and prepend it
		if (requestedEvent) {
			const enhancedRequestedEvent: any = { ...requestedEvent }

			// Apply the same enhancement logic
			if (requestedEvent.venue) {
				const venue = venues?.find(v => v.id === requestedEvent.venue)
				enhancedRequestedEvent.venue_name = venue?.name || 'Unknown Venue'
				enhancedRequestedEvent.venue_object = venue
			}
			if (requestedEvent.location_id) {
				const location = locations?.find(l => l.id === requestedEvent.location_id)
				if (location) {
					enhancedRequestedEvent.location_name = location.name
					enhancedRequestedEvent.location_object = location
					const facility = facilities?.find(f => f.id === location.facility_id)
					if (facility) {
						enhancedRequestedEvent.facility_name = facility.name
						enhancedRequestedEvent.facility_object = facility
					}
				}
			}
			if (requestedEvent.program) {
				const program = programs?.find(p => p.id === requestedEvent.program)
				enhancedRequestedEvent.program_name = program?.title || 'Unknown Program'
				enhancedRequestedEvent.program_object = program
				if (program?.partner) {
					const partnerObj = partners?.find(pt => pt.id === program.partner)
					enhancedRequestedEvent.partner_name = partnerObj?.name || 'Unknown Partner'
					enhancedRequestedEvent.partner_object = partnerObj
					enhancedRequestedEvent.partner_id = program.partner
				}
			}
			if (requestedEvent.artists && typeof requestedEvent.artists === 'object' && (requestedEvent.artists as any).assignments) {
				enhancedRequestedEvent.artist_assignments = (requestedEvent.artists as any).assignments.map((assignment: any) => {
					if (assignment.artist_name) return assignment
					const artist = artists?.find(a => a.id === assignment.artist_id)
					return {
						...assignment,
						artist_name: artist?.full_name || artist?.legal_first_name || artist?.public_first_name || 'Unknown Artist'
					}
				})
			}

			// Prepend to results so it appears first
			enhancedEvents = [enhancedRequestedEvent, ...enhancedEvents]
		}

		// Apply client-side filters that require complex lookups

		// Partner filter (requires program lookup)
		if (filters.partner && filters.partner !== 0) {
			enhancedEvents = filterByPartner(enhancedEvents, filters.partner)
		}

		// Artist filter (requires checking artists array)
		if (filters.artist_id) {
			enhancedEvents = filterByArtist(enhancedEvents, filters.artist_id)
		}

		// Ensemble filter (requires getting ensemble members first)
		if (filters.ensemble_id) {
			// Fetch ensemble members
			const { data: ensembleMembers } = await supabase
				.from('phwb_ensemble_members')
				.select('artist_id')
				.eq('ensemble_id', filters.ensemble_id)
				.eq('is_active', true)

			if (ensembleMembers && ensembleMembers.length > 0) {
				const memberIds = ensembleMembers.map(m => m.artist_id)
				enhancedEvents = filterByEnsemble(enhancedEvents, memberIds)
			} else {
				enhancedEvents = [] // No members, no results
			}
		}

		// Facility filter (requires checking location's facility)
		if (filters.facility_id) {
			const { data: facilityLocations } = await supabase
				.from('phwb_locations')
				.select('id')
				.eq('facility_id', filters.facility_id)

			if (facilityLocations) {
				const locationIds = facilityLocations.map(l => l.id)
				enhancedEvents = enhancedEvents.filter(e =>
					e.location_id && locationIds.includes(e.location_id)
				)
			}
		}

		const enhancementTime = performance.now() - enhancementStartTime

		// Calculate pagination (use filtered count if client-side filters are applied)
		const hasClientSideFilters = !!(filters.partner || filters.artist_id || filters.ensemble_id || filters.facility_id)
		const total = hasClientSideFilters ? enhancedEvents.length : (count || 0)
		const totalPages = Math.ceil(total / limit)

		// Calculate statistics
		const statsStartTime = performance.now()
		const statistics = {
			total: total,
			scheduled: enhancedEvents.filter(e => e.status === 'scheduled').length,
			confirmed: enhancedEvents.filter(e => e.status === 'confirmed').length,
			completed: enhancedEvents.filter(e => e.status === 'completed').length,
			cancelled: enhancedEvents.filter(e => e.status === 'cancelled').length,
			upcoming: enhancedEvents.filter(e => e.date && new Date(e.date) > new Date()).length,
			past: enhancedEvents.filter(e => e.date && new Date(e.date) < new Date()).length
		}
		const statsTime = performance.now() - statsStartTime

		const totalTime = performance.now() - startTime

		// Set cache headers for better performance
		setHeaders({
			'cache-control': 'private, max-age=60' // Cache for 1 minute
		})

		return {
			events: enhancedEvents,
			pagination: {
				page,
				limit,
				total,
				totalPages,
				hasNext: page < totalPages,
				hasPrev: page > 1
			},
			filters,
			statistics,
			lookupData: {
				venues: venues || [],
				programs: programs || [],
				partners: partners || [],
				facilities: facilities || [],
				locations: locations || [],
				artists: artists || [],
				ensembles: ensembles || [],
				eventTypes: Array.from(new Set((eventTypes || []).map(t => t.event_type).filter(Boolean)))
			},
			performance: {
				totalTime: Math.round(totalTime),
				fetchTime: Math.round(fetchTime),
				lookupsTime: Math.round(lookupsTime),
				enhancementTime: Math.round(enhancementTime),
				statsTime: Math.round(statsTime)
			}
		}
	} catch (err) {
		console.error('Events page load error:', err)
		const errorMessage = err instanceof Error ? err.message : 'Unknown error'
		const errorDetails = err instanceof Error ? err.stack : String(err)
		console.error('Error details:', errorDetails)
		throw error(500, `Failed to load events data: ${errorMessage}`)
	}
}