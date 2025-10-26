<script lang="ts">
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	import { artistsStore } from '$lib/stores/artists'
	import { eventsStore } from '$lib/stores/events'
	import type { Artist } from '$lib/schemas/artist'
	import type { Event } from '$lib/schemas/event'
	import PageHeader from '$lib/components/ui/PageHeader.svelte'
	
	// State
	let event = $state<Event | null>(null)
	let artists = $state<Artist[]>([])
	let selectedArtists = $state<Map<string, { hours: number; rate: number }>>(new Map())
	let loading = $state(true)
	let saving = $state(false)
	let error = $state<string | null>(null)
	let searchQuery = $state('')
	
	// Get event ID from route
	const eventId = $derived(Number($page.params.id))
	
	// Filtered artists based on search
	let filteredArtists = $derived(
		artists.filter(artist => {
			if (!searchQuery) return true
			const query = searchQuery.toLowerCase()
			return (
				artist.full_name?.toLowerCase().includes(query) ||
				artist.legal_first_name?.toLowerCase().includes(query) ||
				artist.legal_last_name?.toLowerCase().includes(query) ||
				artist.email?.toLowerCase().includes(query)
			)
		})
	)
	
	onMount(async () => {
		await loadData()
	})
	
	async function loadData() {
		try {
			loading = true
			
			// Load event details
			event = await eventsStore.getById(eventId)
			if (!event) {
				throw new Error('Event not found')
			}
			
			// Load all artists
			const artistsResult = await artistsStore.fetchAll()
			artists = artistsResult.data
			
			// Load existing artist assignments
			const response = await fetch(`/api/events/${eventId}/artists`)
			if (response.ok) {
				const { data } = await response.json()
				if (data.assignments && data.assignments.length > 0) {
					// Populate selected artists from existing assignments
					data.assignments.forEach((assignment: any) => {
						selectedArtists.set(assignment.artist_id, {
							hours: assignment.num_hours || 3,
							rate: assignment.hourly_rate || 50
						})
					})
				}
			}
		} catch (err) {
			console.error('Failed to load data:', err)
			error = err instanceof Error ? err.message : 'Failed to load data'
		} finally {
			loading = false
		}
	}
	
	function toggleArtist(artistId: string) {
		if (selectedArtists.has(artistId)) {
			selectedArtists.delete(artistId)
		} else {
			selectedArtists.set(artistId, { hours: 3, rate: 50 })
		}
		// Trigger reactivity
		selectedArtists = new Map(selectedArtists)
	}
	
	function updateArtistHours(artistId: string, hours: number) {
		const current = selectedArtists.get(artistId)
		if (current) {
			selectedArtists.set(artistId, { ...current, hours })
			selectedArtists = new Map(selectedArtists)
		}
	}
	
	function updateArtistRate(artistId: string, rate: number) {
		const current = selectedArtists.get(artistId)
		if (current) {
			selectedArtists.set(artistId, { ...current, rate })
			selectedArtists = new Map(selectedArtists)
		}
	}
	
	function getArtistName(artist: Artist): string {
		return artist.full_name || 
			   `${artist.legal_first_name || ''} ${artist.legal_last_name || ''}`.trim() ||
			   'Unknown Artist'
	}
	
	async function saveAssignments() {
		if (selectedArtists.size === 0) {
			error = 'Please select at least one artist'
			return
		}
		
		saving = true
		error = null
		
		try {
			// Prepare assignments data
			const assignments = Array.from(selectedArtists.entries()).map(([artistId, data]) => {
				const artist = artists.find(a => a.id === artistId)
				return {
					artist_id: artistId,
					artist_name: artist ? getArtistName(artist) : undefined,
					num_hours: data.hours,
					hourly_rate: data.rate,
					status: 'assigned'
				}
			})
			
			// Save assignments via API
			const response = await fetch(`/api/events/${eventId}/artists`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ assignments })
			})
			
			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.error || 'Failed to save assignments')
			}
			
			// Navigate back to events page
			await goto('/events')
			
		} catch (err) {
			console.error('Error saving assignments:', err)
			error = err instanceof Error ? err.message : 'Failed to save assignments'
		} finally {
			saving = false
		}
	}
	
	function selectAll() {
		filteredArtists.forEach(artist => {
			if (!selectedArtists.has(artist.id)) {
				selectedArtists.set(artist.id, { hours: 3, rate: 50 })
			}
		})
		selectedArtists = new Map(selectedArtists)
	}
	
	function deselectAll() {
		selectedArtists.clear()
		selectedArtists = new Map(selectedArtists)
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex-none px-4 sm:px-6 pt-4 pb-4 bg-base-100 border-b border-base-200">
		<PageHeader
			title="Assign Artists"
			subtitle={event ? `For: ${event.title} on ${new Date(event.date).toLocaleDateString()}` : 'Loading...'}
		>
			{#snippet actions()}
				<button
					class="btn btn-primary"
					onclick={saveAssignments}
					disabled={saving || selectedArtists.size === 0}
				>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save & Continue ({selectedArtists.size} selected)
				</button>
			{/snippet}
		</PageHeader>
	</div>
	
	<!-- Content -->
	<div class="flex-1 p-4 sm:p-6 overflow-auto">
		{#if loading}
			<div class="flex justify-center items-center h-64">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if error}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{:else}
			<div class="space-y-4">
				<!-- Search and Bulk Actions -->
				<div class="flex flex-col sm:flex-row gap-4">
					<div class="flex-1">
						<input
							type="text"
							placeholder="Search artists..."
							class="input input-bordered w-full"
							bind:value={searchQuery}
						/>
					</div>
					<div class="flex gap-2">
						<button class="btn btn-sm" onclick={selectAll}>
							Select All
						</button>
						<button class="btn btn-sm" onclick={deselectAll}>
							Deselect All
						</button>
					</div>
				</div>
				
				<!-- Artists Grid -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each filteredArtists as artist}
						{@const isSelected = selectedArtists.has(artist.id)}
						{@const artistData = selectedArtists.get(artist.id)}
						
						<div class="card bg-base-100 shadow-md border border-base-200 {isSelected ? 'ring-2 ring-primary' : ''}">
							<div class="card-body p-4">
								<div class="flex items-start gap-3">
									<input
										type="checkbox"
										class="checkbox checkbox-primary mt-1"
										checked={isSelected}
										onchange={() => toggleArtist(artist.id)}
									/>
									<div class="flex-1 min-w-0">
										<h3 class="font-semibold truncate">
											{getArtistName(artist)}
										</h3>
										{#if artist.email}
											<p class="text-sm text-base-content/70 truncate">
												{artist.email}
											</p>
										{/if}
										
										{#if isSelected}
											<div class="mt-3 space-y-2">
												<div class="flex items-center gap-2">
													<label class="text-sm" for={`artist-hours-${artist.id}`}>Hours</label>
													<input
														id={`artist-hours-${artist.id}`}
														type="number"
														class="input input-bordered input-sm w-20"
														min="0.5"
														step="0.5"
														value={artistData?.hours || 3}
														onchange={(e) => updateArtistHours(artist.id, parseFloat(e.currentTarget.value))}
													/>
												</div>
												<div class="flex items-center gap-2">
													<label class="text-sm" for={`artist-rate-${artist.id}`}>Rate</label>
													<input
														id={`artist-rate-${artist.id}`}
														type="number"
														class="input input-bordered input-sm w-20"
														min="0"
														step="5"
														value={artistData?.rate || 50}
														onchange={(e) => updateArtistRate(artist.id, parseFloat(e.currentTarget.value))}
													/>
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
				
				{#if filteredArtists.length === 0}
					<div class="text-center py-8 text-base-content/70">
						No artists found matching your search.
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
