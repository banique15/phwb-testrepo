<script lang="ts">
	import type { Payroll } from '$lib/schemas/payroll'
	import type { ComponentType, SvelteComponent } from 'svelte'
	import { ClipboardList, CheckCircle, Search, BarChart } from 'lucide-svelte'
	import PayrollInlineTable from '../PayrollInlineTable.svelte'
	import PayrollFiltersButton from '../PayrollFiltersButton.svelte'
	import PayrollMetricsFilterButton from '../PayrollMetricsFilterButton.svelte'
	import PayrollBulkActions from '../PayrollBulkActions.svelte'
	import PaymentApprovalModal from '$lib/components/payroll/PaymentApprovalModal.svelte'
	import PaymentBatchProcessor from '$lib/components/payroll/PaymentBatchProcessor.svelte'
	import PaymentExport from '$lib/components/payroll/PaymentExport.svelte'
	import PaymentAuditLog from '$lib/components/payroll/PaymentAuditLog.svelte'
	import PaymentReconciliation from '$lib/components/payroll/PaymentReconciliation.svelte'

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
		auditPaymentId: number
		getSelectedPayments: () => Payroll[]
		onCloseApproval: () => void
		onCloseBatch: () => void
		onCloseExport: () => void
		onCloseAudit: () => void
		onCloseReconcile: () => void
		onOpenApproval: () => void
		onOpenBatch: () => void
		onOpenExport: () => void
		onOpenAudit: () => void
		onOpenReconcile: () => void
		onPaymentApproved: () => Promise<void>
		onPaymentProcessed: () => Promise<void>
		onPaymentReconciled: () => Promise<void>
		onPaymentExported: () => void
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
		auditPaymentId,
		getSelectedPayments,
		onCloseApproval,
		onCloseBatch,
		onCloseExport,
		onCloseAudit,
		onCloseReconcile,
		onOpenApproval,
		onOpenBatch,
		onOpenExport,
		onOpenAudit,
		onOpenReconcile,
		onPaymentApproved,
		onPaymentProcessed,
		onPaymentReconciled,
		onPaymentExported
	}: Props = $props()

	const tabs: Array<{ id: string; label: string; icon: ComponentType<SvelteComponent> }> = [
		{ id: 'entries', label: 'Entries', icon: ClipboardList },
		{ id: 'approvals', label: 'Approvals', icon: CheckCircle },
		{ id: 'reconciliation', label: 'Reconciliation', icon: Search },
		{ id: 'audit', label: 'Audit', icon: BarChart }
	]

	let activeTab = $state<string>(
		(typeof window !== 'undefined' ? localStorage.getItem('phwb-payroll-active-tab') : null) || 'entries'
	)

	function setActiveTab(tabId: string) {
		activeTab = tabId
		if (typeof window !== 'undefined') {
			localStorage.setItem('phwb-payroll-active-tab', tabId)
		}
	}
</script>

<div class="flex flex-col h-full min-h-0">
	<!-- Tab Navigation -->
	<div class="flex-none mb-3">
		<div class="tabs tabs-boxed">
			{#each tabs as tab}
				<button
					class="tab {activeTab === tab.id ? 'tab-active' : ''}"
					onclick={() => setActiveTab(tab.id)}
				>
					<svelte:component this={tab.icon} class="w-4 h-4 mr-2" />
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 min-h-0 overflow-y-auto">
		{#if activeTab === 'entries'}
			<div class="space-y-4">
				<!-- Metrics Filter -->
				<div class="flex justify-end">
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
					<button class="btn btn-primary" onclick={onOpenAudit}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						View Audit Log
					</button>
					<p class="text-base opacity-70">View detailed audit trail of all payroll transactions.</p>
				</div>
			</div>
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

