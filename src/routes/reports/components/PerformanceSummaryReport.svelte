<script lang="ts">
	import { onMount } from 'svelte'
	import { Theater } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'

	// Report state
	let loading = $state(false)
	let error = $state('')
	let reportData = $state<any>({})
	let showFilters = $state(true)

	// Filter state
	let startDate = $state('')
	let endDate = $state('')
	let statusFilter = $state('all')
	let venueFilter = $state('all')
	let programFilter = $state('all')

	// Available options
	let venues = $state<any[]>([])
	let programs = $state<any[]>([])

	// Default to current year
	onMount(() => {
		const now = new Date()
		const yearStart = new Date(now.getFullYear(), 0, 1)
		const yearEnd = new Date(now.getFullYear(), 11, 31)

		startDate = yearStart.toISOString().split('T')[0]
		endDate = yearEnd.toISOString().split('T')[0]

		loadFilterOptions()
	})

	async function loadFilterOptions() {
		try {
			// Load venues
			const { data: venuesData } = await supabase
				.from('phwb_venues')
				.select('id, name')
				.order('name')
			venues = venuesData || []

			// Load programs
			const { data: programsData } = await supabase
				.from('phwb_programs')
				.select('id, title')
				.order('title')
			programs = programsData || []
		} catch (err) {
			console.error('Failed to load filter options:', err)
		}
	}

	async function generateReport() {
		if (!startDate || !endDate) {
			error = 'Please select both start and end dates'
			return
		}

		loading = true
		error = ''
		showFilters = false

		try {
			// Query events with related data
			let eventsQuery = supabase
				.from('phwb_events')
				.select('*')
				.gte('date', startDate)
				.lte('date', endDate)
				.order('date', { ascending: true })

			// Apply filters
			if (statusFilter !== 'all') {
				eventsQuery = eventsQuery.eq('status', statusFilter)
			}
			if (venueFilter !== 'all') {
				eventsQuery = eventsQuery.eq('venue', parseInt(venueFilter))
			}
			if (programFilter !== 'all') {
				eventsQuery = eventsQuery.eq('program', parseInt(programFilter))
			}

			const { data: eventsData, error: eventsError } = await eventsQuery
			if (eventsError) throw eventsError

			// Get venue and program details for display
			const venueIds = [...new Set((eventsData || []).map(e => e.venue).filter(Boolean))]
			const programIds = [...new Set((eventsData || []).map(e => e.program).filter(Boolean))]

			// Fetch venue names
			let venueMap: Record<number, string> = {}
			if (venueIds.length > 0) {
				const { data: venueData } = await supabase
					.from('phwb_venues')
					.select('id, name')
					.in('id', venueIds)
				venueMap = Object.fromEntries((venueData || []).map(v => [v.id, v.name]))
			}

			// Fetch program titles
			let programMap: Record<number, string> = {}
			if (programIds.length > 0) {
				const { data: programData } = await supabase
					.from('phwb_programs')
					.select('id, title')
					.in('id', programIds)
				programMap = Object.fromEntries((programData || []).map(p => [p.id, p.title]))
			}

			// Get payroll data linked to events
			let payrollQuery = supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name)
				`)
				.gte('event_date', startDate)
				.lte('event_date', endDate)

			const { data: payrollData, error: payrollError } = await payrollQuery
			if (payrollError) throw payrollError

			// Process the data
			const processedData = processPerformanceData(
				eventsData || [],
				payrollData || [],
				venueMap,
				programMap
			)
			reportData = processedData

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate report'
			console.error('Performance report generation error:', err)
			showFilters = true
		} finally {
			loading = false
		}
	}

	function processPerformanceData(
		events: any[],
		payroll: any[],
		venueMap: Record<number, string>,
		programMap: Record<number, string>
	) {
		// Artist participation analysis
		const artistParticipation = new Map<string, {
			name: string,
			eventCount: number,
			totalHours: number,
			totalPay: number,
			avgHoursPerEvent: number
		}>()

		// Event status breakdown
		const statusBreakdown = new Map<string, number>()

		// Monthly trend
		const monthlyTrend = new Map<string, {
			month: string,
			eventCount: number,
			totalHours: number,
			totalPay: number
		}>()

		// Venue utilization
		const venueUtilization = new Map<string, {
			name: string,
			eventCount: number,
			totalHours: number
		}>()

		// Program distribution
		const programDistribution = new Map<string, {
			name: string,
			eventCount: number,
			totalHours: number
		}>()

		// Event-to-payroll mapping for linking
		const eventPayrollMap = new Map<number, any[]>()
		payroll.forEach(record => {
			const eventId = record.event_id || record.source_event_id
			if (eventId) {
				if (!eventPayrollMap.has(eventId)) {
					eventPayrollMap.set(eventId, [])
				}
				eventPayrollMap.get(eventId)!.push(record)
			}
		})

		// Process events
		events.forEach(event => {
			// Status breakdown
			const status = event.status || 'unknown'
			statusBreakdown.set(status, (statusBreakdown.get(status) || 0) + 1)

			// Monthly trend
			const eventDate = new Date(event.date)
			const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`
			const monthName = eventDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

			if (!monthlyTrend.has(monthKey)) {
				monthlyTrend.set(monthKey, { month: monthName, eventCount: 0, totalHours: 0, totalPay: 0 })
			}
			monthlyTrend.get(monthKey)!.eventCount++

			// Add event hours to monthly trend
			const eventHours = event.total_hours_of_service || 0
			monthlyTrend.get(monthKey)!.totalHours += eventHours

			// Venue utilization
			if (event.venue) {
				const venueName = venueMap[event.venue] || 'Unknown Venue'
				if (!venueUtilization.has(venueName)) {
					venueUtilization.set(venueName, { name: venueName, eventCount: 0, totalHours: 0 })
				}
				venueUtilization.get(venueName)!.eventCount++
				venueUtilization.get(venueName)!.totalHours += eventHours
			}

			// Program distribution
			if (event.program) {
				const programName = programMap[event.program] || 'Unknown Program'
				if (!programDistribution.has(programName)) {
					programDistribution.set(programName, { name: programName, eventCount: 0, totalHours: 0 })
				}
				programDistribution.get(programName)!.eventCount++
				programDistribution.get(programName)!.totalHours += eventHours
			}

			// Add linked payroll to monthly trend
			const linkedPayroll = eventPayrollMap.get(event.id) || []
			linkedPayroll.forEach(p => {
				monthlyTrend.get(monthKey)!.totalPay += p.total_pay || (p.hours || 0) * (p.rate || 0) + (p.additional_pay || 0)
			})
		})

		// Process payroll for artist data
		payroll.forEach(record => {
			const artistId = record.artist_id || 'unknown'
			const artistName = record.artists?.full_name || 'Unknown Artist'
			const hours = record.hours || 0
			const pay = record.total_pay || (record.hours || 0) * (record.rate || 0) + (record.additional_pay || 0)

			// Artist participation
			if (!artistParticipation.has(artistId)) {
				artistParticipation.set(artistId, {
					name: artistName,
					eventCount: 0,
					totalHours: 0,
					totalPay: 0,
					avgHoursPerEvent: 0
				})
			}
			const artist = artistParticipation.get(artistId)!
			artist.eventCount++
			artist.totalHours += hours
			artist.totalPay += pay
			artist.avgHoursPerEvent = artist.totalHours / artist.eventCount
		})

		// Convert maps to sorted arrays
		const topArtists = Array.from(artistParticipation.values())
			.sort((a, b) => b.eventCount - a.eventCount)
			.slice(0, 10)

		const statusData = Array.from(statusBreakdown.entries())
			.map(([status, count]) => ({ status, count }))
			.sort((a, b) => b.count - a.count)

		const monthlyData = Array.from(monthlyTrend.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([_, data]) => data)

		const venueData = Array.from(venueUtilization.values())
			.sort((a, b) => b.eventCount - a.eventCount)
			.slice(0, 10)

		const programData = Array.from(programDistribution.values())
			.sort((a, b) => b.eventCount - a.eventCount)

		// Calculate summary metrics
		const totalEventHours = events.reduce((sum, e) => sum + (e.total_hours_of_service || 0), 0)
		const totalPayroll = Array.from(artistParticipation.values()).reduce((sum, a) => sum + a.totalPay, 0)

		const summary = {
			totalEvents: events.length,
			totalArtists: artistParticipation.size,
			totalHours: totalEventHours,
			totalPayroll: totalPayroll,
			avgEventsPerArtist: artistParticipation.size > 0 ? events.length / artistParticipation.size : 0,
			avgHoursPerEvent: events.length > 0 ? totalEventHours / events.length : 0,
			dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
			linkedPayrollCount: payroll.filter(p => p.event_id || p.source_event_id).length,
			unlinkedPayrollCount: payroll.filter(p => !p.event_id && !p.source_event_id).length
		}

		return {
			summary,
			topArtists,
			statusData,
			monthlyData,
			venueData,
			programData
		}
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}

	function getStatusColor(status: string) {
		const colors: Record<string, string> = {
			'completed': 'bg-success',
			'confirmed': 'bg-primary',
			'planned': 'bg-warning',
			'cancelled': 'bg-error',
			'in_progress': 'bg-info'
		}
		return colors[status] || 'bg-base-300'
	}

	function exportToCSV() {
		if (!reportData.summary) return

		// Create CSV content
		const lines: string[] = []

		// Summary section
		lines.push('Performance Summary Report')
		lines.push(`Date Range,${reportData.summary.dateRange}`)
		lines.push('')
		lines.push('Summary Metrics')
		lines.push(`Total Events,${reportData.summary.totalEvents}`)
		lines.push(`Total Artists,${reportData.summary.totalArtists}`)
		lines.push(`Total Hours,${reportData.summary.totalHours.toFixed(1)}`)
		lines.push(`Total Payroll,${reportData.summary.totalPayroll.toFixed(2)}`)
		lines.push(`Linked Payroll Records,${reportData.summary.linkedPayrollCount}`)
		lines.push(`Unlinked Payroll Records,${reportData.summary.unlinkedPayrollCount}`)
		lines.push('')

		// Top Artists
		lines.push('Top Artists by Events')
		lines.push('Artist,Events,Total Hours,Total Pay,Avg Hours/Event')
		reportData.topArtists.forEach((a: any) => {
			lines.push(`"${a.name}",${a.eventCount},${a.totalHours.toFixed(1)},${a.totalPay.toFixed(2)},${a.avgHoursPerEvent.toFixed(1)}`)
		})
		lines.push('')

		// Status breakdown
		lines.push('Event Status Breakdown')
		lines.push('Status,Count')
		reportData.statusData.forEach((s: any) => {
			lines.push(`${s.status},${s.count}`)
		})
		lines.push('')

		// Venue utilization
		lines.push('Venue Utilization')
		lines.push('Venue,Events,Total Hours')
		reportData.venueData.forEach((v: any) => {
			lines.push(`"${v.name}",${v.eventCount},${v.totalHours.toFixed(1)}`)
		})
		lines.push('')

		// Program distribution
		lines.push('Program Distribution')
		lines.push('Program,Events,Total Hours')
		reportData.programData.forEach((p: any) => {
			lines.push(`"${p.name}",${p.eventCount},${p.totalHours.toFixed(1)}`)
		})

		const csvContent = lines.join('\n')
		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `performance-summary-${startDate}-to-${endDate}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	// Status options
	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">Performance Summary Report</h2>
			<p class="text-sm opacity-60">Analyze events, artist performance, and operational metrics with payroll integration</p>
		</div>
		<div class="flex gap-2">
			{#if !showFilters && Object.keys(reportData).length > 0}
				<button class="btn btn-outline btn-sm" onclick={() => showFilters = true}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
					</svg>
					Show Filters
				</button>
				<button class="btn btn-outline btn-sm" onclick={exportToCSV}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
					</svg>
					Export CSV
				</button>
			{/if}
		</div>
	</div>

	<!-- Filters (Collapsible) -->
	{#if showFilters}
		<div class="card bg-base-100 border border-base-300 transition-all duration-300">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Report Filters</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
					<!-- Date Range -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Start Date</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={startDate}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">End Date</span>
						</label>
						<input
							type="date"
							class="input input-bordered"
							bind:value={endDate}
						/>
					</div>

					<!-- Status Filter -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Event Status</span>
						</label>
						<select class="select select-bordered" bind:value={statusFilter}>
							{#each statusOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<!-- Venue Filter -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Venue</span>
						</label>
						<select class="select select-bordered" bind:value={venueFilter}>
							<option value="all">All Venues</option>
							{#each venues as venue}
								<option value={venue.id}>{venue.name}</option>
							{/each}
						</select>
					</div>

					<!-- Program Filter -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Program</span>
						</label>
						<select class="select select-bordered" bind:value={programFilter}>
							<option value="all">All Programs</option>
							{#each programs as program}
								<option value={program.id}>{program.title}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="flex justify-end mt-4">
					<button
						class="btn btn-primary"
						onclick={generateReport}
						disabled={loading}
					>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
							</svg>
						{/if}
						Generate Report
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if error}
		<div class="alert alert-error">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
			<p class="mt-4">Generating performance report...</p>
		</div>
	{:else if Object.keys(reportData).length > 0 && reportData.summary}
		<!-- Event-Payroll Integration Status -->
		<div class="alert alert-info">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>
				<strong>Event-Payroll Integration:</strong>
				{reportData.summary.linkedPayrollCount} payroll records linked to events,
				{reportData.summary.unlinkedPayrollCount} unlinked records in date range
			</span>
		</div>

		<!-- Visual Charts Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Event Status Distribution -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Event Status Distribution</h3>
					{#if reportData.statusData.length > 0}
						<div class="space-y-3">
							{#each reportData.statusData as status}
								{@const percentage = (status.count / reportData.summary.totalEvents) * 100}
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="w-4 h-4 rounded {getStatusColor(status.status)}"></div>
										<span class="text-sm font-medium capitalize">{status.status.replace('_', ' ')}</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="w-32 bg-base-300 rounded-full h-2">
											<div class="h-2 rounded-full {getStatusColor(status.status)}" style="width: {percentage}%"></div>
										</div>
										<span class="text-sm font-mono">{status.count} ({percentage.toFixed(1)}%)</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-center opacity-60">No status data available</p>
					{/if}
				</div>
			</div>

			<!-- Monthly Trend -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Monthly Event Trend</h3>
					{#if reportData.monthlyData.length > 0}
						<div class="h-48 flex items-end justify-between gap-2 px-2">
							{#each reportData.monthlyData as month}
								{@const maxEvents = Math.max(...reportData.monthlyData.map((m: any) => m.eventCount))}
								{@const height = maxEvents > 0 ? (month.eventCount / maxEvents) * 100 : 0}
								<div class="flex flex-col items-center flex-1">
									<div class="text-xs font-mono mb-1">{month.eventCount}</div>
									<div class="bg-primary w-full rounded-t min-h-[4px]" style="height: {Math.max(height, 4)}%"></div>
									<div class="text-xs mt-1 text-center whitespace-nowrap">{month.month}</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-center opacity-60">No monthly data available</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Summary Metrics -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Events</div>
				<div class="stat-value text-2xl">{reportData.summary.totalEvents}</div>
				<div class="stat-desc">{reportData.summary.dateRange}</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Active Artists</div>
				<div class="stat-value text-2xl">{reportData.summary.totalArtists}</div>
				<div class="stat-desc">{reportData.summary.avgEventsPerArtist.toFixed(1)} events/artist</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Hours</div>
				<div class="stat-value text-2xl">{reportData.summary.totalHours.toFixed(0)}</div>
				<div class="stat-desc">{reportData.summary.avgHoursPerEvent.toFixed(1)} hours/event</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Payroll</div>
				<div class="stat-value text-2xl">{formatCurrency(reportData.summary.totalPayroll)}</div>
				<div class="stat-desc">{reportData.summary.totalEvents > 0 ? formatCurrency(reportData.summary.totalPayroll / reportData.summary.totalEvents) : '$0'} per event</div>
			</div>
		</div>

		<!-- Detailed Tables -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Top Artists -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Top Performing Artists</h3>
					{#if reportData.topArtists.length > 0}
						<div class="overflow-x-auto">
							<table class="table table-zebra table-sm">
								<thead>
									<tr>
										<th>Artist</th>
										<th>Events</th>
										<th>Hours</th>
										<th>Pay</th>
									</tr>
								</thead>
								<tbody>
									{#each reportData.topArtists as artist}
										<tr>
											<td class="font-medium">{artist.name}</td>
											<td>
												<div class="badge badge-primary">{artist.eventCount}</div>
											</td>
											<td class="font-mono">{artist.totalHours.toFixed(1)}</td>
											<td class="font-mono">{formatCurrency(artist.totalPay)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="text-center opacity-60">No artist data available</p>
					{/if}
				</div>
			</div>

			<!-- Venue Utilization -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Venue Utilization</h3>
					{#if reportData.venueData.length > 0}
						<div class="overflow-x-auto">
							<table class="table table-zebra table-sm">
								<thead>
									<tr>
										<th>Venue</th>
										<th>Events</th>
										<th>Total Hours</th>
										<th>Avg Hours</th>
									</tr>
								</thead>
								<tbody>
									{#each reportData.venueData as venue}
										<tr>
											<td class="font-medium">{venue.name}</td>
											<td>
												<div class="badge badge-secondary">{venue.eventCount}</div>
											</td>
											<td class="font-mono">{venue.totalHours.toFixed(1)}</td>
											<td class="font-mono">{venue.eventCount > 0 ? (venue.totalHours / venue.eventCount).toFixed(1) : '0.0'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="text-center opacity-60">No venue data available</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Program Distribution -->
		{#if reportData.programData.length > 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Program Distribution</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{#each reportData.programData as program}
							{@const percentage = reportData.summary.totalEvents > 0 ? (program.eventCount / reportData.summary.totalEvents) * 100 : 0}
							<div class="bg-base-200 rounded-lg p-4">
								<div class="flex items-center justify-between mb-2">
									<h4 class="font-medium truncate" title={program.name}>{program.name}</h4>
									<div class="badge badge-accent">{program.eventCount}</div>
								</div>
								<div class="w-full bg-base-300 rounded-full h-2">
									<div class="bg-accent h-2 rounded-full" style="width: {percentage}%"></div>
								</div>
								<div class="flex justify-between text-sm opacity-60 mt-1">
									<span>{percentage.toFixed(1)}% of events</span>
									<span>{program.totalHours.toFixed(1)} hrs</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="text-center py-12 bg-base-200 rounded-lg">
			<Theater class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-4 text-lg">No performance data available</p>
			<p class="text-sm opacity-60">Generate a report to view performance metrics</p>
		</div>
	{/if}
</div>
