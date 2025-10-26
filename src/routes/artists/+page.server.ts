import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import type { Artist } from '$lib/schemas/artist'

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

	// Parse URL parameters for initial load
	const searchParams = url.searchParams
	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
	const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '1000', 10)))
	const search = searchParams.get('search') || undefined
	const sortBy = searchParams.get('sortBy') || 'created_at'
	const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
	
	// Advanced filter parameters
	const employmentStatus = searchParams.get('employmentStatus') || undefined
	const metropolitanHub = searchParams.get('metropolitanHub') || undefined
	const genresParam = searchParams.get('genres')
	const genres = genresParam ? genresParam.split(',').filter(Boolean) : undefined
	const instrumentsParam = searchParams.get('instruments')
	const instruments = instrumentsParam ? instrumentsParam.split(',').filter(Boolean) : undefined
	const languagesParam = searchParams.get('languages')
	const languages = languagesParam ? languagesParam.split(',').filter(Boolean) : undefined
	const canSightRead = searchParams.get('canSightRead') === 'true' ? true : 
		searchParams.get('canSightRead') === 'false' ? false : undefined
	const canBeSoloist = searchParams.get('canBeSoloist') === 'true' ? true : 
		searchParams.get('canBeSoloist') === 'false' ? false : undefined
	const completeProfilesOnly = searchParams.get('completeProfilesOnly') === 'true'

	try {
		// Start timing individual operations
		const fetchStartTime = performance.now()
		
		// Build query with filters
		let query = supabase
			.from('phwb_artists')
			.select('*', { count: 'exact' })

		// Basic search across multiple fields
		if (search) {
			const searchFields = ['full_name', 'artist_name', 'email', 'location']
			const searchQuery = searchFields
				.map(field => `${field}.ilike.%${search}%`)
				.join(',')
			query = query.or(searchQuery)
		}

		// Advanced filters
		if (employmentStatus) {
			query = query.eq('employment_status', employmentStatus)
		}
		if (metropolitanHub) {
			query = query.eq('metropolitan_hub', metropolitanHub)
		}
		if (genres && genres.length > 0) {
			query = query.overlaps('genres', genres)
		}
		if (instruments && instruments.length > 0) {
			query = query.overlaps('instruments', instruments)
		}
		if (languages && languages.length > 0) {
			query = query.overlaps('languages', languages)
		}
		if (canSightRead !== undefined) {
			query = query.eq('sightreads', canSightRead)
		}
		if (canBeSoloist !== undefined) {
			query = query.eq('can_be_soloist', canBeSoloist)
		}
		if (completeProfilesOnly) {
			query = query
				.not('full_name', 'is', null)
				.not('email', 'is', null)
				.not('phone', 'is', null)
				.not('bio', 'is', null)
		}

		// Add sorting
		const ascending = sortOrder === 'asc'
		query = query.order(sortBy, { ascending })

		// Add pagination
		const from = (page - 1) * limit
		const to = from + limit - 1
		query = query.range(from, to)

		const { data, error: queryError, count } = await query
		if (queryError) throw queryError

		const fetchTime = performance.now() - fetchStartTime

		// Get statistics
		const statsStartTime = performance.now()
		const [
			{ count: total },
			{ count: recentCount },
			{ count: completeProfiles },
			{ count: soloists },
			{ count: sightReaders }
		] = await Promise.all([
			supabase.from('phwb_artists').select('*', { count: 'exact', head: true }),
			supabase.from('phwb_artists').select('*', { count: 'exact', head: true })
				.gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
			supabase.from('phwb_artists').select('*', { count: 'exact', head: true })
				.not('full_name', 'is', null).not('email', 'is', null).not('phone', 'is', null).not('bio', 'is', null),
			supabase.from('phwb_artists').select('*', { count: 'exact', head: true }).eq('can_be_soloist', true),
			supabase.from('phwb_artists').select('*', { count: 'exact', head: true }).eq('sightreads', true)
		])
		
		const statistics = {
			total: total || 0,
			recentCount: recentCount || 0,
			completeProfiles: completeProfiles || 0,
			soloists: soloists || 0,
			sightReaders: sightReaders || 0
		}
		
		const statsTime = performance.now() - statsStartTime
		const totalTime = performance.now() - startTime

		// Set performance headers for monitoring  
		setHeaders({
			'X-Total-Time': `${totalTime.toFixed(2)}ms`,
			'X-Fetch-Time': `${fetchTime.toFixed(2)}ms`,
			'X-Stats-Time': `${statsTime.toFixed(2)}ms`
		})

		const totalPages = Math.ceil((count || 0) / limit)

		// Return the data that will be available immediately on page load
		return {
			// Artists data
			artists: data || [],
			pagination: {
				total: count || 0,
				page,
				limit,
				totalPages
			},
			
			// Statistics for potential dashboard widgets
			statistics,
			
			// Initial filter state
			filters: {
				search,
				sortBy,
				sortOrder,
				employmentStatus,
				metropolitanHub,
				genres,
				instruments,
				languages,
				canSightRead,
				canBeSoloist,
				completeProfilesOnly
			},
			
			// Performance metrics for debugging
			performance: {
				totalTime: Math.round(totalTime),
				fetchTime: Math.round(fetchTime),
				statsTime: Math.round(statsTime),
				queryTime: Math.round(fetchTime) // Using fetchTime as proxy for queryTime
			}
		}
	} catch (err) {
		const totalTime = performance.now() - startTime
		
		// Log error with performance context
		console.error('Artists page load error:', {
			error: err instanceof Error ? err.message : 'Unknown error',
			duration: totalTime,
			params: { page, limit, search, sortBy, sortOrder }
		})

		// Set error headers
		setHeaders({
			'X-Error-Time': `${totalTime.toFixed(2)}ms`,
			'X-Error-Source': 'server-load'
		})

		throw error(500, 'Failed to load artists data: ' + (err instanceof Error ? err.message : 'Unknown error occurred'))
	}
}

export type ArtistsPageData = {
	artists: Artist[]
	pagination: {
		total: number
		page: number
		limit: number
		totalPages: number
	}
	statistics: {
		total: number
		recentCount: number
		completeProfiles: number
		soloists: number
		sightReaders: number
	}
	filters: {
		search?: string
		sortBy: string
		sortOrder: 'asc' | 'desc'
		employmentStatus?: string
		metropolitanHub?: string
		genres?: string[]
		instruments?: string[]
		languages?: string[]
		canSightRead?: boolean
		canBeSoloist?: boolean
		completeProfilesOnly: boolean
	}
	performance: {
		totalTime: number
		fetchTime: number
		statsTime: number
		queryTime: number
	}
}