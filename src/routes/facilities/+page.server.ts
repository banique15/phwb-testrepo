import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import type { Facility } from '$lib/schemas/facility'
import { buildFacilityFilters, type FacilityFilters } from '$lib/utils/filters'

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
	const sortBy = searchParams.get('sortBy') || 'name'
	const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'

	// Parse all filter parameters using the unified filter utility
	const filters: FacilityFilters = {
		search: searchParams.get('search') || undefined,
		type: searchParams.get('type') || undefined,
		partner: searchParams.get('partner') ? parseInt(searchParams.get('partner')!) : undefined,
		has_locations: searchParams.get('has_locations') === 'true' ? true : searchParams.get('has_locations') === 'false' ? false : undefined,
		location_count_min: searchParams.get('location_count_min') ? parseInt(searchParams.get('location_count_min')!) : undefined,
		location_count_max: searchParams.get('location_count_max') ? parseInt(searchParams.get('location_count_max')!) : undefined,
		has_contacts: searchParams.get('has_contacts') === 'true' ? true : searchParams.get('has_contacts') === 'false' ? false : undefined,
		city: searchParams.get('city') || undefined,
		state: searchParams.get('state') || undefined,
		sortBy,
		sortOrder
	}

	const offset = (page - 1) * limit

	try {
		// Start timing individual operations
		const fetchStartTime = performance.now()

		// Build query with filters using unified filter utility
		let query = supabase
			.from('phwb_facilities')
			.select(`
				*,
				locations:phwb_locations(
					id,
					name,
					capacity,
					attributes,
					active
				)
			`, { count: 'exact' })

		// Apply all server-side filters
		query = buildFacilityFilters(query, filters)

		// Add sorting
		query = query.order(sortBy, { ascending: sortOrder === 'asc' })

		// Add pagination
		query = query.range(offset, offset + limit - 1)

		const { data: facilities, error: fetchError, count } = await query

		if (fetchError) {
			console.error('Facilities fetch error:', fetchError)
			throw error(500, `Failed to fetch facilities: ${fetchError.message}`)
		}

		const fetchTime = performance.now() - fetchStartTime

		// Fetch lookup data for enhancements
		const lookupsStartTime = performance.now()

		// Get partners for filtering and enhancement
		const { data: partners } = await supabase
			.from('phwb_partners')
			.select('id, name')
			.order('name')

		// Get unique facility types for filtering
		const { data: facilityTypes } = await supabase
			.from('phwb_facilities')
			.select('type')
			.not('type', 'is', null)
			.order('type')

		// Get unique cities and states for filtering
		const { data: cities } = await supabase
			.from('phwb_facilities')
			.select('city')
			.not('city', 'is', null)
			.order('city')

		const { data: states } = await supabase
			.from('phwb_facilities')
			.select('state')
			.not('state', 'is', null)
			.order('state')

		// Get location contacts for has_contacts filter
		const { data: locationContacts } = await supabase
			.from('phwb_location_contacts')
			.select('location_id')

		const lookupsTime = performance.now() - lookupsStartTime

		// Enhance facilities with partner names and location counts
		const enhancementStartTime = performance.now()
		let enhancedFacilities = facilities?.map(facility => {
			const enhanced = { ...facility }

			// Add partner information
			if (facility.partner) {
				const partner = partners?.find(p => p.id === facility.partner)
				enhanced.partner_name = partner?.name || 'Unknown Partner'
				enhanced.partner_object = partner
			}

			// Calculate location count
			const locationCount = Array.isArray(facility.locations) ? facility.locations.length : 0
			enhanced.location_count = locationCount

			// Calculate active location count
			const activeLocationCount = Array.isArray(facility.locations)
				? facility.locations.filter((l: any) => l.active).length
				: 0
			enhanced.active_location_count = activeLocationCount

			// Check if facility has contacts
			if (locationContacts && Array.isArray(facility.locations)) {
				const facilityLocationIds = facility.locations.map((l: any) => l.id)
				enhanced.has_contacts = locationContacts.some(lc => facilityLocationIds.includes(lc.location_id))
			} else {
				enhanced.has_contacts = false
			}

			return enhanced
		}) || []

		// Apply client-side filters that require complex calculations

		// Location count filter (requires counting locations)
		if (filters.location_count_min !== undefined) {
			enhancedFacilities = enhancedFacilities.filter(f =>
				f.location_count >= filters.location_count_min!
			)
		}

		if (filters.location_count_max !== undefined) {
			enhancedFacilities = enhancedFacilities.filter(f =>
				f.location_count <= filters.location_count_max!
			)
		}

		// Has locations filter (requires checking location array)
		if (filters.has_locations !== undefined) {
			enhancedFacilities = enhancedFacilities.filter(f =>
				filters.has_locations ? f.location_count > 0 : f.location_count === 0
			)
		}

		// Has contacts filter (requires checking location contacts)
		if (filters.has_contacts !== undefined) {
			enhancedFacilities = enhancedFacilities.filter(f =>
				f.has_contacts === filters.has_contacts
			)
		}

		const enhancementTime = performance.now() - enhancementStartTime

		// Calculate pagination (use filtered count if client-side filters are applied)
		const hasClientSideFilters = !!(
			filters.location_count_min !== undefined ||
			filters.location_count_max !== undefined ||
			filters.has_locations !== undefined ||
			filters.has_contacts !== undefined
		)
		const total = hasClientSideFilters ? enhancedFacilities.length : (count || 0)
		const totalPages = Math.ceil(total / limit)

		// Calculate statistics
		const statsStartTime = performance.now()
		const statistics = {
			total: total,
			with_locations: enhancedFacilities.filter(f => f.location_count > 0).length,
			without_locations: enhancedFacilities.filter(f => f.location_count === 0).length,
			with_contacts: enhancedFacilities.filter(f => f.has_contacts).length,
			with_partner: enhancedFacilities.filter(f => f.partner).length,
			total_locations: enhancedFacilities.reduce((sum, f) => sum + (f.location_count || 0), 0),
			total_active_locations: enhancedFacilities.reduce((sum, f) => sum + (f.active_location_count || 0), 0)
		}
		const statsTime = performance.now() - statsStartTime

		const totalTime = performance.now() - startTime

		// Set cache headers for better performance
		setHeaders({
			'cache-control': 'private, max-age=60' // Cache for 1 minute
		})

		return {
			facilities: enhancedFacilities,
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
				partners: partners || [],
				facilityTypes: Array.from(new Set((facilityTypes || []).map(t => t.type).filter(Boolean))),
				cities: Array.from(new Set((cities || []).map(c => c.city).filter(Boolean))),
				states: Array.from(new Set((states || []).map(s => s.state).filter(Boolean)))
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
		console.error('Facilities page load error:', err)
		throw error(500, 'Failed to load facilities data')
	}
}
