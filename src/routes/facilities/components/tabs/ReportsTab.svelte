<script lang="ts">
	import { BarChart } from 'lucide-svelte'
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
	<BarChart class="w-16 h-16 mx-auto text-base-content/70" />
	<p class="mt-2 text-lg">Reports</p>
	<p class="text-sm opacity-60">
		Report generation will be implemented here
	</p>
	<p class="text-xs opacity-50 mt-2">
		{selectedLocationId ? 'Location reports' : 'Facility reports'}
	</p>
</div>

