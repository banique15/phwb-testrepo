<script lang="ts">
	import { onMount } from 'svelte'
	import { ClipboardList } from 'lucide-svelte'
	import type { Facility } from '$lib/schemas/facility'
	import type { Location } from '$lib/schemas/location'
	import type { Event } from '$lib/schemas/event'
	import { supabase } from '$lib/supabase'
	import { goto } from '$app/navigation'

	interface Props {
		facility: Facility
		locations: Location[]
		selectedLocationId: number | null
	}

	let { facility, locations, selectedLocationId }: Props = $props()

	let events = $state<Event[]>([])
	let loading = $state(true)
	let searchQuery = $state('')
	let sortBy = $state<'date' | 'title' | 'status'>('date')
	let sortOrder = $state<'asc' | 'desc'>('asc')

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

			// Filter by location or facility
			if (selectedLocationId !== null) {
				query = query.eq('location_id', selectedLocationId)
			} else {
				const locationIds = locations.map(l => l.id).filter(Boolean) as number[]
				if (locationIds.length > 0) {
					query = query.in('location_id', locationIds)
				} else {
					events = []
					loading = false
					return
				}
			}

			// Apply search
			if (searchQuery) {
				query = query.or(`title.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`)
			}

			// Apply sorting
			query = query.order(sortBy, { ascending: sortOrder === 'asc' })

			const { data, error } = await query

			if (error) {
				console.error('Error loading events:', error)
				events = []
			} else {
				events = data || []
			}
		} catch (err) {
			console.error('Failed to load events:', err)
			events = []
		} finally {
			loading = false
		}
	}

	function formatDate(dateStr: string | undefined) {
		if (!dateStr) return 'No date'
		// Append 'T00:00:00' to treat date as local time, not UTC
		const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
		return date.toLocaleDateString('en-US', { 
			year: 'numeric', 
			month: 'short', 
			day: 'numeric' 
		})
	}

	function formatTime(timeStr: string | undefined) {
		if (!timeStr) return ''
		return timeStr.slice(0, 5)
	}

	function getStatusBadgeClass(status: string | undefined) {
		switch (status) {
			case 'confirmed': return 'badge-success'
			case 'completed': return 'badge-info'
			case 'cancelled': return 'badge-error'
			case 'in_progress': return 'badge-warning'
			default: return 'badge-neutral'
		}
	}

	function handleCreateEvent() {
		const params = new URLSearchParams()
		if (selectedLocationId) {
			params.set('location_id', String(selectedLocationId))
		} else if (facility.id) {
			params.set('facility_id', String(facility.id))
		}
		goto(`/events?${params.toString()}`)
	}
</script>

<div class="space-y-3">
	<!-- Header with Search and Actions -->
	<div class="flex items-center justify-between gap-3">
		<div class="flex-1">
			<input
				type="text"
				placeholder="Search events..."
				class="input input-bordered w-full max-w-xs"
				bind:value={searchQuery}
				oninput={loadEvents}
			/>
		</div>
		<div class="flex items-center gap-2">
			<select
				class="select select-bordered select-sm"
				bind:value={sortBy}
				onchange={loadEvents}
			>
				<option value="date">Sort by Date</option>
				<option value="title">Sort by Title</option>
				<option value="status">Sort by Status</option>
			</select>
			<button
				class="btn btn-sm btn-primary"
				onclick={handleCreateEvent}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Add Event
			</button>
		</div>
	</div>

	<!-- Events List -->
	{#if loading}
		<div class="flex items-center justify-center py-6">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if events.length === 0}
		<div class="text-center py-6 bg-base-200 rounded-lg">
			<ClipboardList class="w-16 h-16 mx-auto text-base-content/70" />
			<p class="mt-2 text-lg">No events found</p>
			<p class="text-sm opacity-60">
				{searchQuery ? 'Try adjusting your search' : (selectedLocationId ? 'No events for this location yet' : 'No events for this facility yet')}
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
			{#each events as event}
				<div class="card bg-base-100 cursor-pointer" onclick={() => goto(`/events?id=${event.id}`)}>
					<div class="card-body p-3">
						<h3 class="card-title text-lg {!event.title ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{event.title || 'Untitled Event'}</h3>
						<div class="space-y-1 text-sm">
							<div class="flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<span class="{!event.date ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1 inline-block' : ''}">{formatDate(event.date)}</span>
							</div>
							<div class="flex items-center gap-2 {!event.start_time && !event.end_time ? 'border border-yellow-400 dark:border-yellow-600 rounded px-2 py-1' : ''}">
								{#if event.start_time || event.end_time}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span>No time specified</span>
								{/if}
							</div>
						</div>
						<div class="card-actions justify-end mt-2">
							<span class="badge {getStatusBadgeClass(event.status)} badge-sm {!event.status ? 'border border-yellow-400 dark:border-yellow-600' : ''}">
								{event.status || 'planned'}
							</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

