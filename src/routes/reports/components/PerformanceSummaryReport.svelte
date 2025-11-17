<!-- 

TODO: Performance Summary Report - Database Schema Issues

This component is currently commented out because the database schema 
for programs relation is not yet designed. The following issues need to be resolved:

1. Column 'phwb_programs_1.name' does not exist - need to check programs table schema
2. Events-Programs relation needs to be properly defined
3. Venues-Events relation may need adjustment
4. Performance metrics calculation needs proper data structure

Once the database schema is updated, this component can be uncommented and used.

-->

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
			
			// Load programs - COMMENTED OUT due to schema issues
			// const { data: programsData } = await supabase
			// 	.from('phwb_programs')
			// 	.select('id, name')
			// 	.order('name')
			// programs = programsData || []
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
		showFilters = false // Minimize filters
		
		try {
			// Build base query for events - COMMENTED OUT due to schema issues
			// let eventsQuery = supabase
			// 	.from('phwb_events')
			// 	.select(`
			// 		*,
			// 		venues:venue(id, name),
			// 		programs:program(id, name)
			// 	`)
			// 	.gte('date', startDate)
			// 	.lte('date', endDate)
			// 	.order('date', { ascending: true })
			
			// Apply filters - COMMENTED OUT due to schema issues
			// if (statusFilter !== 'all') {
			// 	eventsQuery = eventsQuery.eq('status', statusFilter)
			// }
			// if (venueFilter !== 'all') {
			// 	eventsQuery = eventsQuery.eq('venue', parseInt(venueFilter))
			// }
			// if (programFilter !== 'all') {
			// 	eventsQuery = eventsQuery.eq('program', parseInt(programFilter))
			// }
			// 
			// const { data: eventsData, error: eventsError } = await eventsQuery
			// if (eventsError) throw eventsError
			
			// Temporary placeholder - this will be implemented once schema is ready
			throw new Error('Performance Summary Report is temporarily disabled. Database schema for programs relation needs to be designed first.')
			
			// TODO: Uncomment and fix the following once schema is ready:
			// Get payroll data for the same period
			// let payrollQuery = supabase
			// 	.from('phwb_payroll')
			// 	.select(`
			// 		*,
			// 		artists:artist_id(id, full_name),
			// 		venues:venue_id(id, name)
			// 	`)
			// 	.gte('event_date', startDate)
			// 	.lte('event_date', endDate)
			// 
			// if (statusFilter !== 'all') {
			// 	// Map event status to payroll status
			// 	const statusMap: Record<string, string> = {
			// 		'completed': 'Completed',
			// 		'cancelled': 'Cancelled',
			// 		'confirmed': 'Approved',
			// 		'planned': 'Planned'
			// 	}
			// 	if (statusMap[statusFilter]) {
			// 		payrollQuery = payrollQuery.eq('status', statusMap[statusFilter])
			// 	}
			// }
			// 
			// const { data: payrollData, error: payrollError } = await payrollQuery
			// if (payrollError) throw payrollError
			// 
			// // Process the data
			// const processedData = processPerformanceData(eventsData || [], payrollData || [])
			// reportData = processedData
			
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate report'
			console.error('Performance report generation error:', err)
			showFilters = true // Show filters again on error
		} finally {
			loading = false
		}
	}
	
	function processPerformanceData(events: any[], payroll: any[]) {
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
			
			// Venue utilization
			if (event.venues) {
				const venueName = event.venues.name || 'Unknown Venue'
				if (!venueUtilization.has(venueName)) {
					venueUtilization.set(venueName, { name: venueName, eventCount: 0, totalHours: 0 })
				}
				venueUtilization.get(venueName)!.eventCount++
			}
			
			// Program distribution
			if (event.programs) {
				const programName = event.programs.name || 'Unknown Program'
				if (!programDistribution.has(programName)) {
					programDistribution.set(programName, { name: programName, eventCount: 0, totalHours: 0 })
				}
				programDistribution.get(programName)!.eventCount++
			}
		})
		
		// Process payroll for artist and financial data
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
			
			// Add to monthly trend
			const eventDate = new Date(record.event_date)
			const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`
			const monthData = monthlyTrend.get(monthKey)
			if (monthData) {
				monthData.totalHours += hours
				monthData.totalPay += pay
			}
			
			// Add to venue utilization
			if (record.venues) {
				const venueName = record.venues.name || 'Unknown Venue'
				const venueData = venueUtilization.get(venueName)
				if (venueData) {
					venueData.totalHours += hours
				}
			}
		})
		
		// Convert maps to sorted arrays
		const topArtists = Array.from(artistParticipation.values())
			.sort((a, b) => b.eventCount - a.eventCount)
			.slice(0, 10)
		
		const statusData = Array.from(statusBreakdown.entries())
			.map(([status, count]) => ({ status, count }))
			.sort((a, b) => b.count - a.count)
		
		const monthlyData = Array.from(monthlyTrend.values())
			.sort((a, b) => a.month.localeCompare(b.month))
		
		const venueData = Array.from(venueUtilization.values())
			.sort((a, b) => b.eventCount - a.eventCount)
			.slice(0, 10)
		
		const programData = Array.from(programDistribution.values())
			.sort((a, b) => b.eventCount - a.eventCount)
		
		// Calculate summary metrics
		const summary = {
			totalEvents: events.length,
			totalArtists: artistParticipation.size,
			totalHours: Array.from(artistParticipation.values()).reduce((sum, artist) => sum + artist.totalHours, 0),
			totalPayroll: Array.from(artistParticipation.values()).reduce((sum, artist) => sum + artist.totalPay, 0),
			avgEventsPerArtist: artistParticipation.size > 0 ? events.length / artistParticipation.size : 0,
			avgHoursPerEvent: events.length > 0 ? Array.from(artistParticipation.values()).reduce((sum, artist) => sum + artist.totalHours, 0) / events.length : 0,
			dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`
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
		// Implementation for CSV export
		console.log('Export CSV functionality to be implemented')
	}
	
	// Status options
	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">Performance Summary Report</h2>
			<p class="text-sm opacity-60">Analyze artist performance, event success, and operational metrics</p>
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
							<span class="label-text font-medium">Status</span>
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
								<option value={program.id}>{program.name}</option>
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
	{:else if Object.keys(reportData).length > 0}
		<!-- Visual Charts Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Event Status Distribution -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Event Status Distribution</h3>
					<div class="space-y-3">
						{#each reportData.statusData as status}
							{@const percentage = (status.count / reportData.summary.totalEvents) * 100}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="w-4 h-4 rounded {getStatusColor(status.status)}"></div>
									<span class="text-sm font-medium capitalize">{status.status}</span>
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
				</div>
			</div>
			
			<!-- Monthly Trend -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Monthly Event Trend</h3>
					<div class="h-48 flex items-end justify-between gap-2">
						{#each reportData.monthlyData as month}
							{@const maxEvents = Math.max(...reportData.monthlyData.map(m => m.eventCount))}
							{@const height = maxEvents > 0 ? (month.eventCount / maxEvents) * 100 : 0}
							<div class="flex flex-col items-center flex-1">
								<div class="text-xs font-mono mb-1">{month.eventCount}</div>
								<div class="bg-primary w-full rounded-t" style="height: {height}%"></div>
								<div class="text-xs mt-1 transform -rotate-45 origin-top-left">{month.month}</div>
							</div>
						{/each}
					</div>
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
				<div class="stat-desc">{formatCurrency(reportData.summary.totalPayroll / reportData.summary.totalEvents)} per event</div>
			</div>
		</div>
		
		<!-- Detailed Tables -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Top Artists -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Top Performing Artists</h3>
					<div class="overflow-x-auto">
						<table class="table table-zebra table-sm">
							<thead>
								<tr>
									<th>Artist</th>
									<th>Events</th>
									<th>Hours</th>
									<th>Avg Hours</th>
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
										<td class="font-mono">{artist.avgHoursPerEvent.toFixed(1)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			
			<!-- Venue Utilization -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Venue Utilization</h3>
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
				</div>
			</div>
		</div>
		
		<!-- Program Distribution -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Program Distribution</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each reportData.programData as program}
						{@const percentage = (program.eventCount / reportData.summary.totalEvents) * 100}
						<div class="bg-base-200 rounded-lg p-4">
							<div class="flex items-center justify-between mb-2">
								<h4 class="font-medium">{program.name}</h4>
								<div class="badge badge-accent">{program.eventCount}</div>
							</div>
							<div class="w-full bg-base-300 rounded-full h-2">
								<div class="bg-accent h-2 rounded-full" style="width: {percentage}%"></div>
							</div>
							<div class="text-sm opacity-60 mt-1">{percentage.toFixed(1)}% of events</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-12 bg-base-200 rounded-lg">
			<Theater class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-4 text-lg">No performance data available</p>
			<p class="text-sm opacity-60">Generate a report to view performance metrics</p>
		</div>
	{/if}
</div>