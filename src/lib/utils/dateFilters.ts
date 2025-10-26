/**
 * Date range utilities for filtering
 */

export interface DateRange {
	from: string
	to: string
}

/**
 * Format date for SQL/filter use (YYYY-MM-DD)
 */
export function formatDateForFilter(date: Date): string {
	return date.toISOString().split('T')[0]
}

/**
 * Get today's date in filter format
 */
export function getToday(): string {
	return formatDateForFilter(new Date())
}

/**
 * Get upcoming date range (today onwards)
 */
export function getUpcomingDateRange(): DateRange {
	const today = new Date()
	const futureDate = new Date()
	futureDate.setFullYear(futureDate.getFullYear() + 2) // 2 years in the future

	return {
		from: formatDateForFilter(today),
		to: formatDateForFilter(futureDate)
	}
}

/**
 * Get past date range (up to today)
 */
export function getPastDateRange(): DateRange {
	const today = new Date()
	const pastDate = new Date()
	pastDate.setFullYear(pastDate.getFullYear() - 5) // 5 years in the past

	return {
		from: formatDateForFilter(pastDate),
		to: formatDateForFilter(today)
	}
}

/**
 * Get this week's date range (Sunday to Saturday)
 */
export function getThisWeekRange(): DateRange {
	const today = new Date()
	const weekStart = new Date(today)
	weekStart.setDate(today.getDate() - today.getDay()) // Sunday

	const weekEnd = new Date(weekStart)
	weekEnd.setDate(weekStart.getDate() + 6) // Saturday

	return {
		from: formatDateForFilter(weekStart),
		to: formatDateForFilter(weekEnd)
	}
}

/**
 * Get this month's date range (1st to last day)
 */
export function getThisMonthRange(): DateRange {
	const today = new Date()
	const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
	const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

	return {
		from: formatDateForFilter(monthStart),
		to: formatDateForFilter(monthEnd)
	}
}

/**
 * Get next N days date range
 */
export function getNextNDays(n: number): DateRange {
	const today = new Date()
	const endDate = new Date(today)
	endDate.setDate(today.getDate() + n)

	return {
		from: formatDateForFilter(today),
		to: formatDateForFilter(endDate)
	}
}

/**
 * Get last N days date range
 */
export function getLastNDays(n: number): DateRange {
	const today = new Date()
	const startDate = new Date(today)
	startDate.setDate(today.getDate() - n)

	return {
		from: formatDateForFilter(startDate),
		to: formatDateForFilter(today)
	}
}

/**
 * Get current year date range
 */
export function getThisYearRange(): DateRange {
	const today = new Date()
	const yearStart = new Date(today.getFullYear(), 0, 1)
	const yearEnd = new Date(today.getFullYear(), 11, 31)

	return {
		from: formatDateForFilter(yearStart),
		to: formatDateForFilter(yearEnd)
	}
}

/**
 * Get current quarter date range
 */
export function getThisQuarterRange(): DateRange {
	const today = new Date()
	const quarter = Math.floor(today.getMonth() / 3)
	const quarterStart = new Date(today.getFullYear(), quarter * 3, 1)
	const quarterEnd = new Date(today.getFullYear(), (quarter + 1) * 3, 0)

	return {
		from: formatDateForFilter(quarterStart),
		to: formatDateForFilter(quarterEnd)
	}
}

/**
 * Check if a date is in a given range
 */
export function isInDateRange(date: string, from?: string, to?: string): boolean {
	if (!date) return false

	if (from && date < from) return false
	if (to && date > to) return false

	return true
}

/**
 * Check if a date is today
 */
export function isToday(date: string): boolean {
	return date === getToday()
}

/**
 * Check if a date is in the past
 */
export function isPast(date: string): boolean {
	return date < getToday()
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: string): boolean {
	return date > getToday()
}

/**
 * Check if a date is this week
 */
export function isThisWeek(date: string): boolean {
	const range = getThisWeekRange()
	return isInDateRange(date, range.from, range.to)
}

/**
 * Check if a date is this month
 */
export function isThisMonth(date: string): boolean {
	const range = getThisMonthRange()
	return isInDateRange(date, range.from, range.to)
}

/**
 * Get relative date description
 */
export function getRelativeDateDescription(date: string): string {
	if (isToday(date)) return 'Today'
	if (isPast(date)) return 'Past'
	if (isFuture(date)) {
		const today = new Date()
		const targetDate = new Date(date)
		const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

		if (diffDays === 1) return 'Tomorrow'
		if (diffDays <= 7) return `In ${diffDays} days`
		if (diffDays <= 30) return `In ${Math.ceil(diffDays / 7)} weeks`
		return 'Upcoming'
	}
	return 'Unknown'
}

/**
 * Format date for display
 */
export function formatDateDisplay(date: string): string {
	try {
		const d = new Date(date)
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	} catch {
		return date
	}
}

/**
 * Format date range for display
 */
export function formatDateRangeDisplay(from: string, to: string): string {
	return `${formatDateDisplay(from)} - ${formatDateDisplay(to)}`
}

/**
 * Parse date filter preset and return range
 */
export function getDateRangeForPreset(preset: string): DateRange | null {
	switch (preset) {
		case 'upcoming':
			return getUpcomingDateRange()
		case 'past':
			return getPastDateRange()
		case 'this_week':
			return getThisWeekRange()
		case 'this_month':
			return getThisMonthRange()
		case 'this_year':
			return getThisYearRange()
		case 'this_quarter':
			return getThisQuarterRange()
		case 'next_7_days':
			return getNextNDays(7)
		case 'next_30_days':
			return getNextNDays(30)
		case 'last_7_days':
			return getLastNDays(7)
		case 'last_30_days':
			return getLastNDays(30)
		default:
			return null
	}
}

/**
 * Get available date filter options for UI
 */
export function getDateFilterOptions() {
	return [
		{ value: '', label: 'All Dates', description: 'No date filtering' },
		{ value: 'upcoming', label: 'Upcoming', description: 'Future events' },
		{ value: 'past', label: 'Past', description: 'Historical events' },
		{ value: 'this_week', label: 'This Week', description: 'Sunday to Saturday' },
		{ value: 'this_month', label: 'This Month', description: 'Current calendar month' },
		{ value: 'this_quarter', label: 'This Quarter', description: 'Current 3-month period' },
		{ value: 'this_year', label: 'This Year', description: 'Current calendar year' },
		{ value: 'next_7_days', label: 'Next 7 Days', description: 'Week ahead' },
		{ value: 'next_30_days', label: 'Next 30 Days', description: 'Month ahead' },
		{ value: 'last_7_days', label: 'Last 7 Days', description: 'Past week' },
		{ value: 'last_30_days', label: 'Last 30 Days', description: 'Past month' },
		{ value: 'custom', label: 'Custom Range', description: 'Select specific dates' }
	]
}
