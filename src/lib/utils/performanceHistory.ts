import { supabase } from '$lib/supabase'
import type { Event } from '$lib/schemas/event'

export interface PerformanceRecord {
	event_id: number
	event_title: string
	event_date: string
	event_type?: string
	status: string
	venue_name?: string
	location_name?: string
	program_name?: string
	hours?: number
	compensation?: number
	created_at: string
}

export interface ArtistPerformanceStats {
	total_events: number
	total_hours: number
	total_compensation: number
	completed_events: number
	upcoming_events: number
	cancelled_events: number
}

/**
 * Get performance history for an artist
 * Returns events where the artist is listed in the artists array
 */
export async function getArtistPerformanceHistory(artistId: string, limit?: number): Promise<PerformanceRecord[]> {
	let query = supabase
		.from('phwb_events')
		.select(`
			id,
			title,
			date,
			event_type,
			status,
			total_hours_of_service,
			total_fee,
			created_at,
			venue:phwb_venues(name),
			location:phwb_locations(name),
			program:phwb_programs(title)
		`)
		.contains('artists', [artistId])
		.order('date', { ascending: false })

	if (limit) {
		query = query.limit(limit)
	}

	const { data, error } = await query

	if (error) {
		console.error('Error fetching artist performance history:', error)
		throw new Error(`Failed to fetch performance history: ${error.message}`)
	}

	// Transform the data into PerformanceRecord format
	return (data || []).map((event: any) => ({
		event_id: event.id,
		event_title: event.title,
		event_date: event.date,
		event_type: event.event_type,
		status: event.status,
		venue_name: event.venue?.name,
		location_name: event.location?.name,
		program_name: event.program?.title,
		hours: event.total_hours_of_service,
		compensation: event.total_fee,
		created_at: event.created_at
	}))
}

/**
 * Get performance statistics for an artist
 */
export async function getArtistPerformanceStats(artistId: string): Promise<ArtistPerformanceStats> {
	const { data, error } = await supabase
		.from('phwb_events')
		.select('status, total_hours_of_service, total_fee')
		.contains('artists', [artistId])

	if (error) {
		console.error('Error fetching artist performance stats:', error)
		throw new Error(`Failed to fetch performance stats: ${error.message}`)
	}

	const events = data || []
	const today = new Date().toISOString().split('T')[0]

	const stats: ArtistPerformanceStats = {
		total_events: events.length,
		total_hours: events.reduce((sum, e) => sum + (e.total_hours_of_service || 0), 0),
		total_compensation: events.reduce((sum, e) => sum + (e.total_fee || 0), 0),
		completed_events: events.filter(e => e.status === 'completed').length,
		upcoming_events: events.filter(e => e.status === 'confirmed' || e.status === 'planned').length,
		cancelled_events: events.filter(e => e.status === 'cancelled').length
	}

	return stats
}

/**
 * Get performers for a specific event
 * Returns artist information for all artists in the event
 */
export async function getEventPerformers(eventId: number): Promise<any[]> {
	// First get the event to extract artist IDs
	const { data: event, error: eventError } = await supabase
		.from('phwb_events')
		.select('artists')
		.eq('id', eventId)
		.single()

	if (eventError) {
		console.error('Error fetching event:', eventError)
		throw new Error(`Failed to fetch event: ${eventError.message}`)
	}

	if (!event?.artists || !Array.isArray(event.artists) || event.artists.length === 0) {
		return []
	}

	// Then fetch artist details
	const { data: artists, error: artistsError } = await supabase
		.from('phwb_artists')
		.select(`
			id,
			full_name,
			artist_name,
			email,
			phone,
			profile_photo,
			instruments,
			genres,
			location
		`)
		.in('id', event.artists)

	if (artistsError) {
		console.error('Error fetching event performers:', artistsError)
		throw new Error(`Failed to fetch performers: ${artistsError.message}`)
	}

	return artists || []
}

/**
 * Get payroll records for an artist's event performance
 */
export async function getArtistEventPayroll(artistId: string, eventId?: number) {
	let query = supabase
		.from('phwb_payroll')
		.select(`
			id,
			event_date,
			hours,
			rate,
			total_pay,
			status,
			paid_date,
			notes
		`)
		.eq('artist_id', artistId)

	if (eventId) {
		query = query.eq('event_id', eventId)
	}

	query = query.order('event_date', { ascending: false })

	const { data, error } = await query

	if (error) {
		console.error('Error fetching payroll records:', error)
		throw new Error(`Failed to fetch payroll: ${error.message}`)
	}

	return data || []
}

/**
 * Get recent performance history for dashboard/quick views
 */
export async function getRecentPerformances(artistId: string, limit: number = 5): Promise<PerformanceRecord[]> {
	return getArtistPerformanceHistory(artistId, limit)
}
