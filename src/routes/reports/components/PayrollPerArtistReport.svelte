<script lang="ts">
	import { onMount } from 'svelte'
	import { BarChart } from 'lucide-svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import { artistsStore } from '$lib/stores/artists'
	import { supabase } from '$lib/supabase'
	import type { Payroll } from '$lib/schemas/payroll'
	
	// Report state
	let loading = $state(false)
	let error = $state('')
	let reportData = $state<any[]>([])
	let summary = $state<any>({})
	let showFilters = $state(true)
	
	// Filter state
	let startDate = $state('')
	let endDate = $state('')
	let statusFilter = $state('all')
	let paymentTypeFilter = $state('all')
	let employeeTypeFilter = $state('all')
	let topArtistsCount = $state(5)
	
	// Default to current year
	onMount(() => {
		const now = new Date()
		const yearStart = new Date(now.getFullYear(), 0, 1)
		const yearEnd = new Date(now.getFullYear(), 11, 31)
		
		startDate = yearStart.toISOString().split('T')[0]
		endDate = yearEnd.toISOString().split('T')[0]
		
		generateReport()
	})
	
	async function generateReport() {
		if (!startDate || !endDate) {
			error = 'Please select both start and end dates'
			return
		}
		
		loading = true
		error = ''
		showFilters = false // Minimize filters
		
		try {
			// Build query filters
			let query = supabase
				.from('phwb_payroll')
				.select(`
					*,
					artists:artist_id(id, full_name, legal_first_name, legal_last_name, email),
					venues:venue_id(id, name)
				`)
				.gte('event_date', startDate)
				.lte('event_date', endDate)
				.order('event_date', { ascending: true })
			
			// Apply filters
			if (statusFilter !== 'all') {
				query = query.eq('status', statusFilter)
			}
			
			if (paymentTypeFilter !== 'all') {
				query = query.eq('payment_type', paymentTypeFilter)
			}
			
			if (employeeTypeFilter !== 'all') {
				query = query.eq('employee_contractor_status', employeeTypeFilter)
			}
			
			const { data, error: queryError } = await query
			
			if (queryError) throw queryError
			
			// Group data by artist
			const artistGroups = new Map<string, {
				artist: any,
				records: Payroll[],
				totalHours: number,
				totalPay: number,
				recordCount: number,
				linkedToEvents: number,
				unlinkedRecords: number
			}>()
			
			let totalPayroll = 0
			let totalHours = 0
			let totalRecords = 0
			
			let totalLinkedRecords = 0
			let totalUnlinkedRecords = 0

			data?.forEach(record => {
				const artistId = record.artist_id || 'unknown'
				const artist = record.artists || {
					id: artistId,
					full_name: 'Unknown Artist',
					legal_first_name: '',
					legal_last_name: '',
					email: ''
				}

				if (!artistGroups.has(artistId)) {
					artistGroups.set(artistId, {
						artist,
						records: [],
						totalHours: 0,
						totalPay: 0,
						recordCount: 0,
						linkedToEvents: 0,
						unlinkedRecords: 0
					})
				}

				const group = artistGroups.get(artistId)!
				group.records.push(record)
				group.totalHours += record.hours || 0
				group.totalPay += record.total_pay || (record.hours || 0) * (record.rate || 0) + (record.additional_pay || 0)
				group.recordCount++

				// Track event linkage
				const isLinked = record.event_id || record.source_event_id
				if (isLinked) {
					group.linkedToEvents++
					totalLinkedRecords++
				} else {
					group.unlinkedRecords++
					totalUnlinkedRecords++
				}

				totalPayroll += group.totalPay
				totalHours += record.hours || 0
				totalRecords++
			})
			
			// Convert to array and sort by total pay (descending)
			reportData = Array.from(artistGroups.values())
				.sort((a, b) => b.totalPay - a.totalPay)
			
			// Calculate summary
			summary = {
				totalArtists: reportData.length,
				totalPayroll: totalPayroll,
				totalHours: totalHours,
				totalRecords: totalRecords,
				averagePayPerArtist: reportData.length > 0 ? totalPayroll / reportData.length : 0,
				averageHoursPerArtist: reportData.length > 0 ? totalHours / reportData.length : 0,
				dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
				linkedRecords: totalLinkedRecords,
				unlinkedRecords: totalUnlinkedRecords
			}
			
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate report'
			console.error('Report generation error:', err)
			showFilters = true // Show filters again on error
		} finally {
			loading = false
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
	
	function exportToCSV() {
		const headers = ['Artist Name', 'Email', 'Total Hours', 'Total Pay', 'Record Count', 'Event Linked', 'Unlinked', 'Average Per Record']
		const rows = reportData.map(item => [
			item.artist.full_name || 'Unknown',
			item.artist.email || '',
			item.totalHours.toFixed(2),
			item.totalPay.toFixed(2),
			item.recordCount,
			item.linkedToEvents,
			item.unlinkedRecords,
			(item.totalPay / item.recordCount).toFixed(2)
		])
		
		const csvContent = [headers, ...rows]
			.map(row => row.map(cell => `"${cell}"`).join(','))
			.join('\n')
		
		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `payroll-per-artist-${startDate}-to-${endDate}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}
	
	// Status options
	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: 'Planned', label: 'Planned' },
		{ value: 'Approved', label: 'Approved' },
		{ value: 'Paid', label: 'Paid' },
		{ value: 'Completed', label: 'Completed' },
		{ value: 'Cancelled', label: 'Cancelled' }
	]
	
	const paymentTypeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'performance', label: 'Performance' },
		{ value: 'training', label: 'Training' },
		{ value: 'special_event', label: 'Special Event' },
		{ value: 'other', label: 'Other' }
	]
	
	const employeeTypeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'employee', label: 'Employee' },
		{ value: 'contractor', label: 'Contractor' },
		{ value: 'roster_artist', label: 'Roster Artist' }
	]
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">Payroll per Artist Report</h2>
			<p class="text-sm opacity-60">View payroll totals by artist within a date range</p>
		</div>
		<div class="flex gap-2">
			{#if !showFilters && reportData.length > 0}
				<button class="btn btn-outline btn-sm" onclick={() => showFilters = true}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
					</svg>
					Show Filters
				</button>
			{/if}
			{#if reportData.length > 0}
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
				
				<!-- Payment Type Filter -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Payment Type</span>
					</label>
					<select class="select select-bordered" bind:value={paymentTypeFilter}>
						{#each paymentTypeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				
				<!-- Employee Type Filter -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Employee Type</span>
					</label>
					<select class="select select-bordered" bind:value={employeeTypeFilter}>
						{#each employeeTypeOptions as option}
							<option value={option.value}>{option.label}</option>
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
			<p class="mt-4">Generating report...</p>
		</div>
	{:else if reportData.length > 0}
		<!-- Visual Chart Section -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<div class="flex items-center justify-between mb-6">
					<h3 class="card-title text-lg">Artist Performance Distribution</h3>
					<div class="form-control">
						<label class="label">
							<span class="label-text text-sm font-medium">Show top:</span>
						</label>
						<select class="select select-bordered w-32" bind:value={topArtistsCount}>
							<option value={3}>3 artists</option>
							<option value={4}>4 artists</option>
							<option value={5}>5 artists</option>
							<option value={8}>8 artists</option>
							<option value={10}>10 artists</option>
						</select>
					</div>
				</div>
				<div class="h-72 flex items-end justify-center gap-6 px-4">
					{#each reportData.slice(0, topArtistsCount) as item}
						{@const maxPay = Math.max(...reportData.slice(0, topArtistsCount).map(r => r.totalPay))}
						{@const height = maxPay > 0 ? (item.totalPay / maxPay) * 180 : 0}
						{@const barWidth = Math.max(50, Math.min(100, 400 / topArtistsCount))}
						<div class="flex flex-col items-center" style="min-width: {barWidth + 40}px">
							<!-- Value at top -->
							<div class="text-xs font-mono mb-3 text-center h-8 flex items-center justify-center">
								<span class="whitespace-nowrap">{formatCurrency(item.totalPay)}</span>
							</div>
							<!-- Bar -->
							<div class="bg-primary rounded-t transition-all duration-500 min-h-[12px] shadow-sm" style="height: {Math.max(height, 12)}px; width: {barWidth}px"></div>
							<!-- Artist name at bottom -->
							<div class="text-xs mt-4 text-center leading-tight" style="width: {barWidth + 40}px">
								<div class="font-medium text-center" title="{item.artist.full_name}">
									{#if item.artist.full_name}
										{@const nameParts = item.artist.full_name.split(' ')}
										{nameParts.slice(0, 2).join(' ')}
									{:else}
										N/A
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
				<div class="text-center text-sm opacity-60 mt-4">
					Showing top {Math.min(reportData.length, topArtistsCount)} artists by total pay
				</div>
			</div>
		</div>
		
		<!-- Summary Cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Artists</div>
				<div class="stat-value text-2xl">{summary.totalArtists}</div>
				<div class="stat-desc">{summary.dateRange}</div>
			</div>
			
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Payroll</div>
				<div class="stat-value text-2xl">{formatCurrency(summary.totalPayroll)}</div>
				<div class="stat-desc">{summary.totalHours.toFixed(1)} hours</div>
			</div>
			
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Average per Artist</div>
				<div class="stat-value text-2xl">{formatCurrency(summary.averagePayPerArtist)}</div>
				<div class="stat-desc">{summary.averageHoursPerArtist.toFixed(1)} hours avg</div>
			</div>
			
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Records</div>
				<div class="stat-value text-2xl">{summary.totalRecords}</div>
				<div class="stat-desc">payroll entries</div>
			</div>
		</div>
		
		<!-- Event Linkage Info -->
		{#if summary.unlinkedRecords > 0}
			<div class="alert alert-info">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>
					<strong>Event Linkage:</strong> {summary.linkedRecords} records linked to events, {summary.unlinkedRecords} unlinked.
					Linked records can be traced back to specific events for detailed analysis.
				</span>
			</div>
		{/if}

		<!-- Report Table -->
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body p-0">
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Artist Name</th>
								<th>Email</th>
								<th>Total Hours</th>
								<th>Total Pay</th>
								<th>Records</th>
								<th>Event Linked</th>
								<th>Avg per Record</th>
							</tr>
						</thead>
						<tbody>
							{#each reportData as item}
								<tr>
									<td>
										<div class="font-medium">{item.artist.full_name || 'Unknown Artist'}</div>
										{#if item.artist.legal_first_name || item.artist.legal_last_name}
											<div class="text-xs opacity-60">
												Legal: {item.artist.legal_first_name} {item.artist.legal_last_name}
											</div>
										{/if}
									</td>
									<td>
										<div class="text-sm">{item.artist.email || 'No email'}</div>
									</td>
									<td>
										<div class="font-mono">{item.totalHours.toFixed(2)}</div>
									</td>
									<td>
										<div class="font-mono font-medium">{formatCurrency(item.totalPay)}</div>
									</td>
									<td>
										<div class="badge badge-outline">{item.recordCount}</div>
									</td>
									<td>
										{#if item.linkedToEvents === item.recordCount}
											<div class="badge badge-success badge-sm">{item.linkedToEvents}/{item.recordCount}</div>
										{:else if item.linkedToEvents > 0}
											<div class="badge badge-warning badge-sm">{item.linkedToEvents}/{item.recordCount}</div>
										{:else}
											<div class="badge badge-ghost badge-sm">0/{item.recordCount}</div>
										{/if}
									</td>
									<td>
										<div class="font-mono">{formatCurrency(item.totalPay / item.recordCount)}</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center py-12 bg-base-200 rounded-lg">
			<BarChart class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-4 text-lg">No payroll data found</p>
			<p class="text-sm opacity-60">Try adjusting your date range or filters</p>
		</div>
	{/if}
</div>