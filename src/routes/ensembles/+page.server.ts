import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { ensemblesStore } from '$lib/stores/ensembles'
import type { PaginationOptions } from '$lib/types'

export const load: PageServerLoad = async ({ locals, url }) => {
	// Check authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}
	const searchParams = url.searchParams
	
	// Extract pagination and filter parameters
	const page = parseInt(searchParams.get('page') || '1', 10)
	const limit = parseInt(searchParams.get('limit') || '1000', 10)
	const search = searchParams.get('search') || undefined
	const sortBy = searchParams.get('sortBy') || 'created_at'
	const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
	const status = searchParams.get('status') || undefined

	const options: PaginationOptions = {
		page,
		limit,
		search,
		sortBy,
		sortOrder
	}

	try {
		const startTime = Date.now()
		
		// Fetch ensembles data
		const result = await ensemblesStore.fetchPaginated(options)
		
		// Filter by status if provided
		let filteredData = result.data
		if (status && status !== 'all') {
			filteredData = filteredData.filter(e => e.status === status)
		}
		
		const endTime = Date.now()
		const totalTime = endTime - startTime

		return {
			ensembles: filteredData,
			pagination: {
				total: result.total,
				page,
				limit,
				totalPages: result.totalPages
			},
			filters: {
				search,
				sortBy,
				sortOrder,
				status: status || 'all'
			},
			performance: {
				totalTime,
				queryTime: totalTime,
				itemCount: filteredData.length
			}
		}
	} catch (error) {
		console.error('Failed to load ensembles:', error)
		
		// Return empty state on error
		return {
			ensembles: [],
			pagination: {
				total: 0,
				page: 1,
				limit,
				totalPages: 0
			},
			filters: {
				search,
				sortBy,
				sortOrder,
				status: status || 'all'
			},
			performance: {
				totalTime: 0,
				queryTime: 0,
				itemCount: 0
			},
			error: error instanceof Error ? error.message : 'Failed to load ensembles'
		}
	}
}

