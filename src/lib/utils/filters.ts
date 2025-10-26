import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Event filter interface
 */
export interface EventFilters {
	// Basic filters
	search?: string
	status?: string
	venue?: number
	program?: number
	partner?: number

	// Date filters
	dateFilter?: 'upcoming' | 'past' | 'this_week' | 'this_month' | 'custom' | 'next_7_days' | 'next_30_days'
	dateFrom?: string
	dateTo?: string

	// Location filters (new two-level structure)
	location_id?: number
	facility_id?: number

	// Artist/Ensemble filters
	artist_id?: string
	ensemble_id?: string

	// Event type filters
	event_type?: string
	confirmation_status?: string

	// Capacity filters
	has_artists?: boolean
	musician_count_min?: number
	musician_count_max?: number
}

/**
 * Facility filter interface
 */
export interface FacilityFilters {
	// Basic filters
	search?: string
	type?: string
	partner?: number

	// Location filters
	has_locations?: boolean
	location_count_min?: number
	location_count_max?: number
	has_contacts?: boolean

	// Geographic filters
	city?: string
	state?: string

	// Sorting
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
}

/**
 * Build event filters for Supabase query
 */
export function buildEventFilters(query: any, filters: EventFilters): any {
	// Search filter
	if (filters.search) {
		query = query.or(`title.ilike.%${filters.search}%,notes.ilike.%${filters.search}%,location_detail.ilike.%${filters.search}%`)
	}

	// Status filter
	if (filters.status && filters.status !== 'all') {
		query = query.eq('status', filters.status)
	}

	// Venue filter (legacy)
	if (filters.venue && filters.venue !== 0) {
		query = query.eq('venue', filters.venue)
	}

	// Location filter (new structure)
	if (filters.location_id && filters.location_id !== 0) {
		query = query.eq('location_id', filters.location_id)
	}

	// Program filter
	if (filters.program && filters.program !== 0) {
		query = query.eq('program', filters.program)
	}

	// Event type filter
	if (filters.event_type && filters.event_type !== 'all') {
		query = query.eq('event_type', filters.event_type)
	}

	// Confirmation status filter
	if (filters.confirmation_status && filters.confirmation_status !== 'all') {
		query = query.eq('confirmation_status', filters.confirmation_status)
	}

	// Musician count filters
	if (filters.musician_count_min !== undefined) {
		query = query.gte('number_of_musicians', filters.musician_count_min)
	}
	if (filters.musician_count_max !== undefined) {
		query = query.lte('number_of_musicians', filters.musician_count_max)
	}

	// Date filters
	query = applyDateFilter(query, filters, 'date')

	return query
}

/**
 * Apply date range filters to query
 */
export function applyDateFilter(query: any, filters: EventFilters, dateField: string = 'date'): any {
	const today = new Date().toISOString().split('T')[0]

	if (filters.dateFilter) {
		switch (filters.dateFilter) {
			case 'upcoming':
				query = query.gte(dateField, today)
				break

			case 'past':
				query = query.lt(dateField, today)
				break

			case 'this_week': {
				const weekStart = new Date()
				weekStart.setDate(weekStart.getDate() - weekStart.getDay())
				const weekEnd = new Date(weekStart)
				weekEnd.setDate(weekEnd.getDate() + 6)
				query = query
					.gte(dateField, weekStart.toISOString().split('T')[0])
					.lte(dateField, weekEnd.toISOString().split('T')[0])
				break
			}

			case 'this_month': {
				const monthStart = new Date()
				monthStart.setDate(1)
				const monthEnd = new Date(monthStart)
				monthEnd.setMonth(monthEnd.getMonth() + 1)
				monthEnd.setDate(0)
				query = query
					.gte(dateField, monthStart.toISOString().split('T')[0])
					.lte(dateField, monthEnd.toISOString().split('T')[0])
				break
			}

			case 'next_7_days': {
				const endDate = new Date()
				endDate.setDate(endDate.getDate() + 7)
				query = query
					.gte(dateField, today)
					.lte(dateField, endDate.toISOString().split('T')[0])
				break
			}

			case 'next_30_days': {
				const endDate = new Date()
				endDate.setDate(endDate.getDate() + 30)
				query = query
					.gte(dateField, today)
					.lte(dateField, endDate.toISOString().split('T')[0])
				break
			}

			case 'custom':
				if (filters.dateFrom) {
					query = query.gte(dateField, filters.dateFrom)
				}
				if (filters.dateTo) {
					query = query.lte(dateField, filters.dateTo)
				}
				break
		}
	}

	return query
}

/**
 * Build facility filters for Supabase query
 */
export function buildFacilityFilters(query: any, filters: FacilityFilters): any {
	// Search filter
	if (filters.search) {
		query = query.or(`name.ilike.%${filters.search}%,address.ilike.%${filters.search}%,type.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
	}

	// Type filter
	if (filters.type && filters.type !== 'all') {
		query = query.eq('type', filters.type)
	}

	// Partner filter
	if (filters.partner && filters.partner !== 0) {
		query = query.eq('partner', filters.partner)
	}

	return query
}

/**
 * Client-side filter: Events by artist
 * Checks if artist UUID is in the artists array
 */
export function filterByArtist(events: any[], artistId: string): any[] {
	if (!artistId) return events

	return events.filter(event => {
		if (!event.artists || !Array.isArray(event.artists)) return false
		return event.artists.includes(artistId)
	})
}

/**
 * Client-side filter: Events by ensemble
 * Checks if any ensemble member is in the event's artists array
 */
export function filterByEnsemble(events: any[], ensembleMembers: string[]): any[] {
	if (!ensembleMembers || ensembleMembers.length === 0) return events

	return events.filter(event => {
		if (!event.artists || !Array.isArray(event.artists)) return false
		return event.artists.some((artistId: string) => ensembleMembers.includes(artistId))
	})
}

/**
 * Client-side filter: Events by partner (via program)
 */
export function filterByPartner(events: any[], partnerId: number): any[] {
	if (!partnerId) return events

	return events.filter(event => {
		return event.partner_id === partnerId || event.program_object?.partner === partnerId
	})
}

/**
 * Client-side filter: Facilities by location count range
 */
export function filterByLocationCount(facilities: any[], min?: number, max?: number): any[] {
	return facilities.filter(facility => {
		const locationCount = facility.locations?.[0]?.count || 0

		if (min !== undefined && locationCount < min) return false
		if (max !== undefined && locationCount > max) return false

		return true
	})
}

/**
 * Client-side filter: Facilities with/without locations
 */
export function filterHasLocations(facilities: any[], hasLocations: boolean): any[] {
	return facilities.filter(facility => {
		const locationCount = facility.locations?.[0]?.count || 0
		return hasLocations ? locationCount > 0 : locationCount === 0
	})
}

/**
 * Generic date range filter for client-side filtering
 */
export function filterByDateRange(items: any[], dateField: string, from?: string, to?: string): any[] {
	return items.filter(item => {
		const itemDate = item[dateField]
		if (!itemDate) return false

		if (from && itemDate < from) return false
		if (to && itemDate > to) return false

		return true
	})
}

/**
 * Generic multi-value filter
 */
export function filterByMultipleValues(items: any[], field: string, values: any[]): any[] {
	if (!values || values.length === 0) return items

	return items.filter(item => {
		const itemValue = item[field]
		return values.includes(itemValue)
	})
}

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromURL(searchParams: URLSearchParams): EventFilters {
	return {
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
		has_artists: searchParams.get('has_artists') === 'true' ? true : undefined,
		musician_count_min: searchParams.get('musician_count_min') ? parseInt(searchParams.get('musician_count_min')!) : undefined,
		musician_count_max: searchParams.get('musician_count_max') ? parseInt(searchParams.get('musician_count_max')!) : undefined,
	}
}

/**
 * Encode filters to URL search params
 */
export function encodeFiltersToURL(filters: EventFilters): URLSearchParams {
	const params = new URLSearchParams()

	Object.entries(filters).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			params.set(key, String(value))
		}
	})

	return params
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: EventFilters | FacilityFilters): number {
	return Object.values(filters).filter(value =>
		value !== undefined && value !== null && value !== '' && value !== 'all'
	).length
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: EventFilters | FacilityFilters): boolean {
	return countActiveFilters(filters) > 0
}

/**
 * Clear all filters
 */
export function clearFilters(): EventFilters {
	return {}
}
