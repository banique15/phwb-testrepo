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
		hideSearch?: boolean
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
		statistics = {},
		hideSearch = false
	}: Props = $props()

	const dispatch = createEventDispatcher()
	
	// Local state for filters
	let localStatus = $state(statusFilter || '')
	let localVenue = $state(venueFilter || '')
	let localProgram = $state(programFilter || '')
	let localPartner = $state(partnerFilter || '')
	let localDateFilter = $state(dateFilter || '')
	let localDateFrom = $state(dateFrom || '')
	let localDateTo = $state(dateTo || '')

	// Status options matching the schema
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'draft', label: 'Draft' }
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

	// Count active filters (excluding search)
	function getActiveFilterCount(): number {
		let count = 0
		if (localStatus) count++
		if (localVenue) count++
		if (localProgram) count++
		if (localPartner) count++
		if (localDateFilter) count++
		if (localDateFrom) count++
		if (localDateTo) count++
		return count
	}

	let activeFilterCount = $derived(getActiveFilterCount())

	// Sync local state when props change
	$effect(() => {
		localStatus = statusFilter || ''
		localVenue = venueFilter || ''
		localProgram = programFilter || ''
		localPartner = partnerFilter || ''
		localDateFilter = dateFilter || ''
		localDateFrom = dateFrom || ''
		localDateTo = dateTo || ''
	})

	// Clear custom dates when date filter changes away from custom
	$effect(() => {
		if (localDateFilter !== 'custom') {
			if (localDateFrom) {
				localDateFrom = ''
			}
			if (localDateTo) {
				localDateTo = ''
			}
		}
	})

	function applyFilters() {
		dispatch('statusChange', { value: localStatus })
		dispatch('venueChange', { value: localVenue })
		dispatch('programChange', { value: localProgram })
		dispatch('partnerChange', { value: localPartner })
		dispatch('dateFilterChange', { value: localDateFilter })
		// Only dispatch date from/to if custom is selected
		if (localDateFilter === 'custom') {
			dispatch('dateFromChange', { value: localDateFrom || '' })
			dispatch('dateToChange', { value: localDateTo || '' })
		} else {
			// Clear custom dates when not using custom filter
			dispatch('dateFromChange', { value: '' })
			dispatch('dateToChange', { value: '' })
		}
		// Blur the button to close the dropdown
		if (typeof document !== 'undefined') {
			const activeElement = document.activeElement as HTMLElement
			if (activeElement) {
				activeElement.blur()
			}
		}
	}

	function clearFilters() {
		localStatus = ''
		localVenue = ''
		localProgram = ''
		localPartner = ''
		localDateFilter = ''
		localDateFrom = ''
		localDateTo = ''
		dispatch('clearFilters')
		// Blur the button to close the dropdown
		if (typeof document !== 'undefined') {
			const activeElement = document.activeElement as HTMLElement
			if (activeElement) {
				activeElement.blur()
			}
		}
	}
</script>

<div class="dropdown dropdown-end">
	<button
		tabindex="0"
		class="btn btn-sm border border-base-content/20 bg-base-100 hover:bg-base-200 text-base-content"
		class:btn-active={activeFilterCount > 0}
		class:border-primary={activeFilterCount > 0}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
			/>
		</svg>
		Filters
		{#if activeFilterCount > 0}
			<span class="badge badge-sm badge-primary ml-1">{activeFilterCount}</span>
		{/if}
	</button>
	<div
		tabindex="0"
		class="dropdown-content z-[1] card card-compact w-96 p-4 shadow-lg bg-base-100 border border-base-300 mt-2 max-h-[80vh] overflow-y-auto"
	>
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h3 class="font-semibold text-sm">Filter Events</h3>
				{#if activeFilterCount > 0}
					<button class="btn btn-ghost btn-xs" onclick={clearFilters}>
						Clear all
					</button>
				{/if}
			</div>

			<!-- Statistics Section -->
			{#if statistics && statistics.total !== undefined}
				<div class="divider my-1"></div>
				<div class="space-y-2">
					<h4 class="text-xs font-semibold text-base-content/70 uppercase tracking-wide">Statistics</h4>
					<div class="grid grid-cols-3 gap-2">
						<div class="stat bg-base-200 rounded-lg p-2">
							<div class="stat-title text-xs">Total</div>
							<div class="stat-value text-lg">{statistics.total || 0}</div>
						</div>
						<div class="stat bg-info/10 rounded-lg p-2">
							<div class="stat-title text-xs">Upcoming</div>
							<div class="stat-value text-lg text-info">{statistics.upcoming || 0}</div>
						</div>
						<div class="stat bg-primary/10 rounded-lg p-2">
							<div class="stat-title text-xs">Confirmed</div>
							<div class="stat-value text-lg text-primary">{statistics.confirmed || 0}</div>
						</div>
					</div>
				</div>
			{/if}

			<div class="divider my-1"></div>

			<!-- Status Filter -->
			<div class="form-control">
				<label class="label py-2 min-h-[2.5rem]">
					<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Status</span>
				</label>
				<select class="select select-bordered w-full h-10" bind:value={localStatus}>
					{#each statusOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Venue Filter -->
			<div class="form-control">
				<label class="label py-2 min-h-[2.5rem]">
					<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Venue</span>
				</label>
				<select class="select select-bordered w-full h-10" bind:value={localVenue}>
					<option value="">All Venues</option>
					{#each venues as venue}
						<option value={venue.id.toString()}>{venue.name}</option>
					{/each}
				</select>
			</div>

			<!-- Program Filter -->
			<div class="form-control">
				<label class="label py-2 min-h-[2.5rem]">
					<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Program</span>
				</label>
				<select class="select select-bordered w-full h-10" bind:value={localProgram}>
					<option value="">All Programs</option>
					{#each programs as program}
						<option value={program.id.toString()}>{program.title}</option>
					{/each}
				</select>
			</div>

			<!-- Partner Filter -->
			<div class="form-control">
				<label class="label py-2 min-h-[2.5rem]">
					<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Partner</span>
				</label>
				<select class="select select-bordered w-full h-10" bind:value={localPartner}>
					<option value="">All Partners</option>
					{#each partners as partner}
						<option value={partner.id.toString()}>{partner.name}</option>
					{/each}
				</select>
			</div>

			<!-- Date Filter -->
			<div class="form-control">
				<label class="label py-2 min-h-[2.5rem]">
					<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Date Range</span>
				</label>
				<select class="select select-bordered w-full h-10" bind:value={localDateFilter}>
					{#each dateFilterOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Custom Date Range (only show when custom is selected) -->
			{#if localDateFilter === 'custom'}
				<div class="form-control">
					<label class="label py-2 min-h-[2.5rem]">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">From Date</span>
					</label>
					<input
						type="date"
						class="input input-bordered w-full h-10"
						bind:value={localDateFrom}
					/>
				</div>
				<div class="form-control">
					<label class="label py-2 min-h-[2.5rem]">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">To Date</span>
					</label>
					<input
						type="date"
						class="input input-bordered w-full h-10"
						bind:value={localDateTo}
					/>
				</div>
			{/if}

			<div class="divider my-1"></div>

			<div class="flex gap-2">
				<button class="btn btn-primary btn-sm flex-1" onclick={applyFilters}>
					Apply Filters
				</button>
				{#if activeFilterCount > 0}
					<button class="btn btn-ghost btn-sm" onclick={clearFilters}>
						Clear
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
