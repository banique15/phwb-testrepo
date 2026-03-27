<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import PayrollFiltersModal from './PayrollFiltersModal.svelte'

	const dispatch = createEventDispatcher<{
		filtersChange: {
			status: string
			paymentType: string
			employeeContractor: string
			dateStart: string
			dateEnd: string
		}
	}>()

	interface Props {
		statusFilter?: string
		paymentTypeFilter?: string
		employeeContractorFilter?: string
		dateRangeStart?: string
		dateRangeEnd?: string
	}

	let { 
		statusFilter = '', 
		paymentTypeFilter = '', 
		employeeContractorFilter = '', 
		dateRangeStart = '', 
		dateRangeEnd = '' 
	}: Props = $props()

	// Modal state
	let showModal = $state(false)

	// Check if any filters are active
	let hasActiveFilters = $derived(
		statusFilter !== '' || 
		paymentTypeFilter !== '' || 
		employeeContractorFilter !== '' || 
		dateRangeStart !== '' || 
		dateRangeEnd !== ''
	)

	// Get active filter count
	let activeFilterCount = $derived(
		[statusFilter, paymentTypeFilter, employeeContractorFilter, dateRangeStart, dateRangeEnd]
			.filter(filter => filter !== '').length
	)

	function openModal() {
		showModal = true
	}

	function closeModal() {
		showModal = false
	}

	function handleFiltersChange(event: CustomEvent<{
		status: string
		paymentType: string
		employeeContractor: string
		dateStart: string
		dateEnd: string
	}>) {
		dispatch('filtersChange', event.detail)
	}

	// Status options for display
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'Planned', label: 'Planned' },
		{ value: 'Approved', label: 'Approved' },
		{ value: 'Paid', label: 'Paid' },
		{ value: 'With Issues', label: 'With Issues' },
		{ value: 'Cancelled', label: 'Cancelled' }
	]

	const paymentTypeOptions = [
		{ value: '', label: 'All Types' },
		{ value: 'performance', label: 'Performance' },
		{ value: 'training', label: 'Training' },
		{ value: 'special_event', label: 'Special Event' },
		{ value: 'other', label: 'Other' }
	]

	const employeeContractorOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'W-2', label: 'W-2' },
		{ value: '1099', label: '1099' }
	]

	// Get current filter summary text
	let filterSummary = $derived.by(() => {
		if (!hasActiveFilters) return 'Filter records'
		
		const filters = []
		if (statusFilter !== '') {
			const option = statusOptions.find(opt => opt.value === statusFilter)
			filters.push(option?.label || statusFilter)
		}
		if (paymentTypeFilter !== '') {
			const option = paymentTypeOptions.find(opt => opt.value === paymentTypeFilter)
			filters.push(option?.label || paymentTypeFilter)
		}
		if (employeeContractorFilter !== '') {
			const option = employeeContractorOptions.find(opt => opt.value === employeeContractorFilter)
			filters.push(option?.label || employeeContractorFilter)
		}
		if (dateRangeStart !== '' || dateRangeEnd !== '') {
			filters.push('Date Range')
		}
		
		return filters.join(', ')
	})
</script>

<div class="flex items-center gap-3">
	<button
		class="btn btn-outline btn-sm {hasActiveFilters ? 'btn-primary' : ''}"
		onclick={openModal}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
		</svg>
		
		<span class="hidden sm:inline">
			{hasActiveFilters ? 'Records Filtered' : 'Filter Records'}
		</span>
		
		<span class="sm:hidden">
			Filter
		</span>
		
		{#if hasActiveFilters}
			<span class="badge badge-sm badge-primary">{activeFilterCount}</span>
		{/if}
	</button>
</div>

<PayrollFiltersModal
	bind:open={showModal}
	{statusFilter}
	{paymentTypeFilter}
	{employeeContractorFilter}
	{dateRangeStart}
	{dateRangeEnd}
	on:filtersChange={handleFiltersChange}
	on:close={closeModal}
/>