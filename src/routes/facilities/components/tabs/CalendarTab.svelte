<script lang="ts">
	import { onMount } from 'svelte'
	import { Calendar } from 'lucide-svelte'
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import CalendarView from '../../../events/components/CalendarView.svelte'
	import type { EnhancedEvent } from '$lib/stores/events'
	import { supabase } from '$lib/supabase'

	interface Props {
		facility: Facility
		locations: Location[]
		selectedLocationId: number | null
	}

	let { facility, locations, selectedLocationId }: Props = $props()

	let events = $state<EnhancedEvent[]>([])
	let loading = $state(true)
	let selectedEvent = $state<EnhancedEvent | null>(null)

	onMount(() => {
		loadEvents()
	})

	$effect(() => {
		// Reload events when location context or locations change
		loadEvents()
	})

	async function loadEvents() {
		loading = true
		try {
			let query = supabase
				.from('phwb_events')
				.select('*')
				.order('date', { ascending: true })

			// Filter by location or facility
			if (selectedLocationId !== null) {
				// Filter by specific location
				query = query.eq('location_id', selectedLocationId)
			} else {
				// Filter by all locations in facility
				const locationIds = locations.map(l => l.id).filter(Boolean) as number[]
				if (locationIds.length > 0) {
					query = query.in('location_id', locationIds)
				} else {
					// No locations, return empty
					events = []
					loading = false
					return
				}
			}

			const { data, error } = await query

			if (error) {
				console.error('Error loading events:', error)
				events = []
			} else {
				// Convert to EnhancedEvent format (basic enhancement)
				events = (data || []).map(event => ({
					...event,
					venue_name: undefined,
					program_name: undefined,
					location_name: locations.find(l => l.id === event.location_id)?.name,
					artist_assignments: []
				}))
			}
		} catch (err) {
			console.error('Failed to load events:', err)
			events = []
		} finally {
			loading = false
		}
	}

	function selectEvent(event: EnhancedEvent) {
		selectedEvent = event
	}
</script>

<div class="space-y-3">
	{#if loading}
		<div class="flex items-center justify-center py-6">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if events.length === 0}
		<div class="text-center py-6 bg-base-200 rounded-lg">
			<Calendar class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-2 text-lg">No events scheduled</p>
			<p class="text-sm opacity-60">
				{selectedLocationId ? 'No events for this location yet' : 'No events for this facility yet'}
			</p>
		</div>
	{:else}
		<div class="card bg-base-100">
			<div class="card-body p-3">
				<CalendarView
					{events}
					{selectedEvent}
					onSelectEvent={selectEvent}
				/>
			</div>
		</div>
	{/if}
</div>

