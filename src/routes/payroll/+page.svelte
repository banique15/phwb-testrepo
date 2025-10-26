<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { payrollStore } from '$lib/stores/payroll'
	import type { Payroll, CreatePayroll } from '$lib/schemas/payroll'
	import { supabase } from '$lib/supabase'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	import PayrollInlineTable from './PayrollInlineTable.svelte'
	import PayrollFiltersButton from './PayrollFiltersButton.svelte'
	import PayrollMetricsFilterButton from './PayrollMetricsFilterButton.svelte'
	import PayrollBulkActions from './PayrollBulkActions.svelte'
	import StatsCard from '$lib/components/ui/StatsCard.svelte'
	import PaymentApprovalModal from '$lib/components/payroll/PaymentApprovalModal.svelte'
	import PaymentBatchProcessor from '$lib/components/payroll/PaymentBatchProcessor.svelte'
	import PaymentExport from '$lib/components/payroll/PaymentExport.svelte'
	import PaymentAuditLog from '$lib/components/payroll/PaymentAuditLog.svelte'
	import PaymentReconciliation from '$lib/components/payroll/PaymentReconciliation.svelte'
	import PaymentStatusBadge from '$lib/components/payroll/PaymentStatusBadge.svelte'

	// State management
	let payrollEntries = $state<Payroll[]>([])
	let loading = $state(false)
	let error = $state<string | null>(null)
	let selectedEntries = $state<Set<number>>(new Set())
	
	// Payment workflow modal states
	let showApprovalModal = $state(false)
	let showBatchModal = $state(false)
	let showExportModal = $state(false)
	let showAuditModal = $state(false)
	let showReconcileModal = $state(false)
	let auditPaymentId = $state(0)
	
	// Pagination and filters
	let currentPage = $state(1)
	let totalPages = $state(0)
	let totalEntries = $state(0)
	let limit = $state(25)
	
	// Filter state
	let searchQuery = $state('')
	let statusFilter = $state<string>('')
	let paymentTypeFilter = $state<string>('')
	let employeeContractorFilter = $state<string>('')
	let dateRangeStart = $state<string>('')
	let dateRangeEnd = $state<string>('')
	let sortBy = $state('event_date')
	let sortOrder = $state<'asc' | 'desc'>('desc')

	// Metrics filter state (separate from table filters)
	let metricsDateRange = $state('all')
	let metricsPaymentType = $state('all')
	let metricsArtistId = $state('all')

	// Stats
	let stats = $state({
		totalPaid: 0,
		totalUnpaid: 0,
		totalPlanned: 0,
		totalApproved: 0,
		totalCompleted: 0,
		unreconciled: 0,
		averagePayment: 0
	})

	// All payroll records for metrics calculation
	let allPayrollRecords = $state<Payroll[]>([])
	let allRecordsLoaded = $state(false)
	let metricsLoading = $state(false)


	// Subscribe to payroll store
	let unsubscribe: (() => void) | null = null

	onMount(() => {
		// Subscribe to store updates
		unsubscribe = payrollStore.subscribe((state) => {
			payrollEntries = state.items
			loading = state.loading
			error = state.error
			if (state.pagination) {
				currentPage = state.pagination.page
				totalPages = state.pagination.totalPages
				totalEntries = state.pagination.total
			}
		})

		// Load initial data
		loadInitialData()

		// Parse URL parameters
		parseUrlParams()

		return () => {
			if (unsubscribe) unsubscribe()
		}
	})

	function parseUrlParams() {
		const params = new URLSearchParams($page.url.search)
		searchQuery = params.get('search') || ''
		statusFilter = params.get('status') || ''
		paymentTypeFilter = params.get('payment_type') || ''
		employeeContractorFilter = params.get('employee_contractor') || ''
		dateRangeStart = params.get('date_start') || ''
		dateRangeEnd = params.get('date_end') || ''
		sortBy = params.get('sort_by') || 'event_date'
		sortOrder = (params.get('sort_order') as 'asc' | 'desc') || 'desc'
		currentPage = parseInt(params.get('page') || '1')
		limit = parseInt(params.get('limit') || '25')
	}

	async function loadInitialData() {
		try {
			// Load all records for metrics calculation (only once)
			await loadAllPayrollRecords()
			
			// Load paginated data for table
			await loadPayrollData()
		} catch (err) {
			console.error('Failed to load initial data:', err)
		}
	}

	async function loadPayrollData() {
		try {
			// Load paginated data for table
			await payrollStore.fetchPaginated({
				page: currentPage,
				limit,
				search: searchQuery || undefined,
				sortBy,
				sortOrder,
				filters: {
					status: statusFilter || undefined,
					payment_type: paymentTypeFilter || undefined,
					employee_contractor_status: employeeContractorFilter || undefined,
					date_start: dateRangeStart || undefined,
					date_end: dateRangeEnd || undefined
				}
			})
		} catch (err) {
			console.error('Failed to load payroll data:', err)
		}
	}

	async function loadAllPayrollRecords() {
		// Only load if not already loaded
		if (allRecordsLoaded) {
			calculateStats()
			return
		}

		try {
			metricsLoading = true
			const result = await payrollStore.fetchAll()
			allPayrollRecords = result.data
			allRecordsLoaded = true
			
			// Calculate stats from all records with metrics filters
			calculateStats()
		} catch (err) {
			console.error('Failed to load all payroll records:', err)
		} finally {
			metricsLoading = false
		}
	}

	async function refreshAllRecords() {
		// Force refresh of all records (for metrics)
		allRecordsLoaded = false
		await loadAllPayrollRecords()
	}

	function calculateStats() {
		// Apply metrics filters to all records
		const filteredEntries = applyMetricsFilters(allPayrollRecords)
		
		const paid = filteredEntries.filter(e => e.status === 'Paid')
		const unpaid = filteredEntries.filter(e => e.status === 'Unpaid')
		const planned = filteredEntries.filter(e => e.status === 'Planned')
		const approved = filteredEntries.filter(e => e.status === 'Approved')
		const completed = filteredEntries.filter(e => e.status === 'Completed')
		const unreconciled = filteredEntries.filter(e => e.status === 'Paid' && !e.reconciled)
		
		stats = {
			totalPaid: paid.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalUnpaid: unpaid.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalPlanned: planned.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalApproved: approved.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalCompleted: completed.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			unreconciled: unreconciled.length,
			averagePayment: filteredEntries.length > 0 ? filteredEntries.reduce((sum, e) => sum + (e.total_pay || 0), 0) / filteredEntries.length : 0
		}
	}

	function applyMetricsFilters(entries: Payroll[]): Payroll[] {
		let filtered = [...entries]

		// Apply date range filter
		if (metricsDateRange !== 'all') {
			const now = new Date()
			let startDate: Date

			switch (metricsDateRange) {
				case 'last30':
					startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
					break
				case 'last90':
					startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
					break
				case 'mtd':
					startDate = new Date(now.getFullYear(), now.getMonth(), 1)
					break
				case 'ytd':
					startDate = new Date(now.getFullYear(), 0, 1)
					break
				default:
					startDate = new Date(0)
			}

			filtered = filtered.filter(entry => {
				const entryDate = new Date(entry.event_date || entry.created_at)
				return entryDate >= startDate
			})
		}

		// Apply payment type filter
		if (metricsPaymentType !== 'all') {
			filtered = filtered.filter(entry => entry.payment_type === metricsPaymentType)
		}

		// Apply artist filter
		if (metricsArtistId !== 'all') {
			filtered = filtered.filter(entry => entry.artist_id === metricsArtistId)
		}

		return filtered
	}

	async function updateUrlAndFetch(updates: Record<string, any>) {
		const params = new URLSearchParams($page.url.search)
		
		Object.entries(updates).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '') {
				params.set(key, String(value))
			} else {
				params.delete(key)
			}
		})

		await goto(`?${params.toString()}`, { replaceState: true, keepFocus: true })
		// Only load paginated data for table, metrics remain unchanged
		await loadPayrollData()
	}

	// Event handlers
	async function handleSearch(event: CustomEvent<{ value: string }>) {
		searchQuery = event.detail.value
		await updateUrlAndFetch({ search: searchQuery, page: 1 })
	}

	async function handleFiltersChange(event: CustomEvent<{
		status: string
		paymentType: string
		employeeContractor: string
		dateStart: string
		dateEnd: string
	}>) {
		const { status, paymentType, employeeContractor, dateStart, dateEnd } = event.detail
		statusFilter = status
		paymentTypeFilter = paymentType
		employeeContractorFilter = employeeContractor
		dateRangeStart = dateStart
		dateRangeEnd = dateEnd
		
		await updateUrlAndFetch({
			status: statusFilter,
			payment_type: paymentTypeFilter,
			employee_contractor: employeeContractorFilter,
			date_start: dateRangeStart,
			date_end: dateRangeEnd,
			page: 1
		})
	}

	function handleMetricsFilterChange(event: CustomEvent<{
		dateRange: string
		paymentType: string
		artistId: string
	}>) {
		const { dateRange, paymentType, artistId } = event.detail
		metricsDateRange = dateRange
		metricsPaymentType = paymentType
		metricsArtistId = artistId
		
		// Recalculate stats with new filters
		calculateStats()
	}

	async function handleSort(event: CustomEvent<{ key: string; order: 'asc' | 'desc' }>) {
		sortBy = event.detail.key
		sortOrder = event.detail.order
		await updateUrlAndFetch({ sort_by: sortBy, sort_order: sortOrder })
	}

	async function handlePageChange(event: CustomEvent<{ page: number }>) {
		currentPage = event.detail.page
		await updateUrlAndFetch({ page: currentPage })
	}

	function handleSelect(event: CustomEvent<{ entries: Set<number> }>) {
		selectedEntries = event.detail.entries
	}

	async function handleBulkAction(event: CustomEvent<{ action: string; entryIds: number[] }>) {
		try {
			const { action, entryIds } = event.detail
			
			switch (action) {
				case 'markPaid':
					for (const id of entryIds) {
						await payrollStore.update(id, { 
							status: 'Paid', 
							paid_date: new Date().toISOString().split('T')[0] 
						})
					}
					break
				case 'markUnpaid':
					for (const id of entryIds) {
						await payrollStore.update(id, { status: 'Unpaid', paid_date: undefined })
					}
					break
				case 'approve':
					for (const id of entryIds) {
						await payrollStore.update(id, { status: 'Unpaid' })
					}
					break
				case 'delete':
					for (const id of entryIds) {
						await payrollStore.delete(id)
					}
					break
			}
			
			selectedEntries.clear()
			// Refresh both table and metrics since data changed
			await loadPayrollData()
			await refreshAllRecords()
		} catch (err) {
			console.error('Failed to perform bulk action:', err)
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
	}

	async function generatePayrollFromEvents() {
		try {
			loading = true
			error = null
			
			// Get current user info
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) {
				throw new Error('User not authenticated')
			}
			
			// Fetch completed events that don't have payroll entries yet
			const { data: completedEvents, error: eventsError } = await supabase
				.from('phwb_events')
				.select('*')
				.eq('status', 'completed')
				.not('artists', 'is', null)
			
			if (eventsError) throw eventsError
			
			if (!completedEvents || completedEvents.length === 0) {
				alert('No completed events found to generate payroll from.')
				return
			}
			
			// Get all existing payroll entries to check for duplicates
			const { data: existingPayroll, error: payrollError } = await supabase
				.from('phwb_payroll')
				.select('source_event_id')
				.not('source_event_id', 'is', null)
			
			if (payrollError) throw payrollError
			
			const existingEventIds = new Set(existingPayroll?.map(p => p.source_event_id) || [])
			
			// Filter out events that already have payroll entries
			const eventsToProcess = completedEvents.filter(event => !existingEventIds.has(event.id))
			
			if (eventsToProcess.length === 0) {
				alert('All completed events already have payroll entries.')
				return
			}
			
			let createdCount = 0
			const errors: string[] = []
			
			// Process each event
			for (const event of eventsToProcess) {
				if (event.artists?.assignments && Array.isArray(event.artists.assignments)) {
					for (const assignment of event.artists.assignments) {
						try {
							// Create payroll entry for each artist assignment
							const payrollData: CreatePayroll = {
								event_date: event.date,
								artist_id: assignment.artist_id,
								venue_id: event.venue || undefined,
								event_id: event.id,
								hours: assignment.num_hours || 3, // Default 3 hours if not specified
								rate: assignment.hourly_rate || 50, // Default rate if not specified
								additional_pay: 0,
								status: 'Planned',
								employee_contractor_status: 'contractor', // Default status
								payment_type: 'performance', // Default type
								created_by: user.email || user.id,
								creation_method: 'event-automation',
								source_event_id: event.id,
								notes: `Auto-generated from event: ${event.title}`
							}
							
							const created = await payrollStore.create(payrollData)
							if (created) createdCount++
						} catch (err) {
							console.error('Error creating payroll entry:', err)
							errors.push(`Failed to create entry for artist ${assignment.artist_id} in event ${event.title}`)
						}
					}
				}
			}
			
			// Refresh data
			await loadPayrollData()
			await refreshAllRecords()
			
			// Show result
			if (errors.length > 0) {
				alert(`Created ${createdCount} payroll entries with ${errors.length} errors:\n${errors.join('\n')}`)
			} else {
				alert(`Successfully created ${createdCount} payroll entries from ${eventsToProcess.length} events.`)
			}
		} catch (err) {
			console.error('Failed to generate payroll from events:', err)
			alert('Failed to generate payroll entries. Please try again.')
		} finally {
			loading = false
		}
	}

	// Payment workflow handlers
	function getSelectedPayments(): Payroll[] {
		return Array.from(selectedEntries).map(id => 
			payrollEntries.find(p => p.id === id)
		).filter(Boolean) as Payroll[]
	}

	function openApprovalModal() {
		showApprovalModal = true
	}

	function openBatchModal() {
		showBatchModal = true
	}

	function openExportModal() {
		showExportModal = true
	}

	function openReconcileModal() {
		showReconcileModal = true
	}

	function showAuditLog(paymentId: number) {
		auditPaymentId = paymentId
		showAuditModal = true
	}

	async function handlePaymentApproved() {
		selectedEntries.clear()
		// Refresh both table and metrics since data changed
		await loadPayrollData()
		await refreshAllRecords()
	}

	async function handlePaymentProcessed() {
		selectedEntries.clear()
		// Refresh both table and metrics since data changed
		await loadPayrollData()
		await refreshAllRecords()
	}

	async function handlePaymentReconciled() {
		// Refresh both table and metrics since data changed
		await loadPayrollData()
		await refreshAllRecords()
	}

	async function handlePaymentExported() {
		// Could show a success toast
		console.log('Payments exported successfully')
	}
</script>

<ErrorBoundary>
	<div class="flex flex-col h-full">
		<!-- Fixed Page Header -->
		<div class="flex-none px-4 sm:px-6 pt-4 pb-4 bg-base-100 border-b border-base-200">
			<PageHeader
				title="Payroll"
				subtitle="Payment and compensation management"
			>
				{#snippet actions()}
					<div class="flex flex-col sm:flex-row flex-wrap gap-2">
						<button 
							class="btn btn-ghost btn-sm order-3 sm:order-1" 
							onclick={async () => {
								await loadPayrollData()
								await refreshAllRecords()
							}}
							disabled={loading || metricsLoading}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
							<span class="hidden sm:inline">Refresh</span>
							{#if loading || metricsLoading}
								<span class="loading loading-spinner loading-xs ml-1"></span>
							{/if}
						</button>
						
						<button 
							class="btn btn-primary btn-sm order-2 sm:order-2" 
							onclick={generatePayrollFromEvents}
							disabled={loading || metricsLoading}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							<span class="hidden sm:inline">Generate from Events</span>
							<span class="sm:hidden">Generate</span>
						</button>
						
						<div class="dropdown dropdown-end order-3">
							<div tabindex="0" role="button" class="btn btn-info btn-sm">
								<span class="hidden sm:inline">💳 Payment Tools</span>
								<span class="sm:hidden">💳 Tools</span>
								{#if selectedEntries.size > 0}
									<span class="badge badge-sm badge-warning">{selectedEntries.size}</span>
								{/if}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
							<ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-56">
								<li>
									<button 
										onclick={() => openApprovalModal()}
										disabled={selectedEntries.size === 0}
									>
										✅ Approve Payments
										{#if selectedEntries.size > 0}
											<span class="badge badge-xs">{selectedEntries.size}</span>
										{/if}
									</button>
								</li>
								<li>
									<button 
										onclick={() => openBatchModal()}
										disabled={selectedEntries.size === 0}
									>
										💳 Process Batch
										{#if selectedEntries.size > 0}
											<span class="badge badge-xs">{selectedEntries.size}</span>
										{/if}
									</button>
								</li>
								<li><button onclick={() => openReconcileModal()}>🔄 Reconcile</button></li>
								<li><button onclick={() => openExportModal()}>📤 Export Data</button></li>
							</ul>
						</div>
						
					</div>
				{/snippet}
			</PageHeader>
		</div>
		
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-4 sm:p-6 overflow-auto min-h-0">
			<div class="space-y-4 sm:space-y-6">
				<!-- Stats Cards with Filter Button -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-semibold">Payroll Metrics</h3>
						<PayrollMetricsFilterButton
							dateRange={metricsDateRange}
							paymentType={metricsPaymentType}
							artistId={metricsArtistId}
							on:filterChange={handleMetricsFilterChange}
						/>
					</div>
					
					<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
						<StatsCard
							title="Planned"
							value={formatCurrency(stats.totalPlanned)}
							icon="📅"
							size="sm"
							loading={metricsLoading}
						/>
						<StatsCard
							title="Approved"
							value={formatCurrency(stats.totalApproved)}
							icon="✅"
							size="sm"
							loading={metricsLoading}
						/>
						<StatsCard
							title="Paid"
							value={formatCurrency(stats.totalPaid)}
							icon="💳"
							size="sm"
							loading={metricsLoading}
						/>
						<StatsCard
							title="Completed"
							value={formatCurrency(stats.totalCompleted)}
							icon="🎯"
							size="sm"
							loading={metricsLoading}
						/>
						<StatsCard
							title="Unreconciled"
							value={stats.unreconciled.toString()}
							icon="⚠️"
							size="sm"
							loading={metricsLoading}
						/>
						<StatsCard
							title="Avg Payment"
							value={formatCurrency(stats.averagePayment)}
							icon="📊"
							size="sm"
							loading={metricsLoading}
						/>
					</div>
				</div>

				<!-- Bulk Actions -->
				{#if selectedEntries.size > 0}
					<PayrollBulkActions
						selectedCount={selectedEntries.size}
						selectedEntries={Array.from(selectedEntries)}
						on:bulkAction={handleBulkAction}
					/>
				{/if}

				<!-- Data Table with improved container -->
				<div class="min-h-0 flex-1">
					<PayrollInlineTable
						entries={payrollEntries}
						{loading}
						{searchQuery}
						{selectedEntries}
						pagination={{
							currentPage,
							totalPages,
							total: totalEntries,
							limit
						}}
						{sortBy}
						{sortOrder}
						on:search={handleSearch}
						on:sort={handleSort}
						on:pageChange={handlePageChange}
						on:select={handleSelect}
						on:update={async (e) => {
							await loadPayrollData()
							await refreshAllRecords()
						}}
						on:delete={async (e) => {
							await loadPayrollData()
							await refreshAllRecords()
						}}
						actions={filterActions}
					/>
				</div>

{#snippet filterActions()}
	<PayrollFiltersButton
		{statusFilter}
		{paymentTypeFilter}
		{employeeContractorFilter}
		{dateRangeStart}
		{dateRangeEnd}
		on:filtersChange={handleFiltersChange}
	/>
{/snippet}
			</div>
		</div>
	</div>


	<!-- Payment Workflow Modals -->
	<PaymentApprovalModal
		bind:isOpen={showApprovalModal}
		payments={getSelectedPayments()}
		on:approve={handlePaymentApproved}
		on:close={() => showApprovalModal = false}
	/>

	<PaymentBatchProcessor
		bind:isOpen={showBatchModal}
		payments={getSelectedPayments()}
		on:processed={handlePaymentProcessed}
		on:close={() => showBatchModal = false}
	/>

	<PaymentExport
		bind:isOpen={showExportModal}
		on:exported={handlePaymentExported}
		on:close={() => showExportModal = false}
	/>

	<PaymentReconciliation
		bind:isOpen={showReconcileModal}
		payments={payrollEntries}
		on:reconciled={handlePaymentReconciled}
		on:close={() => showReconcileModal = false}
	/>

	<PaymentAuditLog
		bind:isOpen={showAuditModal}
		paymentId={auditPaymentId}
		on:close={() => showAuditModal = false}
	/>
</ErrorBoundary>