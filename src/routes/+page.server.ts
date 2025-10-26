import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

type DashboardStats = {
	artists: number
	events: number
	partners: number
	facilities: number
	locations: number
}

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const startTime = performance.now()

	if (!locals.session) {
		throw error(401, 'Authentication required')
	}

	const supabase = locals.supabase
	if (!supabase) {
		throw error(500, 'Database connection not available')
	}

	const fetchCount = async (table: string) => {
		const { count, error: countError } = await supabase
			.from(table)
			.select('*', { count: 'exact', head: true })

		if (countError) {
			throw countError
		}

		return count || 0
	}

	try {
		const [artists, events, partners, facilities, locations] = await Promise.all([
			fetchCount('phwb_artists'),
			fetchCount('phwb_events'),
			fetchCount('phwb_partners'),
			fetchCount('phwb_facilities'),
			fetchCount('phwb_locations')
		])

		const stats: DashboardStats = { artists, events, partners, facilities, locations }
		const totalTime = performance.now() - startTime

		setHeaders({
			'X-Total-Time': `${totalTime.toFixed(2)}ms`,
			'X-Data-Source': 'dashboard'
		})

		return { stats }
	} catch (err) {
		const totalTime = performance.now() - startTime
		console.error('Dashboard load error:', err)

		setHeaders({
			'X-Error-Time': `${totalTime.toFixed(2)}ms`,
			'X-Error-Source': 'dashboard'
		})

		throw error(500, 'Failed to load dashboard statistics')
	}
}

export type DashboardPageData = {
	stats: DashboardStats
}
