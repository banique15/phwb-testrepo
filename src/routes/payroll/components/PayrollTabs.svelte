<script lang="ts">
	import type { Payroll } from '$lib/schemas/payroll'
	import type { ComponentType, SvelteComponent } from 'svelte'
import { ClipboardList, CheckCircle, Search, BarChart, CreditCard, Wallet, Download, Upload } from 'lucide-svelte'
	import PayrollInlineTable from '../PayrollInlineTable.svelte'
	import PayrollFiltersButton from '../PayrollFiltersButton.svelte'
	import PayrollMetricsFilterButton from '../PayrollMetricsFilterButton.svelte'
	import PayrollBulkActions from '../PayrollBulkActions.svelte'
	import PaymentApprovalModal from '$lib/components/payroll/PaymentApprovalModal.svelte'
	import PaymentBatchProcessor from '$lib/components/payroll/PaymentBatchProcessor.svelte'
	import PaymentExport from '$lib/components/payroll/PaymentExport.svelte'
	import PaymentAuditLog from '$lib/components/payroll/PaymentAuditLog.svelte'
	import PaymentReconciliation from '$lib/components/payroll/PaymentReconciliation.svelte'
	import PayrollGenerationModal from '$lib/components/payroll/PayrollGenerationModal.svelte'
	import RateCardManager from './RateCardManager.svelte'
	import WeeklyBatchView from './WeeklyBatchView.svelte'
	import TestModal from './TestModal.svelte'
	import { payrollStore } from '$lib/stores/payroll'
	import { supabase } from '$lib/supabase'
	import { PaymentStatus } from '$lib/schemas/payroll'
	import ExportPayrollEntriesModal from '$lib/components/payroll/ExportPayrollEntriesModal.svelte'
	import { goto } from '$app/navigation'
	import { downloadCSV } from '$lib/utils'

	interface Props {
		payrollEntries: Payroll[]
		selectedEntries: Set<number>
		loading: boolean
		searchQuery: string
		pagination: {
			currentPage: number
			totalPages: number
			total: number
			limit: number
		}
		sortBy: string
		sortOrder: 'asc' | 'desc'
		statusFilter: string
		paymentTypeFilter: string
		employeeContractorFilter: string
		dateRangeStart: string
		dateRangeEnd: string
		metricsDateRange: string
		metricsPaymentType: string
		metricsArtistId: string
		onSearch: (event: CustomEvent<{ value: string }>) => void
		onSort: (event: CustomEvent<{ key: string; order: 'asc' | 'desc' }>) => void
		onPageChange: (event: CustomEvent<{ page: number }>) => void
		onSelect: (event: CustomEvent<{ entries: Set<number> }>) => void
		onUpdate: () => Promise<void>
		onDelete: () => Promise<void>
		onFiltersChange: (event: CustomEvent<{
			status: string
			paymentType: string
			employeeContractor: string
			dateStart: string
			dateEnd: string
		}>) => void
		onMetricsFilterChange: (event: CustomEvent<{
			dateRange: string
			paymentType: string
			artistId: string
		}>) => void
		onBulkAction: (event: CustomEvent<{ action: string; entryIds: number[] }>) => Promise<void>
		showApprovalModal: boolean
		showBatchModal: boolean
		showExportModal: boolean
		showAuditModal: boolean
		showReconcileModal: boolean
		showGenerationModal: boolean
		auditPaymentId: number
		getSelectedPayments: () => Payroll[]
		onCloseApproval: () => void
		onCloseBatch: () => void
		onCloseExport: () => void
		onCloseAudit: () => void
		onCloseReconcile: () => void
		onCloseGeneration: () => void
		onOpenApproval: () => void
		onOpenBatch: () => void
		onOpenExport: () => void
		onOpenAudit: (paymentId: number) => void
		onOpenReconcile: () => void
		onOpenGeneration: () => void
		onPaymentApproved: () => Promise<void>
		onPaymentProcessed: () => Promise<void>
		onPaymentReconciled: () => Promise<void>
		onPaymentExported: () => void
		onPayrollGenerated: () => Promise<void>
	}

	let {
		payrollEntries,
		selectedEntries,
		loading,
		searchQuery,
		pagination,
		sortBy,
		sortOrder,
		statusFilter,
		paymentTypeFilter,
		employeeContractorFilter,
		dateRangeStart,
		dateRangeEnd,
		metricsDateRange,
		metricsPaymentType,
		metricsArtistId,
		onSearch,
		onSort,
		onPageChange,
		onSelect,
		onUpdate,
		onDelete,
		onFiltersChange,
		onMetricsFilterChange,
		onBulkAction,
		showApprovalModal,
		showBatchModal,
		showExportModal,
		showAuditModal,
		showReconcileModal,
		showGenerationModal,
		auditPaymentId,
		getSelectedPayments,
		onCloseApproval,
		onCloseBatch,
		onCloseExport,
		onCloseAudit,
		onCloseReconcile,
		onCloseGeneration,
		onOpenApproval,
		onOpenBatch,
		onOpenExport,
		onOpenAudit,
		onOpenReconcile,
		onOpenGeneration,
		onPaymentApproved,
		onPaymentProcessed,
		onPaymentReconciled,
		onPaymentExported,
		onPayrollGenerated
	}: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'entries', label: 'Entries', icon: ClipboardList },
		{ id: 'approvals', label: 'Approvals', icon: CheckCircle },
		{ id: 'pending', label: 'Pending Payments', icon: Wallet },
		{ id: 'reconciliation', label: 'Reconciliation', icon: Search },
		{ id: 'audit', label: 'Audit', icon: BarChart },
		{ id: 'rate-card', label: 'Rate Card', icon: CreditCard }
	]

	// Handler for marking payments as paid
	async function handleMarkPaid(entryIds: number[]) {
		// Get current user
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) throw new Error('User not authenticated')

		// Update each entry to 'Paid' status
		const { error } = await supabase
			.from('phwb_payroll')
			.update({
				status: PaymentStatus.PAID,
				processed_by: user.id,
				processed_at: new Date().toISOString()
			})
			.in('id', entryIds)

		if (error) throw error

		// Refresh data
		await onUpdate()
	}

	// Handler for exporting entries
	function handleExport(entries: Payroll[]) {
		// Generate CSV
		const headers = ['Artist', 'Event Date', 'Program', 'Hours', 'Rate', 'Additional Pay', 'Total Pay', 'Status']
		const rows = entries.map(entry => {
			const artist = entry.artists as any
			const artistName = artist?.full_name || `${artist?.legal_first_name || ''} ${artist?.legal_last_name || ''}`.trim() || 'Unknown'
			const program = entry.programs as any
			return [
				artistName,
				entry.event_date,
				program?.title || '',
				entry.hours || '',
				entry.rate || '',
				entry.additional_pay || 0,
				entry.total_pay || 0,
				entry.status
			]
		})

		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(cell => `"${cell}"`).join(','))
		].join('\n')

		// Download
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const link = document.createElement('a')
		link.href = URL.createObjectURL(blob)
		link.download = `payroll_export_${new Date().toISOString().split('T')[0]}.csv`
		link.click()
		URL.revokeObjectURL(link.href)
	}

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-payroll-active-tab') : null) || 'entries'
	)

	// Entries export modal state
	let showExportEntriesModal = $state(false)

	// Test modal state
	let showTestModal = $state(false)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-payroll-active-tab', tabId)
		}
	}

	// Build a CSV that matches the payroll import template headers
	function exportEntriesAsTemplateCSV(entries: Payroll[]) {
		if (!entries || entries.length === 0) return

		const headers = [
			'event_date',
			'artist_name',
			'venue_name',
			'hours',
			'rate',
			'additional_pay',
			'additional_pay_reason',
			'status',
			'insperity_hours',
			'paid_date',
			'event_id'
		]

		const rows = entries.map(entry => {
			const artist = entry.artists as any
			const venue = entry.venues as any
			const artistName =
				artist?.full_name ||
				`${artist?.legal_first_name || ''} ${artist?.legal_last_name || ''}`.trim() ||
				''

			return [
				entry.event_date || '',
				artistName,
				venue?.name || '',
				(entry.hours ?? '').toString(),
				(entry.rate ?? '').toString(),
				(entry.additional_pay ?? '').toString(),
				entry.additional_pay_reason || '',
				entry.status || 'Planned',
				(entry.insperity_hours ?? '').toString(),
				entry.paid_date || '',
				entry.event_id ? String(entry.event_id) : ''
			]
		})

		const escape = (value: string) => {
			if (value.includes(',') || value.includes('"') || value.includes('\n')) {
				return `"${value.replace(/"/g, '""')}"`
			}
			return value
		}

		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(escape).join(','))
		].join('\n')

		const filename = `payroll_entries_${new Date().toISOString().split('T')[0]}.csv`
		downloadCSV(csvContent, filename)
	}

	// Handle confirm from ExportPayrollEntriesModal
	async function handleEntriesExportConfirm(event: CustomEvent<{ scope: 'all' | 'selected' }>) {
		const scope = event.detail.scope

		try {
			let entriesToExport: Payroll[] = []

			if (scope === 'selected') {
				entriesToExport = getSelectedPayments()
			} else {
				// Export all entries matching current filters (across pages)
				const result = await (payrollStore as any).fetchAll({
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
				entriesToExport = result.data as Payroll[]
			}

			if (!entriesToExport || entriesToExport.length === 0) {
				showExportEntriesModal = false
				return
			}

			exportEntriesAsTemplateCSV(entriesToExport)
		} finally {
			showExportEntriesModal = false
		}
	}
</script>

<div class="flex flex-col h-full min-h-0">
	<!-- Tab Navigation -->
	<div class="flex-none mb-3">
		<div class="tabs tabs-boxed">
			{#each tabs as tab}
				{@const Icon = tab.icon}
				<button
					class="tab {activeTab === tab.id ? 'tab-active' : ''}"
					onclick={() => setActiveTab(tab.id)}
				>
					<Icon class="w-4 h-4 mr-2" />
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 min-h-0 overflow-y-auto">
		{#if activeTab === 'entries'}
			<div class="space-y-4">
				<!-- Actions Bar -->
				<div class="flex justify-between items-center">
					<div class="flex items-center gap-2">
					<button
					class="btn btn-outline btn-sm"
					onclick={() => goto('/payroll/import')}
					title="Import payroll data from CSV"
					>
					<Upload class="w-4 h-4 mr-1" />
					Import CSV
					</button>

					<button
					class="btn btn-outline btn-sm"
					onclick={() => showExportEntriesModal = true}
					title="Export payroll entries as CSV"
					>
					<Download class="w-4 h-4 mr-1" />
					Export CSV
					</button>

					<button
						class="btn btn-primary btn-sm"
						onclick={() => showTestModal = true}
						title="Test button"
					>
						TEST
					</button>
				</div>
					
					<!-- Metrics Filter -->
					<PayrollMetricsFilterButton
						dateRange={metricsDateRange}
						paymentType={metricsPaymentType}
						artistId={metricsArtistId}
						on:filterChange={onMetricsFilterChange}
					/>
				</div>

				<!-- Bulk Actions -->
				{#if selectedEntries.size > 0}
					<PayrollBulkActions
						selectedCount={selectedEntries.size}
						selectedEntries={Array.from(selectedEntries)}
						on:bulkAction={onBulkAction}
					/>
				{/if}

				<PayrollInlineTable
					entries={payrollEntries}
					{loading}
					{searchQuery}
					{selectedEntries}
					{pagination}
					{sortBy}
					{sortOrder}
					on:search={onSearch}
					on:sort={onSort}
					on:pageChange={onPageChange}
					on:select={onSelect}
					on:update={onUpdate}
					on:delete={onDelete}
				>
					{#snippet actions()}
						<PayrollFiltersButton
							{statusFilter}
							{paymentTypeFilter}
							{employeeContractorFilter}
							{dateRangeStart}
							{dateRangeEnd}
							on:filtersChange={onFiltersChange}
						/>
					{/snippet}
				</PayrollInlineTable>
			</div>
		{:else if activeTab === 'approvals'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Payment Approvals</h3>
				<div class="space-y-4">
					<button class="btn btn-primary" onclick={onOpenApproval}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Open Approval Modal
					</button>
					<p class="text-base opacity-70">Use the approval modal to review and approve pending payments.</p>
				</div>
			</div>
		{:else if activeTab === 'pending'}
			<div class="space-y-4">
				<div class="flex justify-between items-center">
					<div>
						<h3 class="text-lg font-semibold">Pending Payments</h3>
						<p class="text-sm opacity-70">Approved payments grouped by week, ready for processing</p>
					</div>
				</div>
				<WeeklyBatchView 
					onMarkPaid={handleMarkPaid}
					onExport={handleExport}
				/>
			</div>
		{:else if activeTab === 'reconciliation'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Payment Reconciliation</h3>
				<div class="space-y-4">
					<button class="btn btn-primary" onclick={onOpenReconcile}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						Open Reconciliation
					</button>
					<p class="text-base opacity-70">Reconcile payments and match them with bank statements.</p>
				</div>
			</div>
		{:else if activeTab === 'audit'}
			<div class="space-y-4">
				<h3 class="text-lg font-semibold border-b pb-2">Audit Log</h3>
				<div class="space-y-4">
					<button class="btn btn-primary" type="button" onclick={() => onOpenAudit(auditPaymentId)}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						View Audit Log
					</button>
					<p class="text-base opacity-70">View detailed audit trail of all payroll transactions.</p>
				</div>
			</div>
		{:else if activeTab === 'rate-card'}
			<RateCardManager />
		{/if}
	</div>
</div>

<!-- Modals -->
<PaymentApprovalModal
	bind:isOpen={showApprovalModal}
	payments={getSelectedPayments()}
	on:approve={onPaymentApproved}
	on:close={onCloseApproval}
/>

<PaymentBatchProcessor
	bind:isOpen={showBatchModal}
	payments={getSelectedPayments()}
	on:processed={onPaymentProcessed}
	on:close={onCloseBatch}
/>

<PaymentExport
	bind:isOpen={showExportModal}
	on:exported={onPaymentExported}
	on:close={onCloseExport}
/>

<PaymentReconciliation
	bind:isOpen={showReconcileModal}
	payments={payrollEntries}
	on:reconciled={onPaymentReconciled}
	on:close={onCloseReconcile}
/>

<PaymentAuditLog
	bind:isOpen={showAuditModal}
	paymentId={auditPaymentId}
	on:close={onCloseAudit}
/>

<ExportPayrollEntriesModal
	open={showExportEntriesModal}
	totalCount={pagination?.total ?? 0}
	selectedCount={selectedEntries.size}
	on:confirm={handleEntriesExportConfirm}
	on:close={() => (showExportEntriesModal = false)}
/>

<PayrollGenerationModal
	bind:isOpen={showGenerationModal}
	on:generated={onPayrollGenerated}
	on:close={onCloseGeneration}
/>

<TestModal
	open={showTestModal}
	on:close={() => (showTestModal = false)}
/>