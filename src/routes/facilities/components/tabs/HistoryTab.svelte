<script lang="ts">
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'

	interface Props {
		facility: Facility
		locations: Location[]
		selectedLocationId: number | null
	}

	let { facility, locations, selectedLocationId }: Props = $props()
</script>

<div class="text-center py-6 bg-base-200 rounded-lg">
	<span class="text-4xl">📜</span>
	<p class="mt-2 text-lg">History & Activity Log</p>
	<p class="text-sm opacity-60">
		History tracking will be implemented here
	</p>
	<p class="text-xs opacity-50 mt-2">
		{selectedLocationId ? 'Location history' : 'Facility history'}
	</p>
</div>

