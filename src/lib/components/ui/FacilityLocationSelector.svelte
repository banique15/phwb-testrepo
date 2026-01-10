<script lang="ts">
	import { supabase } from '$lib/supabase'
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import { getLocationsByFacility } from '$lib/stores/locations'
	import CreateFacility from '../../../routes/facilities/components/modals/CreateFacility.svelte'
	import CreateLocation from '../../../routes/facilities/components/modals/CreateLocation.svelte'
	import { Plus } from 'lucide-svelte'

	interface Props {
		value?: number | null // location_id
		onchange?: (locationId: number | null, location?: Location | null) => void
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
		placeholder = 'Select facility and location',
		error
	}: Props = $props()

	// Component state
	let facilities = $state<Facility[]>([])
	let locations = $state<Location[]>([])
	let selectedFacilityId = $state<number | null>(null)
	let selectedLocationId = $state<number | null>(value)
	let isLoadingFacilities = $state(false)
	let isLoadingLocations = $state(false)
	
	// Modal state
	let isCreateFacilityModalOpen = $state(false)
	let isCreateLocationModalOpen = $state(false)

	// Load all facilities
	async function loadFacilities() {
		if (facilities.length > 0) return // Already loaded
		
		isLoadingFacilities = true
		try {
			// Fetch all facilities with pagination
			let allFacilities: Facility[] = []
			let from = 0
			const pageSize = 1000
			let hasMore = true

			while (hasMore) {
				const { data, error: fetchError } = await supabase
					.from('phwb_facilities')
					.select('*')
					.order('name')
					.range(from, from + pageSize - 1)

				if (fetchError) throw fetchError
				
				if (data && data.length > 0) {
					allFacilities = [...allFacilities, ...data]
					from += pageSize
					hasMore = data.length === pageSize
				} else {
					hasMore = false
				}
			}

			facilities = allFacilities
		} catch (err) {
			console.error('Failed to load facilities:', err)
			facilities = []
		} finally {
			isLoadingFacilities = false
		}
	}

	// Load locations for selected facility
	async function loadLocations(facilityId: number) {
		isLoadingLocations = true
		try {
			const facilityLocations = await getLocationsByFacility(facilityId)
			locations = facilityLocations
		} catch (err) {
			console.error('Failed to load locations:', err)
			locations = []
		} finally {
			isLoadingLocations = false
		}
	}

	// Load facility and location if value (location_id) is provided
	async function loadInitialSelection() {
		if (!value || selectedLocationId === value) return

		try {
			// First, load the location to get its facility_id
			const { data: locationData, error: locationError } = await supabase
				.from('phwb_locations')
				.select('*, facility:phwb_facilities!inner(id, name, address, type)')
				.eq('id', value)
				.eq('active', true)
				.single()

			if (locationError) throw locationError

			if (locationData) {
				const location = locationData as Location & { facility?: Facility }
				selectedFacilityId = location.facility_id
				selectedLocationId = value

				// Load locations for this facility
				if (location.facility_id) {
					await loadLocations(location.facility_id)
				}
			}
		} catch (err) {
			console.error('Failed to load initial selection:', err)
		}
	}

	// Load facilities on mount and handle initial value
	$effect(async () => {
		await loadFacilities()
		if (value && value !== selectedLocationId) {
			await loadInitialSelection()
		}
	})

	// Watch for value changes from parent
	$effect(() => {
		if (value !== selectedLocationId) {
			if (value) {
				loadInitialSelection()
			} else {
				selectedFacilityId = null
				locations = []
				selectedLocationId = null
			}
		}
	})

	// Handle facility selection
	async function handleFacilityChange(facilityId: number | null) {
		selectedFacilityId = facilityId
		selectedLocationId = null
		locations = []

		// Clear location selection when facility changes
		if (onchange) {
			onchange(null, null)
		}

		// Load locations for the selected facility
		if (facilityId) {
			await loadLocations(facilityId)
		}
	}

	// Handle location selection
	function handleLocationChange(locationId: number | null) {
		selectedLocationId = locationId
		const selectedLocation = locationId 
			? locations.find(l => l.id === locationId) || null
			: null

		if (onchange) {
			onchange(locationId, selectedLocation || undefined)
		}
	}

	// Handle facility created
	async function handleFacilityCreated(event: CustomEvent<{ facility: Facility }>) {
		const newFacility = event.detail.facility
		isCreateFacilityModalOpen = false
		
		// Refresh facilities list
		facilities = []
		await loadFacilities()
		
		// Select the newly created facility
		if (newFacility?.id) {
			await handleFacilityChange(newFacility.id)
		}
	}

	// Handle location created
	async function handleLocationCreated(event: CustomEvent<{ location: Location }>) {
		const newLocation = event.detail.location
		isCreateLocationModalOpen = false
		
		// Refresh locations list for the current facility
		if (selectedFacilityId) {
			await loadLocations(selectedFacilityId)
		}
		
		// Select the newly created location
		if (newLocation?.id) {
			handleLocationChange(newLocation.id)
		}
	}

	// Expose refresh function
	export async function refresh() {
		facilities = []
		locations = []
		await loadFacilities()
		if (selectedFacilityId) {
			await loadLocations(selectedFacilityId)
		}
	}
</script>

<div class="form-control w-full">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<!-- Facility Selector -->
		<div>
			<label class="label">
				<span class="label-text">
					Facility {#if required}<span class="text-error">*</span>{/if}
				</span>
			</label>
			<div class="flex gap-2">
				<select
					class="select select-bordered flex-1 {error ? 'select-error' : ''}"
					bind:value={selectedFacilityId}
					onchange={(e) => handleFacilityChange(e.target.value ? Number(e.target.value) : null)}
					{disabled}
					{required}
				>
					<option value={null}>Select a facility...</option>
					{#if isLoadingFacilities}
						<option disabled>Loading facilities...</option>
					{:else}
						{#each facilities as facility}
							<option value={facility.id}>{facility.name}</option>
						{/each}
					{/if}
				</select>
				<button
					type="button"
					class="btn btn-outline btn-sm"
					onclick={() => isCreateFacilityModalOpen = true}
					disabled={disabled}
					title="Create new facility"
				>
					<Plus class="w-4 h-4" />
				</button>
			</div>
		</div>

		<!-- Location Selector -->
		<div>
			<label class="label">
				<span class="label-text">
					Location {#if required}<span class="text-error">*</span>{/if}
				</span>
			</label>
			<div class="flex gap-2">
				<select
					class="select select-bordered flex-1 {error ? 'select-error' : ''}"
					bind:value={selectedLocationId}
					onchange={(e) => handleLocationChange(e.target.value ? Number(e.target.value) : null)}
					disabled={disabled || !selectedFacilityId || isLoadingLocations}
					{required}
				>
					{#if !selectedFacilityId}
						<option value={null}>Select a facility first...</option>
					{:else if isLoadingLocations}
						<option disabled>Loading locations...</option>
					{:else if locations.length === 0}
						<option value={null}>No locations available</option>
					{:else}
						<option value={null}>Select a location...</option>
						{#each locations as location}
							<option value={location.id}>
								{location.name}
								{#if location.floor}
									- {location.floor}
								{/if}
								{#if location.capacity}
									({location.capacity} capacity)
								{/if}
							</option>
						{/each}
					{/if}
				</select>
				<button
					type="button"
					class="btn btn-outline btn-sm"
					onclick={() => isCreateLocationModalOpen = true}
					disabled={disabled || !selectedFacilityId}
					title={selectedFacilityId ? "Create new location" : "Select a facility first"}
				>
					<Plus class="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>

	<!-- Error message -->
	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>

<!-- Create Facility Modal -->
<CreateFacility
	open={isCreateFacilityModalOpen}
	on:close={() => isCreateFacilityModalOpen = false}
	on:success={handleFacilityCreated}
/>

<!-- Create Location Modal -->
<CreateLocation
	open={isCreateLocationModalOpen}
	facilityId={selectedFacilityId || undefined}
	on:close={() => isCreateLocationModalOpen = false}
	on:success={handleLocationCreated}
/>
