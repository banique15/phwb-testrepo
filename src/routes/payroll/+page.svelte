<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { payrollStore } from '$lib/stores/payroll'
	import type { Payroll, CreatePayroll } from '$lib/schemas/payroll'
	import { supabase } from '$lib/supabase'
	import ErrorBoundary from '$lib/components/ui/ErrorBoundary.svelte'
	import PayrollHeaderCard from './components/PayrollHeaderCard.svelte'
	import PayrollTabs from './components/PayrollTabs.svelte'

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
		totalCancelled: 0,
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
		const cancelled = filteredEntries.filter(e => e.status === 'Cancelled')
		const unreconciled = filteredEntries.filter(e => e.status === 'Paid' && !e.reconciled)
		
		stats = {
			totalPaid: paid.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalUnpaid: unpaid.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalPlanned: planned.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalApproved: approved.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalCancelled: cancelled.reduce((sum, e) => sum + (e.total_pay || 0), 0),
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
				// Create payroll entries for artist assignments
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
				
				// Create payroll entry for Production Manager if pm_hours is set
				if (event.pm_hours && event.pm_hours > 0) {
					try {
						const pmPayrollData: CreatePayroll = {
							event_date: event.date,
							artist_id: 'PM', // Placeholder for PM - could be linked to production_manager_contact_id if they're an artist
							venue_id: event.venue || undefined,
							event_id: event.id,
							hours: event.pm_hours,
							rate: event.pm_rate || 50, // Default rate if not specified
							additional_pay: 0,
							status: 'Planned',
							employee_contractor_status: 'contractor',
							payment_type: 'other', // PM work is categorized as 'other'
							created_by: user.email || user.id,
							creation_method: 'event-automation',
							source_event_id: event.id,
							notes: `Production Manager - Auto-generated from event: ${event.title}`
						}
						
						const created = await payrollStore.create(pmPayrollData)
						if (created) createdCount++
					} catch (err) {
						console.error('Error creating PM payroll entry:', err)
						errors.push(`Failed to create PM entry for event ${event.title}`)
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
	<div class="h-full flex flex-col overflow-hidden">
		<!-- Scrollable Content Area -->
		<div class="flex-1 p-4 min-h-0 flex flex-col overflow-hidden">
			<!-- Header Card -->
			<div class="flex-none mb-4">
				<PayrollHeaderCard
					{stats}
					dateRange={metricsDateRange !== 'all' ? metricsDateRange : undefined}
				/>
			</div>

			<!-- Tabs Section -->
			<div class="flex-1 min-h-0">
				<PayrollTabs
					{payrollEntries}
					{selectedEntries}
					{loading}
					{searchQuery}
					pagination={{
						currentPage,
						totalPages,
						total: totalEntries,
						limit
					}}
					{sortBy}
					{sortOrder}
					{statusFilter}
					{paymentTypeFilter}
					{employeeContractorFilter}
					{dateRangeStart}
					{dateRangeEnd}
					metricsDateRange={metricsDateRange}
					metricsPaymentType={metricsPaymentType}
					metricsArtistId={metricsArtistId}
					onSearch={handleSearch}
					onSort={handleSort}
					onPageChange={handlePageChange}
					onSelect={handleSelect}
					onUpdate={async () => {
						await loadPayrollData()
						await refreshAllRecords()
					}}
					onDelete={async () => {
						await loadPayrollData()
						await refreshAllRecords()
					}}
					onFiltersChange={handleFiltersChange}
					onMetricsFilterChange={handleMetricsFilterChange}
					onBulkAction={handleBulkAction}
					showApprovalModal={showApprovalModal}
					showBatchModal={showBatchModal}
					showExportModal={showExportModal}
					showAuditModal={showAuditModal}
					showReconcileModal={showReconcileModal}
					{auditPaymentId}
					getSelectedPayments={getSelectedPayments}
					onCloseApproval={() => showApprovalModal = false}
					onCloseBatch={() => showBatchModal = false}
					onCloseExport={() => showExportModal = false}
					onCloseAudit={() => showAuditModal = false}
					onCloseReconcile={() => showReconcileModal = false}
					onOpenApproval={openApprovalModal}
					onOpenBatch={openBatchModal}
					onOpenExport={openExportModal}
					onOpenAudit={showAuditLog}
					onOpenReconcile={openReconcileModal}
					onPaymentApproved={handlePaymentApproved}
					onPaymentProcessed={handlePaymentProcessed}
					onPaymentReconciled={handlePaymentReconciled}
					onPaymentExported={handlePaymentExported}
				/>
			</div>
		</div>
	</div>
</ErrorBoundary>