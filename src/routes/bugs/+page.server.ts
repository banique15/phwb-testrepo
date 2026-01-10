import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import type { Bug } from '$lib/schemas/bug'

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	const startTime = performance.now()

	// Check authentication
	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	// Use service role client to bypass RLS
	const supabase = locals.supabaseAdmin || locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	// Parse URL parameters for initial load
	const searchParams = url.searchParams
	const search = searchParams.get('search') || undefined
	const sortBy = searchParams.get('sortBy') || 'created_at'
	const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
	
	// Filter parameters
	const status = searchParams.get('status') || undefined
	const priority = searchParams.get('priority') || undefined
	const severity = searchParams.get('severity') || undefined
	const category = searchParams.get('category') || undefined
	const assignedTo = searchParams.get('assignedTo') || undefined
	const reportedBy = searchParams.get('reportedBy') || undefined

	try {
		const fetchStartTime = performance.now()
		
		// Helper function to apply filters to a query
		const applyFilters = (baseQuery: any) => {
			let filteredQuery = baseQuery

			// Basic search across title and description
			if (search) {
				filteredQuery = filteredQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
			}

			// Status filter
			if (status) {
				filteredQuery = filteredQuery.eq('status', status)
			}

			// Priority filter
			if (priority) {
				filteredQuery = filteredQuery.eq('priority', priority)
			}

			// Severity filter
			if (severity) {
				filteredQuery = filteredQuery.eq('severity', severity)
			}

			// Category filter
			if (category) {
				filteredQuery = filteredQuery.eq('category', category)
			}

			// Assigned to filter
			if (assignedTo) {
				filteredQuery = filteredQuery.eq('assigned_to', assignedTo)
			}

			// Reported by filter
			if (reportedBy) {
				filteredQuery = filteredQuery.eq('reported_by', reportedBy)
			}

			return filteredQuery
		}

		// Build data query - fetch ALL bugs from ALL users (no user-based filtering)
		// In dev mode with mock sessions, RLS might block access, so we use a function
		// that bypasses RLS for server-side queries
		let data: any[] | null = null
		let queryError: any = null

		// Try direct query first (works in production with real auth)
		let dataQuery = supabase
			.from('phwb_bugs')
			.select('*')

		// Apply optional filters from URL parameters (status, priority, etc.)
		// These are optional and don't filter by user
		dataQuery = applyFilters(dataQuery)

		// Add sorting
		const ascending = sortOrder === 'asc'
		dataQuery = dataQuery.order(sortBy, { ascending })

		// Execute query (fetch all bugs, no pagination)
		const result = await dataQuery
		data = result.data
		queryError = result.error

		// If query failed (likely RLS blocking in dev mode), try using the function
		if (queryError || !data || data.length === 0) {
			// Use the function that bypasses RLS for server-side queries
			const { data: functionData, error: functionError } = await supabase
				.rpc('get_all_bugs')

			if (!functionError && functionData) {
				// Apply filters to the function results
				let filteredData = functionData

				// Apply search filter
				if (search) {
					const searchLower = search.toLowerCase()
					filteredData = filteredData.filter((bug: any) =>
						bug.title?.toLowerCase().includes(searchLower) ||
						bug.description?.toLowerCase().includes(searchLower)
					)
				}

				// Apply other filters
				if (status) filteredData = filteredData.filter((b: any) => b.status === status)
				if (priority) filteredData = filteredData.filter((b: any) => b.priority === priority)
				if (severity) filteredData = filteredData.filter((b: any) => b.severity === severity)
				if (category) filteredData = filteredData.filter((b: any) => b.category === category)
				if (assignedTo) filteredData = filteredData.filter((b: any) => b.assigned_to === assignedTo)
				if (reportedBy) filteredData = filteredData.filter((b: any) => b.reported_by === reportedBy)

				// Sort the data
				filteredData.sort((a: any, b: any) => {
					const aVal = a[sortBy]
					const bVal = b[sortBy]
					if (aVal === bVal) return 0
					const comparison = aVal < bVal ? -1 : 1
					return ascending ? comparison : -comparison
				})

				data = filteredData
				queryError = null
			} else if (functionError) {
				queryError = functionError
			}
		}

		if (queryError) throw queryError

		// Fetch profiles for reported_by and assigned_to users
		const userIds = new Set<string>()
		if (data) {
			data.forEach((bug: any) => {
				if (bug.reported_by) userIds.add(bug.reported_by)
				if (bug.assigned_to) userIds.add(bug.assigned_to)
			})
		}

		let profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>()
		if (userIds.size > 0) {
			const { data: profiles, error: profilesError } = await supabase
				.from('profiles')
				.select('id, full_name, avatar_url')
				.in('id', Array.from(userIds))

			if (profilesError) {
				console.warn('Failed to fetch profiles:', profilesError)
			} else if (profiles) {
				profiles.forEach((profile: any) => {
					profilesMap.set(profile.id, {
						full_name: profile.full_name,
						avatar_url: profile.avatar_url
					})
				})
			}
		}

		// Attach profile data to bugs
		const bugsWithProfiles = (data || []).map((bug: any) => ({
			...bug,
			profiles_reported: bug.reported_by ? profilesMap.get(bug.reported_by) || null : null,
			profiles_assigned: bug.assigned_to ? profilesMap.get(bug.assigned_to) || null : null
		}))

		const fetchTime = performance.now() - fetchStartTime

		// Get statistics - fetch all bugs (without filters) for accurate statistics
		const statsStartTime = performance.now()
		let allBugsForStats: any[] = []
		
		// Try direct query first
		const { data: allBugsData, error: allBugsError } = await supabase
			.from('phwb_bugs')
			.select('*')
		
		if (allBugsError || !allBugsData || allBugsData.length === 0) {
			// Fallback to function if direct query fails (dev mode RLS issue)
			const { data: functionData } = await supabase.rpc('get_all_bugs')
			allBugsForStats = functionData || []
		} else {
			allBugsForStats = allBugsData
		}
		
		// Calculate statistics from all bugs
		const statistics = {
			total: allBugsForStats.length || 0,
			open: allBugsForStats.filter((b: any) => ['new', 'triage', 'in_progress', 'testing', 'reopened'].includes(b.status)).length || 0,
			inProgress: allBugsForStats.filter((b: any) => b.status === 'in_progress').length || 0,
			resolved: allBugsForStats.filter((b: any) => b.status === 'resolved').length || 0
		}
		
		const statsTime = performance.now() - statsStartTime
		const totalTime = performance.now() - startTime

		// Set performance headers for monitoring  
		setHeaders({
			'X-Total-Time': `${totalTime.toFixed(2)}ms`,
			'X-Fetch-Time': `${fetchTime.toFixed(2)}ms`,
			'X-Stats-Time': `${statsTime.toFixed(2)}ms`
		})

		// Get all users for assignee dropdown
		const { data: users } = await supabase
			.from('profiles')
			.select('id, full_name, avatar_url')
			.order('full_name', { ascending: true })

		return {
			bugs: bugsWithProfiles,
			statistics,
			filters: {
				search,
				sortBy,
				sortOrder,
				status,
				priority,
				severity,
				category,
				assignedTo,
				reportedBy
			},
			users: users || [],
			performance: {
				totalTime: Math.round(totalTime),
				fetchTime: Math.round(fetchTime),
				statsTime: Math.round(statsTime)
			}
		}
	} catch (err) {
		const totalTime = performance.now() - startTime
		
		// Enhanced error logging
		const errorDetails = {
			message: err instanceof Error ? err.message : 'Unknown error',
			error: err,
			errorType: err?.constructor?.name || typeof err,
			errorString: String(err),
			errorJson: err && typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : null,
			duration: totalTime,
			params: { search, sortBy, sortOrder }
		}
		
		console.error('Bugs page load error:', errorDetails)

		setHeaders({
			'X-Error-Time': `${totalTime.toFixed(2)}ms`,
			'X-Error-Source': 'server-load'
		})

		// Extract more detailed error message
		let errorMessage = 'Unknown error occurred'
		if (err instanceof Error) {
			errorMessage = err.message
		} else if (err && typeof err === 'object' && 'message' in err) {
			errorMessage = String(err.message)
		} else if (err && typeof err === 'object' && 'error' in err) {
			errorMessage = String(err.error)
		}

		throw error(500, 'Failed to load bugs data: ' + errorMessage)
	}
}

export type BugsPageData = {
	bugs: Bug[]
	statistics: {
		total: number
		open: number
		inProgress: number
		resolved: number
	}
	filters: {
		search?: string
		sortBy: string
		sortOrder: 'asc' | 'desc'
		status?: string
		priority?: string
		severity?: string
		category?: string
		assignedTo?: string
		reportedBy?: string
	}
	users: Array<{
		id: string
		full_name: string | null
		avatar_url: string | null
	}>
	performance: {
		totalTime: number
		fetchTime: number
		statsTime: number
	}
}
