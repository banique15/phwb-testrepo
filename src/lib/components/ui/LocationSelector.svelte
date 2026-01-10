<script lang="ts">
	import { untrack } from 'svelte'
	import { supabase } from '$lib/supabase'
	import type { LocationWithFacility } from '$lib/schemas/location'

	interface Props {
		value?: number | null
		onchange?: (locationId: number | null, location?: LocationWithFacility | null) => void
		disabled?: boolean
		required?: boolean
		placeholder?: string
		error?: string
	}

	let {
		value = null,
		onchange,
		disabled = false,
		required = false,
		placeholder = 'Search for a location...',
		error
	}: Props = $props()

	// Component state
	let searchQuery = $state('')
	let isOpen = $state(false)
	let isLoading = $state(false)
	let locations = $state<LocationWithFacility[]>([])
	let selectedLocation = $state<LocationWithFacility | null>(null)
	let highlightedIndex = $state(-1)
	let searchTimeout: number | undefined
	let lastLoadedValue: number | null = null

	// Input element reference for focus management
	let inputElement: HTMLInputElement

	// Watch for value changes to update selected location
	$effect(() => {
		// Read value (this creates the dependency)
		const currentValue = value
		
		// Use untrack to prevent tracking other state changes
		untrack(() => {
			// Only load if value changed and we haven't already loaded this value
			if (currentValue != null && currentValue !== lastLoadedValue) {
				lastLoadedValue = currentValue
				loadSelectedLocation(currentValue)
			} else if (currentValue == null && lastLoadedValue !== null) {
				lastLoadedValue = null
				selectedLocation = null
				searchQuery = ''
			}
		})
	})

	// Load the selected location by ID
	async function loadSelectedLocation(locationId: number) {
		try {
			const { data, error: fetchError } = await supabase
				.from('phwb_locations')
				.select(`
					*,
					facility:phwb_facilities!inner(id, name, address, type)
				`)
				.eq('id', locationId)
				.single()

			if (fetchError) throw fetchError

			if (data) {
				selectedLocation = data as LocationWithFacility
				searchQuery = formatLocationDisplay(selectedLocation)
			}
		} catch (err) {
			console.error('Failed to load location:', err)
		}
	}

	// Format location for display in input
	function formatLocationDisplay(location: LocationWithFacility): string {
		const facilityName = location.facility?.name || 'Unknown Facility'
		return `${location.name} @ ${facilityName}`
	}

	// All locations cache for client-side filtering
	let allLocations = $state<LocationWithFacility[]>([])
	let locationsLoaded = $state(false)

	// Load all locations once for client-side filtering
	async function loadAllLocations(force = false) {
		if (locationsLoaded && !force) return
		
		isLoading = true
		try {
			// Fetch all locations with pagination to handle large datasets
			let allData: LocationWithFacility[] = []
			let from = 0
			const pageSize = 1000 // Supabase default limit
			let hasMore = true

			while (hasMore) {
				const { data, error: fetchError } = await supabase
					.from('phwb_locations')
					.select(`
						*,
						facility:phwb_facilities!inner(id, name, address, type)
					`)
					.eq('active', true)
					.order('name')
					.range(from, from + pageSize - 1)

				if (fetchError) throw fetchError
				
				if (data && data.length > 0) {
					allData = [...allData, ...(data as LocationWithFacility[])]
					from += pageSize
					// If we got fewer than pageSize, we've reached the end
					hasMore = data.length === pageSize
				} else {
					hasMore = false
				}
			}

			allLocations = allData
			locationsLoaded = true
		} catch (err) {
			console.error('Failed to load locations:', err)
			allLocations = []
		} finally {
			isLoading = false
		}
	}

	// Expose refresh function via a custom event or expose it
	// For now, we'll refresh when the component is focused after a delay
	// This allows external components to trigger refresh by focusing the input
	async function refreshLocations() {
		locationsLoaded = false
		await loadAllLocations(true)
	}

	// Search for locations (client-side filtering)
	function searchLocations(query: string) {
		const searchLower = query.toLowerCase().trim()
		
		if (!searchLower) {
			// Show all locations if no search query
			locations = allLocations.slice(0, 20)
			return
		}
		
		// Filter locations by name, facility name, or facility address
		locations = allLocations.filter(location => {
			const locationName = location.name?.toLowerCase() || ''
			const facilityName = location.facility?.name?.toLowerCase() || ''
			const facilityAddress = location.facility?.address?.toLowerCase() || ''
			
			return locationName.includes(searchLower) ||
				facilityName.includes(searchLower) ||
				facilityAddress.includes(searchLower)
		}).slice(0, 20)
	}

	// Handle input changes
	async function handleInput(event: Event) {
		const target = event.target as HTMLInputElement
		searchQuery = target.value
		
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout)
		}

		// Load locations if not already loaded
		if (!locationsLoaded) {
			await loadAllLocations()
		}

		// Debounce search
		searchTimeout = setTimeout(() => {
			if (searchQuery !== (selectedLocation ? formatLocationDisplay(selectedLocation) : '')) {
				selectedLocation = null
				if (onchange) {
					onchange(null, null)
				}
			}
			searchLocations(searchQuery)
			isOpen = searchQuery.length > 0
			highlightedIndex = -1
		}, 300)
	}

	// Handle location selection
	function selectLocation(location: LocationWithFacility) {
		lastLoadedValue = location.id!
		selectedLocation = location
		searchQuery = formatLocationDisplay(location)
		isOpen = false
		highlightedIndex = -1
		locations = []
		
		if (onchange) {
			onchange(location.id!, location)
		}
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				highlightedIndex = Math.min(highlightedIndex + 1, locations.length - 1)
				break
			case 'ArrowUp':
				event.preventDefault()
				highlightedIndex = Math.max(highlightedIndex - 1, -1)
				break
			case 'Enter':
				event.preventDefault()
				if (highlightedIndex >= 0 && locations[highlightedIndex]) {
					selectLocation(locations[highlightedIndex])
				}
				break
			case 'Escape':
				event.preventDefault()
				isOpen = false
				highlightedIndex = -1
				inputElement?.blur()
				break
		}
	}

	// Handle focus - show all locations immediately
	async function handleFocus() {
		// Load locations on focus if not already loaded
		if (!locationsLoaded) {
			await loadAllLocations()
		}
		
		// If no selection, show all locations on focus
		if (!selectedLocation) {
			if (searchQuery) {
				searchLocations(searchQuery)
			} else {
				// Show all locations grouped by facility
				locations = allLocations.slice(0, 20)
			}
			isOpen = true
		}
	}

	// Expose refresh function - can be called externally
	export async function refresh() {
		await refreshLocations()
	}

	// Handle blur (with delay to allow for clicks)
	function handleBlur() {
		setTimeout(() => {
			isOpen = false
			highlightedIndex = -1
		}, 150)
	}

	// Clear selection
	function clearSelection() {
		lastLoadedValue = null
		selectedLocation = null
		searchQuery = ''
		locations = []
		isOpen = false
		if (onchange) {
			onchange(null, null)
		}
		inputElement?.focus()
	}

	// Group locations by facility for display
	function getGroupedLocations(): Map<string, LocationWithFacility[]> {
		const grouped = new Map<string, LocationWithFacility[]>()
		for (const location of locations) {
			const facilityName = location.facility?.name || 'Unknown Facility'
			if (!grouped.has(facilityName)) {
				grouped.set(facilityName, [])
			}
			grouped.get(facilityName)!.push(location)
		}
		return grouped
	}

	let groupedLocations = $derived(getGroupedLocations())
</script>

<div class="form-control w-full">
	<div class="relative">
		<input
			bind:this={inputElement}
			type="text"
			class="input input-bordered w-full {error ? 'input-error' : ''}"
			{placeholder}
			{disabled}
			{required}
			value={searchQuery}
			oninput={handleInput}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			autocomplete="off"
		/>

		<!-- Clear button -->
		{#if selectedLocation && !disabled}
			<button
				type="button"
				class="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/50 hover:text-base-content"
				onclick={clearSelection}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}

		<!-- Loading indicator -->
		{#if isLoading}
			<div class="absolute right-3 top-1/2 transform -translate-y-1/2">
				<span class="loading loading-spinner loading-sm"></span>
			</div>
		{/if}

		<!-- Dropdown -->
		{#if isOpen}
			<div class="absolute z-50 w-full mt-1 bg-base-100 border border-base-300 rounded-xl shadow-xl max-h-80 overflow-y-auto">
				{#if isLoading}
					<div class="px-4 py-6 text-center text-base-content/60">
						<span class="loading loading-spinner loading-md mb-2"></span>
						<p class="text-sm">Loading locations...</p>
					</div>
				{:else if locations.length === 0 && searchQuery.trim()}
					<div class="px-4 py-6 text-center">
						<div class="text-base-content/40 mb-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>
						<p class="text-sm text-base-content/60">No locations found for "{searchQuery}"</p>
						<p class="text-xs text-base-content/40 mt-1">Try searching by facility name or address</p>
					</div>
				{:else if locations.length === 0}
					<div class="px-4 py-6 text-center text-base-content/60">
						<p class="text-sm">No locations available</p>
					</div>
				{:else}
					<!-- Header showing result count -->
					<div class="px-3 py-2 bg-base-200/50 border-b border-base-300 text-xs text-base-content/60">
						{#if searchQuery.trim()}
							{locations.length} location{locations.length !== 1 ? 's' : ''} found
						{:else}
							Select a location ({allLocations.length} total)
						{/if}
					</div>
					
					{#each Array.from(groupedLocations.entries()) as [facilityName, facilityLocations]}
						<!-- Facility Header -->
						<div class="sticky top-0 bg-primary/10 px-3 py-2 border-b border-base-300 flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
							</svg>
							<span class="font-semibold text-sm text-primary">{facilityName}</span>
							<span class="text-xs text-base-content/50">({facilityLocations.length})</span>
						</div>
						
						{#each facilityLocations as location}
							{@const globalIndex = locations.indexOf(location)}
							<button
								type="button"
								class="w-full px-4 py-3 text-left transition-colors hover:bg-base-200 border-b border-base-200 last:border-b-0 {globalIndex === highlightedIndex ? 'bg-primary/5 border-l-2 border-l-primary' : ''}"
								onclick={() => selectLocation(location)}
							>
								<div class="flex items-start justify-between gap-3">
									<div class="flex-1 min-w-0">
										<div class="font-medium text-base-content">
											{location.name}
										</div>
										{#if location.floor || location.capacity}
											<div class="flex flex-wrap items-center gap-3 mt-1">
												{#if location.floor}
													<span class="inline-flex items-center gap-1 text-xs text-base-content/60">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
														</svg>
														{location.floor}
													</span>
												{/if}
												{#if location.capacity}
													<span class="inline-flex items-center gap-1 text-xs text-base-content/60">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
														</svg>
														{location.capacity}
													</span>
												{/if}
											</div>
										{/if}
									</div>
									{#if location.facility?.type}
										<span class="badge badge-sm badge-outline capitalize shrink-0">
											{location.facility.type}
										</span>
									{/if}
								</div>
							</button>
						{/each}
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Error message -->
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
