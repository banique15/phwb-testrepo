<script lang="ts">
	import { onMount } from 'svelte'
	import { DollarSign, TrendingUp, TrendingDown } from 'lucide-svelte'
	import { supabase } from '$lib/supabase'

	// Report state
	let loading = $state(false)
	let error = $state('')
	let reportData = $state<any>({})
	let showFilters = $state(true)

	// Filter state
	let startDate = $state('')
	let endDate = $state('')
	let groupBy = $state<'program' | 'venue' | 'month'>('month')
	let statusFilter = $state('all')

	// Available options
	let programs = $state<any[]>([])
	let venues = $state<any[]>([])

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
			const [programsRes, venuesRes] = await Promise.all([
				supabase.from('phwb_programs').select('id, title').order('title'),
				supabase.from('phwb_venues').select('id, name').order('name')
			])
			programs = programsRes.data || []
			venues = venuesRes.data || []
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
			// Fetch events with revenue data (total_fee)
			let eventsQuery = supabase
				.from('phwb_events')
				.select('*')
				.gte('date', startDate)
				.lte('date', endDate)

			if (statusFilter !== 'all') {
				eventsQuery = eventsQuery.eq('status', statusFilter)
			}

			const { data: eventsData, error: eventsError } = await eventsQuery
			if (eventsError) throw eventsError

			// Fetch payroll data (costs)
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

			// Get venue and program maps
			const venueIds = [...new Set((eventsData || []).map(e => e.venue).filter(Boolean))]
			const programIds = [...new Set((eventsData || []).map(e => e.program).filter(Boolean))]

			let venueMap: Record<number, string> = {}
			if (venueIds.length > 0) {
				const { data } = await supabase.from('phwb_venues').select('id, name').in('id', venueIds)
				venueMap = Object.fromEntries((data || []).map(v => [v.id, v.name]))
			}

			let programMap: Record<number, string> = {}
			if (programIds.length > 0) {
				const { data } = await supabase.from('phwb_programs').select('id, title').in('id', programIds)
				programMap = Object.fromEntries((data || []).map(p => [p.id, p.title]))
			}

			// Process data
			const processedData = processFinancialData(
				eventsData || [],
				payrollData || [],
				venueMap,
				programMap,
				groupBy
			)
			reportData = processedData

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate report'
			console.error('Financial report generation error:', err)
			showFilters = true
		} finally {
			loading = false
		}
	}

	function processFinancialData(
		events: any[],
		payroll: any[],
		venueMap: Record<number, string>,
		programMap: Record<number, string>,
		grouping: 'program' | 'venue' | 'month'
	) {
		// Create event-to-payroll mapping
		const eventPayrollMap = new Map<number, any[]>()
		payroll.forEach(p => {
			const eventId = p.event_id || p.source_event_id
			if (eventId) {
				if (!eventPayrollMap.has(eventId)) eventPayrollMap.set(eventId, [])
				eventPayrollMap.get(eventId)!.push(p)
			}
		})

		// Group data
		const groups = new Map<string, {
			name: string,
			eventCount: number,
			revenue: number,
			payrollCost: number,
			hoursWorked: number,
			artistCount: Set<string>
		}>()

		// Track unlinked payroll
		let unlinkedPayrollCost = 0
		let unlinkedPayrollHours = 0
		const processedPayrollIds = new Set<number>()

		events.forEach(event => {
			let groupKey: string
			let groupName: string

			switch (grouping) {
				case 'program':
					groupKey = event.program?.toString() || 'unassigned'
					groupName = event.program ? (programMap[event.program] || 'Unknown Program') : 'No Program'
					break
				case 'venue':
					groupKey = event.venue?.toString() || 'unassigned'
					groupName = event.venue ? (venueMap[event.venue] || 'Unknown Venue') : 'No Venue'
					break
				case 'month':
				default:
					const eventDate = new Date(event.date)
					groupKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`
					groupName = eventDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
					break
			}

			if (!groups.has(groupKey)) {
				groups.set(groupKey, {
					name: groupName,
					eventCount: 0,
					revenue: 0,
					payrollCost: 0,
					hoursWorked: 0,
					artistCount: new Set()
				})
			}

			const group = groups.get(groupKey)!
			group.eventCount++
			group.revenue += event.total_fee || 0

			// Add linked payroll costs
			const linkedPayroll = eventPayrollMap.get(event.id) || []
			linkedPayroll.forEach(p => {
				const cost = p.total_pay || (p.hours || 0) * (p.rate || 0) + (p.additional_pay || 0)
				group.payrollCost += cost
				group.hoursWorked += p.hours || 0
				if (p.artist_id) group.artistCount.add(p.artist_id)
				processedPayrollIds.add(p.id)
			})
		})

		// Calculate unlinked payroll
		payroll.forEach(p => {
			if (!processedPayrollIds.has(p.id)) {
				const cost = p.total_pay || (p.hours || 0) * (p.rate || 0) + (p.additional_pay || 0)
				unlinkedPayrollCost += cost
				unlinkedPayrollHours += p.hours || 0
			}
		})

		// Convert to array and sort
		const groupedData = Array.from(groups.entries())
			.map(([key, data]) => ({
				key,
				name: data.name,
				eventCount: data.eventCount,
				revenue: data.revenue,
				payrollCost: data.payrollCost,
				profit: data.revenue - data.payrollCost,
				profitMargin: data.revenue > 0 ? ((data.revenue - data.payrollCost) / data.revenue) * 100 : 0,
				hoursWorked: data.hoursWorked,
				artistCount: data.artistCount.size,
				avgCostPerEvent: data.eventCount > 0 ? data.payrollCost / data.eventCount : 0,
				avgRevenuePerEvent: data.eventCount > 0 ? data.revenue / data.eventCount : 0
			}))
			.sort((a, b) => {
				if (grouping === 'month') return a.key.localeCompare(b.key)
				return b.revenue - a.revenue
			})

		// Calculate totals
		const totalRevenue = groupedData.reduce((sum, g) => sum + g.revenue, 0)
		const totalPayrollCost = groupedData.reduce((sum, g) => sum + g.payrollCost, 0) + unlinkedPayrollCost
		const totalEvents = groupedData.reduce((sum, g) => sum + g.eventCount, 0)
		const totalHours = groupedData.reduce((sum, g) => sum + g.hoursWorked, 0) + unlinkedPayrollHours

		const summary = {
			totalRevenue,
			totalPayrollCost,
			totalProfit: totalRevenue - totalPayrollCost,
			profitMargin: totalRevenue > 0 ? ((totalRevenue - totalPayrollCost) / totalRevenue) * 100 : 0,
			totalEvents,
			totalHours,
			avgRevenuePerEvent: totalEvents > 0 ? totalRevenue / totalEvents : 0,
			avgCostPerEvent: totalEvents > 0 ? totalPayrollCost / totalEvents : 0,
			linkedPayrollRecords: processedPayrollIds.size,
			unlinkedPayrollRecords: payroll.length - processedPayrollIds.size,
			unlinkedPayrollCost,
			dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`
		}

		return {
			summary,
			groupedData,
			grouping
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
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount)
	}

	function exportToCSV() {
		if (!reportData.summary) return

		const lines: string[] = []

		lines.push('Financial Overview Report')
		lines.push(`Date Range,${reportData.summary.dateRange}`)
		lines.push(`Grouped By,${reportData.grouping}`)
		lines.push('')

		lines.push('Summary')
		lines.push(`Total Revenue,${reportData.summary.totalRevenue.toFixed(2)}`)
		lines.push(`Total Payroll Cost,${reportData.summary.totalPayrollCost.toFixed(2)}`)
		lines.push(`Net Profit,${reportData.summary.totalProfit.toFixed(2)}`)
		lines.push(`Profit Margin,${reportData.summary.profitMargin.toFixed(1)}%`)
		lines.push(`Total Events,${reportData.summary.totalEvents}`)
		lines.push(`Total Hours,${reportData.summary.totalHours.toFixed(1)}`)
		lines.push(`Linked Payroll Records,${reportData.summary.linkedPayrollRecords}`)
		lines.push(`Unlinked Payroll Cost,${reportData.summary.unlinkedPayrollCost.toFixed(2)}`)
		lines.push('')

		lines.push('Breakdown by ' + reportData.grouping)
		lines.push('Name,Events,Revenue,Payroll Cost,Profit,Margin %,Hours,Artists')
		reportData.groupedData.forEach((g: any) => {
			lines.push(`"${g.name}",${g.eventCount},${g.revenue.toFixed(2)},${g.payrollCost.toFixed(2)},${g.profit.toFixed(2)},${g.profitMargin.toFixed(1)},${g.hoursWorked.toFixed(1)},${g.artistCount}`)
		})

		const csvContent = lines.join('\n')
		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `financial-overview-${startDate}-to-${endDate}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]

	const groupByOptions = [
		{ value: 'month', label: 'By Month' },
		{ value: 'program', label: 'By Program' },
		{ value: 'venue', label: 'By Venue' }
	]
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">Financial Overview Report</h2>
			<p class="text-sm opacity-60">Analyze revenue, payroll costs, and profitability across events</p>
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

	<!-- Filters -->
	{#if showFilters}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="card-title text-lg mb-4">Report Filters</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Start Date</span>
						</label>
						<input type="date" class="input input-bordered" bind:value={startDate} />
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">End Date</span>
						</label>
						<input type="date" class="input input-bordered" bind:value={endDate} />
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Group By</span>
						</label>
						<select class="select select-bordered" bind:value={groupBy}>
							{#each groupByOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

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
				</div>

				<div class="flex justify-end mt-4">
					<button class="btn btn-primary" onclick={generateReport} disabled={loading}>
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
			<p class="mt-4">Generating financial report...</p>
		</div>
	{:else if reportData.summary}
		<!-- Unlinked Payroll Warning -->
		{#if reportData.summary.unlinkedPayrollRecords > 0}
			<div class="alert alert-warning">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<span>
					<strong>{reportData.summary.unlinkedPayrollRecords}</strong> payroll records ({formatCurrency(reportData.summary.unlinkedPayrollCost)}) are not linked to events.
					These costs are included in totals but not attributed to specific {reportData.grouping}s.
				</span>
			</div>
		{/if}

		<!-- Summary Cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="stat bg-success/10 rounded-lg p-4">
				<div class="stat-title text-xs">Total Revenue</div>
				<div class="stat-value text-2xl text-success">{formatCurrency(reportData.summary.totalRevenue)}</div>
				<div class="stat-desc">{formatCurrency(reportData.summary.avgRevenuePerEvent)} per event</div>
			</div>

			<div class="stat bg-error/10 rounded-lg p-4">
				<div class="stat-title text-xs">Total Payroll Cost</div>
				<div class="stat-value text-2xl text-error">{formatCurrency(reportData.summary.totalPayrollCost)}</div>
				<div class="stat-desc">{formatCurrency(reportData.summary.avgCostPerEvent)} per event</div>
			</div>

			<div class="stat {reportData.summary.totalProfit >= 0 ? 'bg-primary/10' : 'bg-warning/10'} rounded-lg p-4">
				<div class="stat-title text-xs flex items-center gap-1">
					Net Profit
					{#if reportData.summary.totalProfit >= 0}
						<TrendingUp class="w-3 h-3 text-success" />
					{:else}
						<TrendingDown class="w-3 h-3 text-error" />
					{/if}
				</div>
				<div class="stat-value text-2xl {reportData.summary.totalProfit >= 0 ? 'text-primary' : 'text-warning'}">
					{formatCurrency(reportData.summary.totalProfit)}
				</div>
				<div class="stat-desc">{reportData.summary.profitMargin.toFixed(1)}% margin</div>
			</div>

			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Events & Hours</div>
				<div class="stat-value text-2xl">{reportData.summary.totalEvents}</div>
				<div class="stat-desc">{reportData.summary.totalHours.toFixed(0)} total hours</div>
			</div>
		</div>

		<!-- Visual Chart -->
		{#if reportData.groupedData.length > 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">
						{#if reportData.grouping === 'month'}Monthly{:else if reportData.grouping === 'program'}Program{:else}Venue{/if} Revenue vs Cost
					</h3>
					<div class="h-64 flex items-end justify-between gap-4 px-4">
						{#each reportData.groupedData.slice(0, 8) as group}
							{@const maxValue = Math.max(...reportData.groupedData.slice(0, 8).map((g: any) => Math.max(g.revenue, g.payrollCost)))}
							{@const revenueHeight = maxValue > 0 ? (group.revenue / maxValue) * 100 : 0}
							{@const costHeight = maxValue > 0 ? (group.payrollCost / maxValue) * 100 : 0}
							<div class="flex flex-col items-center flex-1 gap-1">
								<div class="flex gap-1 items-end h-48">
									<div class="bg-success w-6 rounded-t min-h-[4px]" style="height: {Math.max(revenueHeight, 2)}%" title="Revenue: {formatCurrency(group.revenue)}"></div>
									<div class="bg-error w-6 rounded-t min-h-[4px]" style="height: {Math.max(costHeight, 2)}%" title="Cost: {formatCurrency(group.payrollCost)}"></div>
								</div>
								<div class="text-xs text-center truncate w-full" title={group.name}>
									{group.name.length > 10 ? group.name.slice(0, 10) + '...' : group.name}
								</div>
							</div>
						{/each}
					</div>
					<div class="flex justify-center gap-6 mt-4">
						<div class="flex items-center gap-2">
							<div class="w-4 h-4 bg-success rounded"></div>
							<span class="text-sm">Revenue</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-4 h-4 bg-error rounded"></div>
							<span class="text-sm">Payroll Cost</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Detailed Table -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-0">
				<div class="p-4 border-b border-base-300">
					<h3 class="card-title text-lg">
						Breakdown by {reportData.grouping === 'month' ? 'Month' : reportData.grouping === 'program' ? 'Program' : 'Venue'}
					</h3>
				</div>
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>{reportData.grouping === 'month' ? 'Month' : reportData.grouping === 'program' ? 'Program' : 'Venue'}</th>
								<th>Events</th>
								<th>Revenue</th>
								<th>Payroll Cost</th>
								<th>Profit</th>
								<th>Margin</th>
								<th>Hours</th>
								<th>Artists</th>
							</tr>
						</thead>
						<tbody>
							{#each reportData.groupedData as group}
								<tr>
									<td class="font-medium">{group.name}</td>
									<td><div class="badge badge-outline">{group.eventCount}</div></td>
									<td class="font-mono text-success">{formatCurrency(group.revenue)}</td>
									<td class="font-mono text-error">{formatCurrency(group.payrollCost)}</td>
									<td class="font-mono {group.profit >= 0 ? 'text-primary' : 'text-warning'}">{formatCurrency(group.profit)}</td>
									<td>
										<div class="badge {group.profitMargin >= 20 ? 'badge-success' : group.profitMargin >= 0 ? 'badge-warning' : 'badge-error'}">
											{group.profitMargin.toFixed(1)}%
										</div>
									</td>
									<td class="font-mono">{group.hoursWorked.toFixed(1)}</td>
									<td class="font-mono">{group.artistCount}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="font-bold bg-base-200">
								<td>TOTAL</td>
								<td>{reportData.summary.totalEvents}</td>
								<td class="text-success">{formatCurrency(reportData.summary.totalRevenue)}</td>
								<td class="text-error">{formatCurrency(reportData.summary.totalPayrollCost)}</td>
								<td class="{reportData.summary.totalProfit >= 0 ? 'text-primary' : 'text-warning'}">{formatCurrency(reportData.summary.totalProfit)}</td>
								<td>
									<div class="badge {reportData.summary.profitMargin >= 20 ? 'badge-success' : reportData.summary.profitMargin >= 0 ? 'badge-warning' : 'badge-error'}">
										{reportData.summary.profitMargin.toFixed(1)}%
									</div>
								</td>
								<td>{reportData.summary.totalHours.toFixed(1)}</td>
								<td>-</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-12 bg-base-200 rounded-lg">
			<DollarSign class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-4 text-lg">No financial data available</p>
			<p class="text-sm opacity-60">Generate a report to view revenue and cost analysis</p>
		</div>
	{/if}
</div>
