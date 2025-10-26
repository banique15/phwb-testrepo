<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabase'
	import type { LocationWithFacility } from '$lib/schemas/location'

	interface Props {
		value?: number | null
		onchange?: (locationId: number | null) => void
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
		placeholder = 'Select a location',
		error
	}: Props = $props()

	let locations = $state<LocationWithFacility[]>([])
	let loading = $state(true)
	let groupedLocations = $derived<Record<string, LocationWithFacility[]>>(
		locations.reduce((acc, location) => {
			const facilityName = location.facility?.name || 'Unknown Facility'
			if (!acc[facilityName]) {
				acc[facilityName] = []
			}
			acc[facilityName].push(location)
			return acc
		}, {} as Record<string, LocationWithFacility[]>)
	)

	onMount(async () => {
		await loadLocations()
	})

	async function loadLocations() {
		loading = true
		try {
			const { data, error: fetchError } = await supabase
				.from('phwb_locations')
				.select(`
					*,
					facility:phwb_facilities!inner(id, name, address, type)
				`)
				.eq('active', true)
				.order('name', { ascending: true })

			if (fetchError) {
				console.error('Error fetching locations:', fetchError)
				return
			}

			locations = (data as LocationWithFacility[]) || []
		} catch (err) {
			console.error('Error loading locations:', err)
		} finally {
			loading = false
		}
	}

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement
		const selectedValue = target.value ? parseInt(target.value) : null
		if (onchange) {
			onchange(selectedValue)
		}
	}
</script>

<div class="form-control w-full">
	<select
		class="select select-bordered w-full"
		class:select-error={error}
		class:opacity-50={disabled}
		{disabled}
		{required}
		value={value ?? ''}
		onchange={handleChange}
	>
		<option value="" disabled selected={!value}>
			{loading ? 'Loading locations...' : placeholder}
		</option>

		{#if !loading}
			{#each Object.entries(groupedLocations).sort(([a], [b]) => a.localeCompare(b)) as [facilityName, facilityLocations]}
				<optgroup label={facilityName}>
					{#each facilityLocations as location}
						<option value={location.id} selected={value === location.id}>
							{location.name}
							{#if location.floor}
								• {location.floor}
							{/if}
							{#if location.capacity}
								• Cap: {location.capacity}
							{/if}
						</option>
					{/each}
				</optgroup>
			{/each}

			{#if Object.keys(groupedLocations).length === 0}
				<option value="" disabled>No locations available</option>
			{/if}
		{/if}
	</select>

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{/if}
</div>
