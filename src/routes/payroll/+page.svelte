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
	import { toast } from '$lib/stores/toast'

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
	let showGenerationModal = $state(false)
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
	let sortBy = $state('created_at')
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
		sortBy = params.get('sort_by') || 'created_at'
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
		const planned = filteredEntries.filter(e => e.status === 'Planned')
		const approved = filteredEntries.filter(e => e.status === 'Approved')
		const withIssues = filteredEntries.filter(e => e.status === 'With Issues')
		const cancelled = filteredEntries.filter(e => e.status === 'Cancelled')
		const unreconciled = filteredEntries.filter(e => e.status === 'Paid' && !e.reconciled)
		// "Unpaid" = entries that are not yet paid
		const unpaid = filteredEntries.filter(
			e => e.status === 'Planned' || e.status === 'Approved' || e.status === 'With Issues'
		)
		
		stats = {
			totalPaid: paid.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalUnpaid: unpaid.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalPlanned: planned.reduce((sum, e) => sum + (e.total_pay || 0), 0),
			totalApproved: approved.reduce((sum, e) => sum + (e.total_pay || 0), 0) + withIssues.reduce((sum, e) => sum + (e.total_pay || 0), 0),
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
				const dateStr = entry.event_date || entry.created_at || ''
				if (!dateStr) return true
				const entryDate = new Date(dateStr)
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
			const count = entryIds.length
			
			switch (action) {
				case 'markPaid':
					for (const id of entryIds) {
						await payrollStore.update(id, { 
							status: 'Paid', 
							paid_date: new Date().toISOString().split('T')[0] 
						})
					}
					toast.success(`${count} ${count === 1 ? 'entry' : 'entries'} marked as paid`)
					break
				case 'markUnpaid':
					for (const id of entryIds) {
						await payrollStore.update(id, { status: 'Planned', paid_date: undefined })
					}
					toast.success(`${count} ${count === 1 ? 'entry' : 'entries'} marked as unpaid`)
					break
				case 'approve':
					for (const id of entryIds) {
						await payrollStore.update(id, { status: 'Approved' })
					}
					toast.success(`${count} ${count === 1 ? 'entry' : 'entries'} approved for payment`)
					break
				case 'delete':
					for (const id of entryIds) {
						await payrollStore.delete(id)
					}
					toast.success(`${count} ${count === 1 ? 'entry' : 'entries'} deleted`)
					break
			}
			
			selectedEntries.clear()
			// Refresh both table and metrics since data changed
			await loadPayrollData()
			await refreshAllRecords()
		} catch (err) {
			console.error('Failed to perform bulk action:', err)
			toast.error('Failed to perform bulk action. Please try again.')
		}
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount)
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

	function openGenerationModal() {
		showGenerationModal = true
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
		toast.success('Payments approved successfully')
	}

	async function handlePaymentProcessed() {
		selectedEntries.clear()
		// Refresh both table and metrics since data changed
		await loadPayrollData()
		await refreshAllRecords()
		toast.success('Payments processed successfully')
	}

	async function handlePaymentReconciled() {
		// Refresh both table and metrics since data changed
		await loadPayrollData()
		await refreshAllRecords()
		toast.success('Payments reconciled successfully')
	}

	async function handlePaymentExported() {
		toast.success('Payments exported successfully')
	}

	async function handlePayrollGenerated() {
		// Refresh both table and metrics since data changed
		await loadPayrollData()
		await refreshAllRecords()
		toast.success('Payroll entries generated successfully')
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
					showGenerationModal={showGenerationModal}
					{auditPaymentId}
					getSelectedPayments={getSelectedPayments}
					onCloseApproval={() => showApprovalModal = false}
					onCloseBatch={() => showBatchModal = false}
					onCloseExport={() => showExportModal = false}
					onCloseAudit={() => showAuditModal = false}
					onCloseReconcile={() => showReconcileModal = false}
					onCloseGeneration={() => showGenerationModal = false}
					onOpenApproval={openApprovalModal}
					onOpenBatch={openBatchModal}
					onOpenExport={openExportModal}
					onOpenAudit={showAuditLog}
					onOpenReconcile={openReconcileModal}
					onOpenGeneration={openGenerationModal}
					onPaymentApproved={handlePaymentApproved}
					onPaymentProcessed={handlePaymentProcessed}
					onPaymentReconciled={handlePaymentReconciled}
					onPaymentExported={handlePaymentExported}
					onPayrollGenerated={handlePayrollGenerated}
				/>
			</div>
		</div>
	</div>
</ErrorBoundary>