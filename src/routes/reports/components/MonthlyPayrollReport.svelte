<script lang="ts">
	import { onMount } from 'svelte'
	import { Calendar } from 'lucide-svelte'
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
	let employeeTypeFilter = $state('all')
	
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
					artists:artist_id(id, full_name, legal_first_name, legal_last_name),
					venues:venue_id(id, name)
				`)
				.gte('event_date', startDate)
				.lte('event_date', endDate)
				.order('event_date', { ascending: true })
			
			// Apply filters
			if (statusFilter !== 'all') {
				query = query.eq('status', statusFilter)
			}
			
			if (employeeTypeFilter !== 'all') {
				query = query.eq('employee_contractor_status', employeeTypeFilter)
			}
			
			const { data, error: queryError } = await query
			
			if (queryError) throw queryError
			
			// Group data by month and performance type
			const monthlyGroups = new Map<string, {
				month: string,
				monthName: string,
				year: number,
				performanceTypes: Map<string, {
					type: string,
					totalHours: number,
					totalPay: number,
					recordCount: number,
					artistCount: number
				}>,
				totalHours: number,
				totalPay: number,
				recordCount: number
			}>()
			
			let totalPayroll = 0
			let totalHours = 0
			let totalRecords = 0
			const uniqueArtists = new Set<string>()
			
			data?.forEach(record => {
				const eventDate = new Date(record.event_date)
				const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`
				const monthName = eventDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
				const performanceType = record.payment_type || 'other'
				
				if (!monthlyGroups.has(monthKey)) {
					monthlyGroups.set(monthKey, {
						month: monthKey,
						monthName: monthName,
						year: eventDate.getFullYear(),
						performanceTypes: new Map(),
						totalHours: 0,
						totalPay: 0,
						recordCount: 0
					})
				}
				
				const monthGroup = monthlyGroups.get(monthKey)!
				
				if (!monthGroup.performanceTypes.has(performanceType)) {
					monthGroup.performanceTypes.set(performanceType, {
						type: performanceType,
						totalHours: 0,
						totalPay: 0,
						recordCount: 0,
						artistCount: 0
					})
				}
				
				const typeGroup = monthGroup.performanceTypes.get(performanceType)!
				const recordPay = record.total_pay || (record.hours || 0) * (record.rate || 0) + (record.additional_pay || 0)
				
				// Update type group
				typeGroup.totalHours += record.hours || 0
				typeGroup.totalPay += recordPay
				typeGroup.recordCount++
				
				// Update month group
				monthGroup.totalHours += record.hours || 0
				monthGroup.totalPay += recordPay
				monthGroup.recordCount++
				
				// Update totals
				totalPayroll += recordPay
				totalHours += record.hours || 0
				totalRecords++
				
				if (record.artist_id) {
					uniqueArtists.add(record.artist_id)
				}
			})
			
			// Convert to array and sort by month
			reportData = Array.from(monthlyGroups.values())
				.sort((a, b) => a.month.localeCompare(b.month))
			
			// Calculate summary
			summary = {
				totalMonths: reportData.length,
				totalPayroll: totalPayroll,
				totalHours: totalHours,
				totalRecords: totalRecords,
				totalArtists: uniqueArtists.size,
				averagePayPerMonth: reportData.length > 0 ? totalPayroll / reportData.length : 0,
				averageHoursPerMonth: reportData.length > 0 ? totalHours / reportData.length : 0,
				dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`
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
	
	function formatPaymentType(type: string) {
		const typeMap: Record<string, string> = {
			'performance': 'Performance',
			'training': 'Training',
			'special_event': 'Special Event',
			'other': 'Other'
		}
		return typeMap[type] || type
	}
	
	function exportToCSV() {
		const headers = ['Month', 'Performance Type', 'Total Hours', 'Total Pay', 'Record Count']
		const rows: string[][] = []
		
		reportData.forEach(monthData => {
			Array.from(monthData.performanceTypes.values()).forEach(typeData => {
				rows.push([
					monthData.monthName,
					formatPaymentType(typeData.type),
					typeData.totalHours.toFixed(2),
					typeData.totalPay.toFixed(2),
					typeData.recordCount.toString()
				])
			})
		})
		
		const csvContent = [headers, ...rows]
			.map(row => row.map(cell => `"${cell}"`).join(','))
			.join('\n')
		
		const blob = new Blob([csvContent], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `monthly-payroll-${startDate}-to-${endDate}.csv`
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
	
	const employeeTypeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'employee', label: 'Employee' },
		{ value: 'contractor', label: 'Contractor' },
		{ value: 'roster_artist', label: 'Roster Artist' }
	]
	
	// Get all unique performance types for coloring
	let performanceTypes = $derived.by(() => {
		const types = new Set<string>()
		reportData.forEach(month => {
			month.performanceTypes.forEach((_, type) => types.add(type))
		})
		return Array.from(types).sort()
	})
	
	const typeColors = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-info', 'bg-warning', 'bg-error']
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">Monthly Payroll Report</h2>
			<p class="text-sm opacity-60">View payroll breakdown by month and performance type</p>
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
			
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
				<h3 class="card-title text-lg mb-6">Monthly Payroll Trend</h3>
				<div class="h-80 flex items-end justify-center gap-6 px-4">
					{#each reportData as month}
						{@const maxPay = Math.max(...reportData.map(m => m.totalPay))}
						{@const height = maxPay > 0 ? (month.totalPay / maxPay) * 200 : 0}
						{@const barWidth = Math.max(50, Math.min(80, 500 / reportData.length))}
						<div class="flex flex-col items-center" style="min-width: {barWidth + 40}px">
							<!-- Value at top -->
							<div class="text-xs font-mono mb-3 text-center h-8 flex items-center justify-center">
								<span class="whitespace-nowrap">{formatCurrency(month.totalPay)}</span>
							</div>
							<!-- Bar -->
							<div class="bg-primary rounded-t transition-all duration-500 min-h-[12px] shadow-sm" style="height: {Math.max(height, 12)}px; width: {barWidth}px"></div>
							<!-- Month label at bottom -->
							<div class="text-xs mt-4 text-center" style="width: {barWidth + 40}px">
								<div class="font-medium text-center" title="{month.monthName}">
									{month.monthName.split(' ')[0]}
								</div>
								<div class="text-xs opacity-60 text-center">
									{month.monthName.split(' ')[1]}
								</div>
							</div>
						</div>
					{/each}
				</div>
				<div class="text-center text-sm opacity-60 mt-4">
					Monthly payroll distribution over selected period
				</div>
			</div>
		</div>
		
		<!-- Summary Cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Months</div>
				<div class="stat-value text-2xl">{summary.totalMonths}</div>
				<div class="stat-desc">{summary.dateRange}</div>
			</div>
			
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Payroll</div>
				<div class="stat-value text-2xl">{formatCurrency(summary.totalPayroll)}</div>
				<div class="stat-desc">{summary.totalHours.toFixed(1)} hours</div>
			</div>
			
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Average per Month</div>
				<div class="stat-value text-2xl">{formatCurrency(summary.averagePayPerMonth)}</div>
				<div class="stat-desc">{summary.averageHoursPerMonth.toFixed(1)} hours avg</div>
			</div>
			
			<div class="stat bg-base-200 rounded-lg p-4">
				<div class="stat-title text-xs">Total Artists</div>
				<div class="stat-value text-2xl">{summary.totalArtists}</div>
				<div class="stat-desc">{summary.totalRecords} records</div>
			</div>
		</div>
		
		<!-- Performance Type Legend -->
		{#if performanceTypes.length > 0}
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-lg mb-4">Performance Types</h3>
					<div class="flex flex-wrap gap-4">
						{#each performanceTypes as type, index}
							<div class="flex items-center gap-2">
								<div class="w-4 h-4 rounded {typeColors[index % typeColors.length]}"></div>
								<span class="text-sm">{formatPaymentType(type)}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
		
		<!-- Monthly Breakdown -->
		<div class="space-y-4">
			{#each reportData as monthData}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<div class="flex items-center justify-between mb-4">
							<h3 class="card-title text-lg">{monthData.monthName}</h3>
							<div class="flex items-center gap-4 text-sm">
								<span class="badge badge-outline">{monthData.recordCount} records</span>
								<span class="font-mono font-medium">{formatCurrency(monthData.totalPay)}</span>
							</div>
						</div>
						
						<div class="overflow-x-auto">
							<table class="table table-zebra table-sm">
								<thead>
									<tr>
										<th>Performance Type</th>
										<th>Total Hours</th>
										<th>Total Pay</th>
										<th>Record Count</th>
										<th>Average per Record</th>
									</tr>
								</thead>
								<tbody>
									{#each Array.from(monthData.performanceTypes.values()) as typeData, index}
										<tr>
											<td>
												<div class="flex items-center gap-2">
													<div class="w-3 h-3 rounded {typeColors[performanceTypes.indexOf(typeData.type) % typeColors.length]}"></div>
													<span class="font-medium">{formatPaymentType(typeData.type)}</span>
												</div>
											</td>
											<td>
												<div class="font-mono">{typeData.totalHours.toFixed(2)}</div>
											</td>
											<td>
												<div class="font-mono font-medium">{formatCurrency(typeData.totalPay)}</div>
											</td>
											<td>
												<div class="badge badge-outline">{typeData.recordCount}</div>
											</td>
											<td>
												<div class="font-mono">{formatCurrency(typeData.totalPay / typeData.recordCount)}</div>
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="font-bold">
										<td>Month Total</td>
										<td>
											<div class="font-mono">{monthData.totalHours.toFixed(2)}</div>
										</td>
										<td>
											<div class="font-mono">{formatCurrency(monthData.totalPay)}</div>
										</td>
										<td>
											<div class="badge badge-primary">{monthData.recordCount}</div>
										</td>
										<td>
											<div class="font-mono">{formatCurrency(monthData.totalPay / monthData.recordCount)}</div>
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-12 bg-base-200 rounded-lg">
			<Calendar class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-4 text-lg">No payroll data found</p>
			<p class="text-sm opacity-60">Try adjusting your date range or filters</p>
		</div>
	{/if}
</div>