<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import type { Payroll } from '$lib/schemas/payroll'
	import { DollarSign } from 'lucide-svelte'
	import DataTable from '$lib/components/ui/DataTable.svelte'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
	import PaymentStatusBadge from '$lib/components/payroll/PaymentStatusBadge.svelte'

	interface Props {
		entries: Payroll[]
		loading: boolean
		searchQuery: string
		selectedEntries: Set<number>
		pagination: {
			currentPage: number
			totalPages: number
			total: number
			limit: number
		}
		sortBy: string
		sortOrder: 'asc' | 'desc'
		actions?: import('svelte').Snippet
	}

	let {
		entries = [],
		loading = false,
		searchQuery = '',
		selectedEntries = new Set(),
		pagination,
		sortBy = 'event_date',
		sortOrder = 'desc',
		actions
	}: Props = $props()

	const dispatch = createEventDispatcher<{
		search: { value: string }
		sort: { key: string; order: 'asc' | 'desc' }
		pageChange: { page: number }
		select: { entries: Set<number> }
		edit: { entry: Payroll }
	}>()

	// Define table columns
	const columns = [
		{
			key: 'event_date',
			label: 'Event Date',
			sortable: true,
			width: '120px',
			render: (entry: Payroll) => formatDate(entry.event_date)
		},
		{
			key: 'artist_name',
			label: 'Artist',
			sortable: true,
			render: (entry: Payroll) => entry.artists?.full_name || (entry.artists?.legal_first_name + ' ' + entry.artists?.legal_last_name) || 'N/A'
		},
		{
			key: 'payment_type',
			label: 'Type',
			sortable: true,
			width: '120px',
			render: (entry: Payroll) => formatPaymentType(entry.payment_type)
		},
		{
			key: 'employee_contractor_status',
			label: 'Status',
			sortable: true,
			width: '120px',
			render: (entry: Payroll) => formatEmployeeStatus(entry.employee_contractor_status)
		},
		{
			key: 'hours',
			label: 'Hours',
			sortable: true,
			width: '80px',
			render: (entry: Payroll) => entry.hours?.toString() || '0'
		},
		{
			key: 'rate',
			label: 'Rate',
			sortable: true,
			width: '100px',
			render: (entry: Payroll) => formatCurrency(entry.rate || 0)
		},
		{
			key: 'additional_pay',
			label: 'Additional',
			sortable: true,
			width: '100px',
			render: (entry: Payroll) => formatCurrency(entry.additional_pay || 0)
		},
		{
			key: 'total_pay',
			label: 'Total Pay',
			sortable: true,
			width: '120px',
			render: (entry: Payroll) => formatCurrency(calculateTotalPay(entry))
		},
		{
			key: 'status',
			label: 'Payment Status',
			sortable: true,
			width: '120px',
			render: (entry: Payroll) => ''
		},
		{
			key: 'paid_date',
			label: 'Paid Date',
			sortable: true,
			width: '120px',
			render: (entry: Payroll) => entry.paid_date ? formatDate(entry.paid_date) : '-'
		}
	]

	// Handle row selection
	function handleRowSelect(entry: Payroll) {
		if (!entry.id) return

		const newSelected = new Set(selectedEntries)
		if (newSelected.has(entry.id)) {
			newSelected.delete(entry.id)
		} else {
			newSelected.add(entry.id)
		}
		
		dispatch('select', { entries: newSelected })
	}

	// Handle select all
	function handleSelectAll() {
		const allIds = entries.filter(e => e.id).map(e => e.id!)
		const newSelected = selectedEntries.size === allIds.length ? new Set() : new Set(allIds)
		dispatch('select', { entries: newSelected })
	}

	// Handle search
	function handleSearch(event: CustomEvent<{ value: string }>) {
		dispatch('search', event.detail)
	}

	// Handle sort
	function handleSort(event: CustomEvent<{ key: string; order: 'asc' | 'desc' }>) {
		dispatch('sort', event.detail)
	}

	// Handle page change
	function handlePageChange(event: CustomEvent<{ page: number }>) {
		dispatch('pageChange', event.detail)
	}

	// Helper functions
	function formatDate(dateStr: string): string {
		if (!dateStr) return '-'
		return new Date(dateStr).toLocaleDateString()
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount)
	}

	function formatPaymentType(type: string | undefined): string {
		if (!type) return '-'
		return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
	}

	function formatEmployeeStatus(status: string | undefined): string {
		if (!status) return '-'
		return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
	}

	function calculateTotalPay(entry: Payroll): number {
		if (entry.total_pay) return entry.total_pay
		const base = (entry.hours || 0) * (entry.rate || 0)
		return base + (entry.additional_pay || 0)
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'Paid': return 'badge-success'
			case 'Unpaid': return 'badge-warning'
			case 'Planned': return 'badge-info'
			case 'Cancelled': return 'badge-error'
			default: return 'badge-ghost'
		}
	}

	// Check if row is selected
	function isRowSelected(entry: Payroll): boolean {
		return entry.id ? selectedEntries.has(entry.id) : false
	}

	// Check if all rows are selected
	let allSelected = $derived(entries.length > 0 && entries.every(e => e.id && selectedEntries.has(e.id)))
	let someSelected = $derived(selectedEntries.size > 0 && !allSelected)
</script>

<div class="space-y-4">
	<!-- Search and bulk actions header -->
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-4">
			<div class="form-control">
				<input
					type="text"
					placeholder="Search payroll entries..."
					class="input input-bordered w-80"
					value={searchQuery}
					oninput={(e) => handleSearch(new CustomEvent('search', { detail: { value: e.target.value } }))}
				/>
			</div>
			{#if selectedEntries.size > 0}
				<span class="text-sm text-base-content/70">
					{selectedEntries.size} selected
				</span>
			{/if}
		</div>
		{#if actions}
			<div class="flex items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>

	<!-- Loading state -->
	{#if loading}
		<div class="flex justify-center py-8">
			<LoadingSpinner size="lg" />
		</div>
	{:else if entries.length === 0}
		<!-- Empty state -->
		<div class="text-center py-12">
			<DollarSign class="w-16 h-16 mx-auto mb-4 text-base-content/70" />
			<h3 class="text-lg font-semibold mb-2">No payroll entries found</h3>
			<p class="text-base-content/60">
				{searchQuery ? 'Try adjusting your search or filters' : 'Create your first payroll entry to get started'}
			</p>
		</div>
	{:else}
		<!-- Data table -->
		<div class="overflow-x-auto">
			<table class="table table-zebra w-full">
				<thead>
					<tr>
						<th class="w-12">
							<label class="cursor-pointer">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={allSelected}
									indeterminate={someSelected}
									onchange={handleSelectAll}
								/>
							</label>
						</th>
						{#each columns as column}
							<th 
								class="cursor-pointer hover:bg-base-200 whitespace-nowrap {column.width ? '' : ''}"
								style={column.width ? `width: ${column.width}; min-width: ${column.width};` : ''}
								onclick={() => {
									const newOrder = sortBy === column.key && sortOrder === 'asc' ? 'desc' : 'asc'
									handleSort(new CustomEvent('sort', { detail: { key: column.key, order: newOrder } }))
								}}
							>
								<div class="flex items-center gap-2">
									<span class="whitespace-nowrap">{column.label}</span>
									{#if column.sortable}
										<div class="flex flex-col flex-shrink-0">
											<svg 
												class="w-3 h-3 {sortBy === column.key && sortOrder === 'asc' ? 'text-primary' : 'text-base-content/30'}"
												fill="currentColor" 
												viewBox="0 0 20 20"
											>
												<path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
											</svg>
											<svg 
												class="w-3 h-3 -mt-1 {sortBy === column.key && sortOrder === 'desc' ? 'text-primary' : 'text-base-content/30'}"
												fill="currentColor" 
												viewBox="0 0 20 20"
											>
												<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
											</svg>
										</div>
									{/if}
								</div>
							</th>
						{/each}
						<th class="w-32">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each entries as entry}
						<tr 
							class="hover:bg-base-200 cursor-pointer"
							class:bg-primary={isRowSelected(entry)}
							class:bg-opacity-10={isRowSelected(entry)}
							onclick={() => dispatch('edit', { entry })}
						>
							<td onclick={(e) => e.stopPropagation()}>
								<label class="cursor-pointer">
									<input
										type="checkbox"
										class="checkbox checkbox-sm"
										checked={isRowSelected(entry)}
										onchange={() => handleRowSelect(entry)}
									/>
								</label>
							</td>
							
							<!-- Event Date -->
							<td class="whitespace-nowrap">{formatDate(entry.event_date)}</td>
							
							<!-- Artist -->
							<td class="whitespace-nowrap">
								<div class="font-medium">
									{entry.artists?.full_name || (entry.artists?.legal_first_name + ' ' + entry.artists?.legal_last_name) || 'N/A'}
								</div>
							</td>
							
							<!-- Payment Type -->
							<td class="whitespace-nowrap">
								<span class="badge badge-outline badge-sm">
									{formatPaymentType(entry.payment_type)}
								</span>
							</td>
							
							<!-- Employee Status -->
							<td class="whitespace-nowrap">
								<span class="badge badge-outline badge-sm">
									{formatEmployeeStatus(entry.employee_contractor_status)}
								</span>
							</td>
							
							<!-- Hours -->
							<td class="text-right whitespace-nowrap">{entry.hours || 0}</td>
							
							<!-- Rate -->
							<td class="text-right whitespace-nowrap">{formatCurrency(entry.rate || 0)}</td>
							
							<!-- Additional Pay -->
							<td class="text-right whitespace-nowrap">{formatCurrency(entry.additional_pay || 0)}</td>
							
							<!-- Total Pay -->
							<td class="text-right font-semibold whitespace-nowrap">
								{formatCurrency(calculateTotalPay(entry))}
							</td>
							
							<!-- Payment Status -->
							<td class="whitespace-nowrap">
								<PaymentStatusBadge status={entry.status} size="sm" />
							</td>
							
							<!-- Paid Date -->
							<td class="whitespace-nowrap">{entry.paid_date ? formatDate(entry.paid_date) : '-'}</td>
							
							<!-- Actions -->
							<!-- TODO: Add audit log functionality back as a separate feature -->
							<td class="whitespace-nowrap">
								<div class="text-sm text-base-content/60">
									Click to edit
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if pagination && pagination.totalPages > 1}
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
				<div class="text-sm text-base-content/60 order-2 sm:order-1">
					Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to {Math.min(pagination.currentPage * pagination.limit, pagination.total)} of {pagination.total} entries
				</div>
				
				<div class="flex justify-center order-1 sm:order-2">
					<div class="join">
						<button 
							class="join-item btn btn-sm"
							class:btn-disabled={pagination.currentPage <= 1}
							onclick={() => handlePageChange(new CustomEvent('pageChange', { detail: { page: pagination.currentPage - 1 } }))}
						>
							<span class="hidden sm:inline">Previous</span>
							<span class="sm:hidden">‹</span>
						</button>
						
						{#each Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
							const totalPages = pagination.totalPages
							const current = pagination.currentPage
							if (totalPages <= 7) return i + 1
							if (current <= 4) return i + 1
							if (current >= totalPages - 3) return totalPages - 6 + i
							return current - 3 + i
						}) as pageNum}
							<button 
								class="join-item btn btn-sm"
								class:btn-active={pageNum === pagination.currentPage}
								onclick={() => handlePageChange(new CustomEvent('pageChange', { detail: { page: pageNum } }))}
							>
								{pageNum}
							</button>
						{/each}
						
						<button 
							class="join-item btn btn-sm"
							class:btn-disabled={pagination.currentPage >= pagination.totalPages}
							onclick={() => handlePageChange(new CustomEvent('pageChange', { detail: { page: pagination.currentPage + 1 } }))}
						>
							<span class="hidden sm:inline">Next</span>
							<span class="sm:hidden">›</span>
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>