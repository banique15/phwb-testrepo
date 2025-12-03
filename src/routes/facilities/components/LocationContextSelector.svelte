<script lang="ts">
	import type { Location } from '$lib/schemas/location'

	interface Props {
		locations: Location[]
		selectedLocationId: number | null
		onSelectLocation: (locationId: number | null) => void
		onAddLocation?: () => void
	}

	let { locations, selectedLocationId, onSelectLocation, onAddLocation }: Props = $props()
</script>

<div class="flex items-center gap-3 mb-4">
	<span class="text-sm font-medium opacity-70">View:</span>
	<div class="tabs tabs-boxed">
		<button
			class="tab {selectedLocationId === null ? 'tab-active' : ''}"
			onclick={() => onSelectLocation(null)}
		>
			All Locations
		</button>
		{#each locations as location}
			<button
				class="tab {selectedLocationId === location.id ? 'tab-active' : ''}"
				onclick={() => onSelectLocation(location.id!)}
			>
				{location.name}
			</button>
		{/each}
	</div>
	{#if selectedLocationId !== null}
		<span class="badge badge-info badge-sm">
			Location View
		</span>
	{:else}
		<span class="badge badge-primary badge-sm">
			Facility View
		</span>
	{/if}
	{#if onAddLocation}
		<button
			class="btn btn-primary btn-xs ml-auto"
			onclick={onAddLocation}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Add Location
		</button>
	{/if}
</div>

