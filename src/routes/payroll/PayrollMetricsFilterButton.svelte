<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import PayrollMetricsFilterModal from './PayrollMetricsFilterModal.svelte'

	const dispatch = createEventDispatcher<{
		filterChange: {
			dateRange: string
			paymentType: string
			artistId: string
		}
	}>()

	interface Props {
		dateRange?: string
		paymentType?: string
		artistId?: string
	}

	let { dateRange = 'all', paymentType = 'all', artistId = 'all' }: Props = $props()

	// Modal state
	let showModal = $state(false)

	// Check if any filters are active
	let hasActiveFilters = $derived(
		dateRange !== 'all' || paymentType !== 'all' || artistId !== 'all'
	)

	// Get active filter count
	let activeFilterCount = $derived(
		(dateRange !== 'all' ? 1 : 0) +
		(paymentType !== 'all' ? 1 : 0) +
		(artistId !== 'all' ? 1 : 0)
	)

	function openModal() {
		showModal = true
	}

	function closeModal() {
		showModal = false
	}

	function handleFilterChange(event: CustomEvent<{
		dateRange: string
		paymentType: string
		artistId: string
	}>) {
		dispatch('filterChange', event.detail)
	}

	// Get current filter summary text
	let filterSummary = $derived.by(() => {
		if (!hasActiveFilters) return 'Filter metrics'
		
		const filters = []
		if (dateRange !== 'all') {
			const option = dateRangeOptions.find(opt => opt.value === dateRange)
			filters.push(option?.label || dateRange)
		}
		if (paymentType !== 'all') {
			const option = paymentTypeOptions.find(opt => opt.value === paymentType)
			filters.push(option?.label || paymentType)
		}
		if (artistId !== 'all') {
			filters.push('Specific Artist')
		}
		
		return filters.join(', ')
	})

	// Options for display (same as modal)
	const dateRangeOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: 'last30', label: 'Last 30 Days' },
		{ value: 'last90', label: 'Last 90 Days' },
		{ value: 'mtd', label: 'Month to Date' },
		{ value: 'ytd', label: 'Year to Date' }
	]

	const paymentTypeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'performance', label: 'Performance' },
		{ value: 'special_event', label: 'Special Event' },
		{ value: 'training', label: 'Training' },
		{ value: 'other', label: 'Other' }
	]
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
			{hasActiveFilters ? 'Metrics Filtered' : 'Filter Metrics'}
		</span>
		
		<span class="sm:hidden">
			Filter
		</span>
		
		{#if hasActiveFilters}
			<span class="badge badge-sm badge-primary">{activeFilterCount}</span>
		{/if}
	</button>
</div>

<PayrollMetricsFilterModal
	bind:open={showModal}
	{dateRange}
	{paymentType}
	{artistId}
	on:filterChange={handleFilterChange}
	on:close={closeModal}
/>