<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	
	interface Props {
		searchValue?: string
		statusFilter?: string
		venueFilter?: string
		programFilter?: string
		partnerFilter?: string
		dateFilter?: string
		dateFrom?: string
		dateTo?: string
		loading?: boolean
		venues?: Array<{ id: number; name: string }>
		programs?: Array<{ id: number; title: string }>
		partners?: Array<{ id: number; name: string }>
		statistics?: any
	}

	let {
		searchValue = '',
		statusFilter = '',
		venueFilter = '',
		programFilter = '',
		partnerFilter = '',
		dateFilter = '',
		dateFrom = '',
		dateTo = '',
		loading = false,
		venues = [],
		programs = [],
		partners = [],
		statistics = {}
	}: Props = $props()

	const dispatch = createEventDispatcher()
	
	let searchTimeout: NodeJS.Timeout
	let isFiltersExpanded = $state(false)
	
	// Status options matching the schema
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]

	// Date filter options
	const dateFilterOptions = [
		{ value: '', label: 'All Dates' },
		{ value: 'upcoming', label: 'Upcoming' },
		{ value: 'past', label: 'Past' },
		{ value: 'this_week', label: 'This Week' },
		{ value: 'this_month', label: 'This Month' },
		{ value: 'custom', label: 'Custom Range' }
	]

	// Debounced search handler
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement
		const value = target.value
		
		clearTimeout(searchTimeout)
		searchTimeout = setTimeout(() => {
			dispatch('search', { value })
		}, 300) // 300ms debounce
	}

	function handleStatusChange(event: Event) {
		const target = event.target as HTMLSelectElement
		dispatch('statusChange', { value: target.value })
	}

	function handleVenueChange(event: Event) {
		const target = event.target as HTMLSelectElement
		dispatch('venueChange', { value: target.value })
	}

	function handleProgramChange(event: Event) {
		const target = event.target as HTMLSelectElement
		dispatch('programChange', { value: target.value })
	}

	function handlePartnerChange(event: Event) {
		const target = event.target as HTMLSelectElement
		dispatch('partnerChange', { value: target.value })
	}

	function handleDateFilterChange(event: Event) {
		const target = event.target as HTMLSelectElement
		dispatch('dateFilterChange', { value: target.value })
	}

	function handleDateFromChange(event: Event) {
		const target = event.target as HTMLInputElement
		dispatch('dateFromChange', { value: target.value })
	}

	function handleDateToChange(event: Event) {
		const target = event.target as HTMLInputElement
		dispatch('dateToChange', { value: target.value })
	}

	function clearAllFilters() {
		dispatch('clearFilters')
	}

	function toggleFilters() {
		isFiltersExpanded = !isFiltersExpanded
	}

	// Check if any filters are active
	let hasActiveFilters = $derived(!!(searchValue || statusFilter || venueFilter || programFilter || partnerFilter || dateFilter || dateFrom || dateTo))
</script>

<div>
	<!-- Compact Search and Filters Row -->
	<div class="flex flex-col sm:flex-row gap-3">
		<!-- Search Bar -->
		<div class="flex-1 min-w-0">
			<div class="relative">
				<input
					type="text"
					placeholder="Search events..."
					class="input input-bordered input-sm w-full pl-9"
					value={searchValue}
					oninput={handleSearchInput}
					disabled={loading}
				/>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
			</div>
		</div>

		<!-- Statistics Badges -->
		{#if statistics && statistics.total > 0}
			<div class="flex flex-wrap gap-2 items-center">
				<div class="badge badge-ghost badge-sm">
					Total: {statistics.total}
				</div>
				{#if statistics.upcoming > 0}
					<div class="badge badge-info badge-sm">
						Upcoming: {statistics.upcoming}
					</div>
				{/if}
				{#if statistics.confirmed > 0}
					<div class="badge badge-primary badge-sm">
						Confirmed: {statistics.confirmed}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Filter Controls -->
		<div class="flex gap-2 flex-none">
			<button
				class="btn btn-outline btn-sm"
				onclick={toggleFilters}
				class:btn-active={isFiltersExpanded}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
				</svg>
				<span class="hidden sm:inline">Filters</span>
				{#if hasActiveFilters}
					<div class="badge badge-primary badge-sm ml-1">
						{[searchValue, statusFilter, venueFilter, programFilter, partnerFilter, dateFilter, dateFrom, dateTo].filter(Boolean).length}
					</div>
				{/if}
			</button>

			{#if hasActiveFilters}
				<button
					class="btn btn-ghost btn-sm"
					onclick={clearAllFilters}
					title="Clear all filters"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Expanded Filters Panel -->
	{#if isFiltersExpanded}
		<div class="mt-4 p-6 bg-base-200 rounded-lg border border-base-300 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
				<!-- Status Filter -->
				<div class="form-control w-full">
					<div class="label pb-2">
						<span class="label-text font-semibold">Status</span>
					</div>
					<select
						class="select select-bordered w-full"
						value={statusFilter}
						onchange={handleStatusChange}
						disabled={loading}
					>
						{#each statusOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Venue Filter -->
				<div class="form-control w-full">
					<div class="label pb-2">
						<span class="label-text font-semibold">Venue</span>
					</div>
					<select
						class="select select-bordered w-full"
						value={venueFilter}
						onchange={handleVenueChange}
						disabled={loading}
					>
						<option value="">All Venues</option>
						{#each venues as venue}
							<option value={venue.id}>{venue.name}</option>
						{/each}
					</select>
				</div>

				<!-- Program Filter -->
				<div class="form-control w-full">
					<div class="label pb-2">
						<span class="label-text font-semibold">Program</span>
					</div>
					<select
						class="select select-bordered w-full"
						value={programFilter}
						onchange={handleProgramChange}
						disabled={loading}
					>
						<option value="">All Programs</option>
						{#each programs as program}
							<option value={program.id}>{program.title}</option>
						{/each}
					</select>
				</div>

				<!-- Partner Filter -->
				<div class="form-control w-full">
					<div class="label pb-2">
						<span class="label-text font-semibold">Partner</span>
					</div>
					<select
						class="select select-bordered w-full"
						value={partnerFilter}
						onchange={handlePartnerChange}
						disabled={loading}
					>
						<option value="">All Partners</option>
						{#each partners as partner}
							<option value={partner.id}>{partner.name}</option>
						{/each}
					</select>
				</div>

				<!-- Date Filter -->
				<div class="form-control w-full">
					<div class="label pb-2">
						<span class="label-text font-semibold">Date Range</span>
					</div>
					<select
						class="select select-bordered w-full"
						value={dateFilter}
						onchange={handleDateFilterChange}
						disabled={loading}
					>
						{#each dateFilterOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<!-- Custom Date Range (only show when custom is selected) -->
				{#if dateFilter === 'custom'}
					<div class="form-control w-full">
						<div class="label pb-2">
							<span class="label-text font-semibold">From Date</span>
						</div>
						<input
							type="date"
							class="input input-bordered w-full"
							value={dateFrom}
							onchange={handleDateFromChange}
							disabled={loading}
						/>
					</div>
					<div class="form-control w-full">
						<div class="label pb-2">
							<span class="label-text font-semibold">To Date</span>
						</div>
						<input
							type="date"
							class="input input-bordered w-full"
							value={dateTo}
							onchange={handleDateToChange}
							disabled={loading}
						/>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Loading Indicator -->
	{#if loading}
		<div class="flex items-center justify-center mt-4">
			<span class="loading loading-spinner loading-sm mr-2"></span>
			<span class="text-sm opacity-70">Filtering events...</span>
		</div>
	{/if}
</div>