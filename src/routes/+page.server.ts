import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

type DashboardStats = {
	artists: number
	events: number
	partners: number
	facilities: number
	locations: number
}

type CalendarEvent = {
	id: number
	title: string
	date: string
	start_time: string | null
	end_time: string | null
	status: string
	program_id: number | null
	program_name: string | null
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

	// Get date range for calendar (3 months before and after)
	const today = new Date()
	const startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0]
	const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().split('T')[0]

	try {
		const [artists, events, partners, facilities, locations, profileResult, eventsResult] = await Promise.all([
			fetchCount('phwb_artists'),
			fetchCount('phwb_events'),
			fetchCount('phwb_partners'),
			fetchCount('phwb_facilities'),
			fetchCount('phwb_locations'),
			supabase.from('profiles').select('full_name').eq('id', locals.session.user.id).single(),
			supabase
				.from('phwb_events')
				.select('id, title, date, start_time, end_time, status, program_id, program:phwb_programs(title)')
				.gte('date', startDate)
				.lte('date', endDate)
				.order('date', { ascending: true })
		])

		const stats: DashboardStats = { artists, events, partners, facilities, locations }
		const firstName = profileResult.data?.full_name?.split(' ')[0] || null
		const calendarEvents: CalendarEvent[] = (eventsResult.data || []).map((event: any) => ({
			id: event.id,
			title: event.title,
			date: event.date,
			start_time: event.start_time,
			end_time: event.end_time,
			status: event.status,
			program_id: event.program_id,
			program_name: event.program?.title || null
		}))
		const totalTime = performance.now() - startTime

		setHeaders({
			'X-Total-Time': `${totalTime.toFixed(2)}ms`,
			'X-Data-Source': 'dashboard'
		})

		return { stats, firstName, calendarEvents }
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
	firstName: string | null
	calendarEvents: CalendarEvent[]
}
