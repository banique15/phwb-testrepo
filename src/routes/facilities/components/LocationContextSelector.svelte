<script lang="ts">
	import type { Location } from '$lib/schemas/location'

	interface Props {
		locations: Location[]
		selectedLocationId: number | null
		onSelectLocation: (locationId: number | null) => void
	}

	let { locations, selectedLocationId, onSelectLocation }: Props = $props()
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
</div>

