<script lang="ts">
	import type { FacilityFilters } from '$lib/utils/filters'

	interface Props {
		filters: FacilityFilters
		lookupData: {
			partners: Array<{ id: number; name: string }>
			facilityTypes: string[]
			cities: string[]
			states: string[]
		}
		onFiltersChange: (filters: Partial<FacilityFilters>) => void
	}

	let { filters, lookupData, onFiltersChange }: Props = $props()


	// Local state for filters
	let localType = $state(filters.type || '')
	let localPartner = $state(filters.partner?.toString() || '')
	let localCity = $state(filters.city || '')
	let localState = $state(filters.state || '')
	let localHasLocations = $state(filters.has_locations?.toString() || '')
	let localHasContacts = $state(filters.has_contacts?.toString() || '')
	let localLocationCountMin = $state(filters.location_count_min?.toString() || '')
	let localLocationCountMax = $state(filters.location_count_max?.toString() || '')

	// Count active filters (excluding search and sort)
	function getActiveFilterCount(): number {
		let count = 0
		if (localType) count++
		if (localPartner) count++
		if (localCity) count++
		if (localState) count++
		if (localHasLocations) count++
		if (localHasContacts) count++
		if (localLocationCountMin) count++
		if (localLocationCountMax) count++
		return count
	}

	let activeFilterCount = $derived(getActiveFilterCount())

	function applyFilters() {
		const newFilters: Partial<FacilityFilters> = {}
		
		// Only include filters that have values, explicitly set undefined for cleared filters
		newFilters.type = localType || undefined
		newFilters.partner = localPartner ? parseInt(localPartner) : undefined
		newFilters.city = localCity || undefined
		newFilters.state = localState || undefined
		newFilters.has_locations = localHasLocations ? localHasLocations === 'true' : undefined
		newFilters.has_contacts = localHasContacts ? localHasContacts === 'true' : undefined
		newFilters.location_count_min = localLocationCountMin ? parseInt(localLocationCountMin) : undefined
		newFilters.location_count_max = localLocationCountMax ? parseInt(localLocationCountMax) : undefined
		
		onFiltersChange(newFilters)
		// Blur the button to close the dropdown
		if (typeof document !== 'undefined') {
			const activeElement = document.activeElement as HTMLElement
			if (activeElement) {
				activeElement.blur()
			}
		}
	}

	function clearFilters() {
		localType = ''
		localPartner = ''
		localCity = ''
		localState = ''
		localHasLocations = ''
		localHasContacts = ''
		localLocationCountMin = ''
		localLocationCountMax = ''
		applyFilters()
	}

	// Sync local state when props change
	$effect(() => {
		localType = filters.type || ''
		localPartner = filters.partner?.toString() || ''
		localCity = filters.city || ''
		localState = filters.state || ''
		localHasLocations = filters.has_locations?.toString() || ''
		localHasContacts = filters.has_contacts?.toString() || ''
		localLocationCountMin = filters.location_count_min?.toString() || ''
		localLocationCountMax = filters.location_count_max?.toString() || ''
	})
</script>

<div class="dropdown dropdown-end">
	<button
		tabindex="0"
		class="btn btn-sm btn-outline"
		class:btn-active={activeFilterCount > 0}
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
		class="dropdown-content z-[1] card card-compact w-96 p-4 shadow-lg bg-base-100 border border-base-300 mt-2"
	>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="font-semibold text-sm">Filter Facilities</h3>
					{#if activeFilterCount > 0}
						<button class="btn btn-ghost btn-xs" onclick={clearFilters}>
							Clear all
						</button>
					{/if}
				</div>

				<div class="divider my-1"></div>

				<!-- Facility Type -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Type</span>
					</label>
					<select class="select select-sm select-bordered w-full" bind:value={localType}>
						<option value="">All types</option>
						{#each lookupData.facilityTypes as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>

				<!-- Partner -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Partner</span>
					</label>
					<select class="select select-sm select-bordered w-full" bind:value={localPartner}>
						<option value="">All partners</option>
						{#each lookupData.partners as partner}
							<option value={partner.id.toString()}>{partner.name}</option>
						{/each}
					</select>
				</div>

				<!-- City -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">City</span>
					</label>
					<select class="select select-sm select-bordered w-full" bind:value={localCity}>
						<option value="">All cities</option>
						{#each lookupData.cities as city}
							<option value={city}>{city}</option>
						{/each}
					</select>
				</div>

				<!-- State -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">State</span>
					</label>
					<select class="select select-sm select-bordered w-full" bind:value={localState}>
						<option value="">All states</option>
						{#each lookupData.states as state}
							<option value={state}>{state}</option>
						{/each}
					</select>
				</div>

				<!-- Has Locations -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Has Locations</span>
					</label>
					<select class="select select-sm select-bordered w-full" bind:value={localHasLocations}>
						<option value="">All</option>
						<option value="true">Has locations</option>
						<option value="false">No locations</option>
					</select>
				</div>

				<!-- Has Contacts -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Has Contacts</span>
					</label>
					<select class="select select-sm select-bordered w-full" bind:value={localHasContacts}>
						<option value="">All</option>
						<option value="true">Has contacts</option>
						<option value="false">No contacts</option>
					</select>
				</div>

				<!-- Location Count Range -->
				<div class="form-control">
					<label class="label py-1 min-h-0">
						<span class="label-text text-sm font-semibold text-base-content whitespace-normal">Location Count</span>
					</label>
					<div class="flex gap-2">
						<input
							type="number"
							placeholder="Min"
							class="input input-sm input-bordered flex-1"
							bind:value={localLocationCountMin}
							min="0"
						/>
						<input
							type="number"
							placeholder="Max"
							class="input input-sm input-bordered flex-1"
							bind:value={localLocationCountMax}
							min="0"
						/>
					</div>
				</div>

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

