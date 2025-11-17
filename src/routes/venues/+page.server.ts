import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { venuesStore } from '$lib/stores/venues'
import type { PaginationOptions } from '$lib/types'

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}
	const searchParams = url.searchParams
	
	// Extract pagination and filter parameters
	const page = parseInt(searchParams.get('page') || '1', 10)
	const limit = parseInt(searchParams.get('limit') || '50', 10)
	const search = searchParams.get('search') || undefined
	const sortBy = searchParams.get('sortBy') || 'created_at'
	const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'

	const options: PaginationOptions = {
		page,
		limit,
		search,
		sortBy,
		sortOrder
	}

	try {
		const startTime = Date.now()
		
		// Fetch venues data
		const result = await venuesStore.fetchPaginated(options)
		
		const endTime = Date.now()
		const totalTime = endTime - startTime

		return {
			venues: result.data,
			pagination: {
				total: result.total,
				page,
				limit,
				totalPages: result.totalPages
			},
			filters: {
				search,
				sortBy,
				sortOrder
			},
			performance: {
				totalTime,
				queryTime: totalTime,
				itemCount: result.data.length
			}
		}
	} catch (error) {
		console.error('Failed to load venues:', error)
		
		// Return empty state on error
		return {
			venues: [],
			pagination: {
				total: 0,
				page: 1,
				limit,
				totalPages: 0
			},
			filters: {
				search,
				sortBy,
				sortOrder
			},
			performance: {
				totalTime: 0,
				queryTime: 0,
				itemCount: 0
			},
			error: error instanceof Error ? error.message : 'Failed to load venues'
		}
	}
}