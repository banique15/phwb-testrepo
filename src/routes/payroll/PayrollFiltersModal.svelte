<script lang="ts">
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher<{
		filtersChange: {
			status: string
			paymentType: string
			employeeContractor: string
			dateStart: string
			dateEnd: string
		}
		close: void
	}>()

	interface Props {
		open?: boolean
		statusFilter?: string
		paymentTypeFilter?: string
		employeeContractorFilter?: string
		dateRangeStart?: string
		dateRangeEnd?: string
	}

	let { 
		open = false, 
		statusFilter = '', 
		paymentTypeFilter = '', 
		employeeContractorFilter = '', 
		dateRangeStart = '', 
		dateRangeEnd = '' 
	}: Props = $props()

	// Local state for the modal
	let localStatus = $state(statusFilter)
	let localPaymentType = $state(paymentTypeFilter)
	let localEmployeeContractor = $state(employeeContractorFilter)
	let localDateStart = $state(dateRangeStart)
	let localDateEnd = $state(dateRangeEnd)

	let modalElement: HTMLDialogElement

	// Status options
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'Planned', label: 'Planned' },
		{ value: 'Unpaid', label: 'Unpaid' },
		{ value: 'Paid', label: 'Paid' },
		{ value: 'Cancelled', label: 'Cancelled' }
	]

	// Payment type options
	const paymentTypeOptions = [
		{ value: '', label: 'All Types' },
		{ value: 'performance', label: 'Performance' },
		{ value: 'training', label: 'Training' },
		{ value: 'special_event', label: 'Special Event' },
		{ value: 'other', label: 'Other' }
	]

	// Employee contractor status options
	const employeeContractorOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'employee', label: 'Employee' },
		{ value: 'contractor', label: 'Contractor' },
		{ value: 'roster_artist', label: 'Roster Artist' }
	]

	// Watch for open prop changes to control modal
	$effect(() => {
		if (modalElement) {
			if (open) {
				// Reset local state to current values when opening
				localStatus = statusFilter
				localPaymentType = paymentTypeFilter
				localEmployeeContractor = employeeContractorFilter
				localDateStart = dateRangeStart
				localDateEnd = dateRangeEnd
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})

	function handleClose() {
		dispatch('close')
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalElement) {
			handleClose()
		}
	}

	function handleApply() {
		dispatch('filtersChange', {
			status: localStatus,
			paymentType: localPaymentType,
			employeeContractor: localEmployeeContractor,
			dateStart: localDateStart,
			dateEnd: localDateEnd
		})
		handleClose()
	}

	function handleReset() {
		localStatus = ''
		localPaymentType = ''
		localEmployeeContractor = ''
		localDateStart = ''
		localDateEnd = ''
		dispatch('filtersChange', {
			status: '',
			paymentType: '',
			employeeContractor: '',
			dateStart: '',
			dateEnd: ''
		})
		handleClose()
	}

	// Quick filter actions
	function applyQuickFilter(filterType: string) {
		switch (filterType) {
			case 'unpaid':
				localStatus = 'Unpaid'
				break
			case 'paid_last_30':
				localStatus = 'Paid'
				const now = new Date()
				const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
				localDateStart = thirtyDaysAgo.toISOString().split('T')[0]
				localDateEnd = now.toISOString().split('T')[0]
				break
			case 'performances':
				localPaymentType = 'performance'
				break
			case 'contractors':
				localEmployeeContractor = 'contractor'
				break
			case 'upcoming_week':
				const today = new Date()
				const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
				localDateStart = today.toISOString().split('T')[0]
				localDateEnd = nextWeek.toISOString().split('T')[0]
				localStatus = 'Planned'
				break
		}
	}

	// Check if any filters are active
	let hasActiveFilters = $derived(
		statusFilter !== '' || 
		paymentTypeFilter !== '' || 
		employeeContractorFilter !== '' || 
		dateRangeStart !== '' || 
		dateRangeEnd !== ''
	)
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box max-w-2xl">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg">Filter Records</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
			>
				✕
			</button>
		</div>

		<div class="space-y-6">
			<!-- Main Filters Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<!-- Status Filter -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Status</span>
					</label>
					<select 
						class="select select-bordered"
						bind:value={localStatus}
					>
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
					<select 
						class="select select-bordered"
						bind:value={localPaymentType}
					>
						{#each paymentTypeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Employee Status Filter -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-medium">Employee Status</span>
					</label>
					<select 
						class="select select-bordered"
						bind:value={localEmployeeContractor}
					>
						{#each employeeContractorOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Date Range -->
			<div class="form-control">
				<label class="label">
					<span class="label-text font-medium">Date Range</span>
				</label>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div class="form-control">
						<label class="label">
							<span class="label-text-alt">Start Date</span>
						</label>
						<input 
							type="date"
							class="input input-bordered"
							bind:value={localDateStart}
						/>
					</div>
					<div class="form-control">
						<label class="label">
							<span class="label-text-alt">End Date</span>
						</label>
						<input 
							type="date"
							class="input input-bordered"
							bind:value={localDateEnd}
						/>
					</div>
				</div>
			</div>

			<!-- Quick Filters -->
			<div class="divider">Quick Filters</div>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => applyQuickFilter('unpaid')}
				>
					Unpaid
				</button>
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => applyQuickFilter('paid_last_30')}
				>
					Paid Last 30 Days
				</button>
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => applyQuickFilter('performances')}
				>
					Performances Only
				</button>
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => applyQuickFilter('contractors')}
				>
					Contractors Only
				</button>
				<button 
					class="btn btn-outline btn-sm"
					onclick={() => applyQuickFilter('upcoming_week')}
				>
					Upcoming This Week
				</button>
			</div>
		</div>

		<!-- Modal Actions -->
		<div class="modal-action">
			<button class="btn btn-outline" onclick={handleReset}>
				Reset All
			</button>
			<button class="btn btn-outline" onclick={handleClose}>
				Cancel
			</button>
			<button class="btn btn-primary" onclick={handleApply}>
				Apply Filters
			</button>
		</div>
	</div>

	<!-- Backdrop -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>