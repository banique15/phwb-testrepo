<script lang="ts">
	import { Lightbulb, HelpCircle, X } from 'lucide-svelte'
	import { eventsStore } from '$lib/stores/events'
	import { venuesStore } from '$lib/stores/venues'
	import { onMount } from 'svelte'
	import type { Venue } from '$lib/schemas/venue'
	import type { Artist } from '$lib/schemas/artist'
	import type { Program } from '$lib/schemas/program'
	import { supabase } from '$lib/supabase'
	import type { EnhancedEvent } from '$lib/stores/events'
	import 'driver.js/dist/driver.css'
	import { startCreateEventTour } from '$lib/tours/createEventTour'

	interface Props {
		onSuccess?: (createdEvent?: EnhancedEvent) => void
		onCancel?: () => void
		initialDate?: string
		initialTime?: string
	}

	let { onSuccess, onCancel, initialDate, initialTime }: Props = $props()

	// Form state
	let title = $state('')
	let date = $state(initialDate || new Date().toISOString().split('T')[0])
	let startTime = $state(initialTime || '')
	let endTime = $state('')
	let status = $state('planned')
	let venueId = $state<number | null>(null)
	let programId = $state<number | null>(null)
	let selectedArtistIds = $state<Set<string>>(new Set())

	// Data state
	let venues = $state<Venue[]>([])
	let artists = $state<Artist[]>([])
	let programs = $state<Program[]>([])
	let loadingVenues = $state(true)
	let loadingArtists = $state(true)
	let loadingPrograms = $state(true)

	// UI state
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let artistSearchTerm = $state('')
	let venueSearchTerm = $state('')
	let showVenueDropdown = $state(false)

	// Display-only fields
	let selectedInstrument = $state('')
	let selectedGenre = $state('')
	let selectedEnsembleSize = $state('')
	let assignmentMethod = $state<'manual' | 'ai'>('manual')

	const instrumentOptions = [
		'Violin', 'Viola', 'Cello', 'Bass', 'Piano', 'Guitar', 'Drums',
		'Trumpet', 'Saxophone', 'Clarinet', 'Flute', 'Voice/Vocals'
	]

	const genreOptions = [
		'Classical', 'Jazz', 'Pop', 'Rock', 'Folk', 'Blues',
		'R&B/Soul', 'World Music', 'Musical Theater', 'Opera'
	]

	const ensembleSizeOptions = [
		{ value: 'solo', label: 'Solo' },
		{ value: 'duo', label: 'Duo' },
		{ value: 'trio', label: 'Trio' },
		{ value: 'quartet', label: 'Quartet' },
		{ value: 'ensemble', label: 'Small Ensemble (5-8)' },
		{ value: 'large', label: 'Large Ensemble (9+)' }
	]

	function generateTimeOptions() {
		const times: string[] = []
		for (let hour = 6; hour <= 22; hour++) {
			times.push(`${hour.toString().padStart(2, '0')}:00`)
			if (hour < 22) {
				times.push(`${hour.toString().padStart(2, '0')}:30`)
			}
		}
		return times
	}

	const allTimeOptions = generateTimeOptions()

	let availableEndTimes = $derived.by(() => {
		if (!startTime) return allTimeOptions
		const startIndex = allTimeOptions.indexOf(startTime)
		if (startIndex === -1) return allTimeOptions
		return allTimeOptions.slice(startIndex + 1)
	})

	function formatTimeDisplay(time: string): string {
		const [hourStr, minute] = time.split(':')
		const hour = parseInt(hourStr)
		const period = hour >= 12 ? 'PM' : 'AM'
		const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
		return `${displayHour}:${minute} ${period}`
	}

	onMount(async () => {
		await Promise.all([loadVenues(), loadArtists(), loadPrograms()])
	})

	async function loadVenues() {
		try {
			const result = await venuesStore.fetchAll({
				sortBy: 'name',
				sortOrder: 'asc'
			})
			venues = (result.data || []).sort((a, b) =>
				(a.name || '').localeCompare(b.name || '')
			)
		} catch (err) {
			console.error('Failed to load venues:', err)
		} finally {
			loadingVenues = false
		}
	}

	async function loadArtists() {
		try {
			const { data, error: supabaseError } = await supabase
				.from('phwb_artists')
				.select('*')
				.order('full_name')

			if (supabaseError) throw supabaseError
			artists = data || []
		} catch (err) {
			console.error('Failed to load artists:', err)
		} finally {
			loadingArtists = false
		}
	}

	let filteredVenues = $derived.by(() => {
		if (!venueSearchTerm.trim()) return venues
		const searchLower = venueSearchTerm.toLowerCase()
		return venues.filter(venue =>
			venue.name?.toLowerCase().includes(searchLower) ||
			venue.address?.toLowerCase().includes(searchLower) ||
			venue.city?.toLowerCase().includes(searchLower)
		)
	})

	let selectedVenueName = $derived.by(() => {
		if (!venueId) return ''
		const venue = venues.find(v => v.id === venueId)
		return venue?.name || ''
	})

	let displayedArtists = $derived.by(() => {
		if (!artistSearchTerm.trim()) return artists
		const searchLower = artistSearchTerm.toLowerCase()
		return artists.filter(artist =>
			artist.full_name?.toLowerCase().includes(searchLower) ||
			artist.artist_name?.toLowerCase().includes(searchLower) ||
			artist.email?.toLowerCase().includes(searchLower)
		)
	})

	function toggleArtist(artistId: string) {
		if (selectedArtistIds.has(artistId)) {
			selectedArtistIds.delete(artistId)
		} else {
			selectedArtistIds.add(artistId)
		}
		selectedArtistIds = new Set(selectedArtistIds)
	}

	function selectVenue(venue: Venue) {
		venueId = venue.id
		showVenueDropdown = false
		venueSearchTerm = ''
	}

	function clearVenueSelection() {
		venueId = null
		venueSearchTerm = ''
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()

		if (!venueId) {
			error = 'Please select a venue'
			return
		}

		submitting = true
		error = null

		try {
			const venue = venues.find(v => v.id === venueId)
			let finalTitle = title.trim()

			if (!finalTitle) {
				const selectedArtistNames = Array.from(selectedArtistIds)
					.map(artistId => {
						const artist = artists.find(a => a.id === artistId)
						return artist?.artist_name || artist?.full_name || 'Unknown Artist'
					})
					.filter(name => name !== 'Unknown Artist')

				if (selectedArtistNames.length === 0) {
					finalTitle = `Event @ ${venue?.name || 'Unknown Venue'}`
				} else if (selectedArtistNames.length === 1) {
					finalTitle = `${selectedArtistNames[0]} @ ${venue?.name || 'Unknown Venue'}`
				} else if (selectedArtistNames.length === 2) {
					finalTitle = `${selectedArtistNames[0]} & ${selectedArtistNames[1]} @ ${venue?.name || 'Unknown Venue'}`
				} else {
					finalTitle = `${selectedArtistNames[0]} +${selectedArtistNames.length - 1} @ ${venue?.name || 'Unknown Venue'}`
				}
			}

			const artistAssignments = Array.from(selectedArtistIds).map(artistId => {
				const artist = artists.find(a => a.id === artistId)
				return {
					artist_id: artistId,
					artist_name: artist?.full_name || artist?.artist_name || 'Unknown',
					role: '',
					status: 'pending',
					num_hours: 0,
					hourly_rate: 0,
					notes: ''
				}
			})

			const eventData = {
				title: finalTitle,
				date,
				...(startTime && { start_time: startTime }),
				...(endTime && { end_time: endTime }),
				status,
				venue: venueId,
				notes: '',
				...(artistAssignments.length > 0 && {
					artists: { assignments: artistAssignments }
				})
			}

			const createdEvent = await eventsStore.create(eventData)
			onSuccess?.(createdEvent)

		} catch (err) {
			console.error('Error creating event:', err)
			error = err instanceof Error ? err.message : 'Failed to create event'
		} finally {
			submitting = false
		}
	}

	function handleClickOutsideVenue(e: MouseEvent) {
		const target = e.target as HTMLElement
		if (!target.closest('.venue-dropdown-container')) {
			showVenueDropdown = false
		}
	}

	$effect(() => {
		if (showVenueDropdown) {
			const handleClick = (e: MouseEvent) => handleClickOutsideVenue(e)
			document.addEventListener('click', handleClick)
			return () => document.removeEventListener('click', handleClick)
		}
	})

	// Tour functionality
	function startTour() {
		const tour = startCreateEventTour()
		return tour
	}
</script>

<div class="flex flex-col h-full overflow-hidden">
	<!-- Header -->
	<div class="flex-none p-4 border-b border-base-300 bg-base-100" data-tour="modal-header">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">Create New Event</h2>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={startTour}
					title="Take a guided tour"
				>
					<HelpCircle class="w-4 h-4" />
					Tour
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-circle"
					onclick={() => onCancel?.()}
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>

	<!-- Scrollable Form Content -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if error}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Event Title -->
			<div class="form-control" data-tour="event-title">
				<label class="label">
					<span class="label-text">Event Title (Optional)</span>
				</label>
				<input
					type="text"
					bind:value={title}
					placeholder="Leave blank to auto-generate"
					class="input input-bordered input-sm"
					maxlength="200"
					disabled={submitting}
				/>
				<label class="label">
					<span class="label-text-alt text-info flex items-center gap-1">
						<Lightbulb class="w-3 h-3" />
						Auto-generates as "Artist @ Venue"
					</span>
				</label>
			</div>

			<!-- Venue -->
			<div class="form-control relative venue-dropdown-container" data-tour="venue-selector">
				<label class="label">
					<span class="label-text">Venue <span class="text-error">*</span></span>
				</label>

				{#if venueId && selectedVenueName}
					<div class="flex gap-2">
						<input
							type="text"
							value={selectedVenueName}
							class="input input-bordered input-sm flex-1"
							disabled
						/>
						<button
							type="button"
							class="btn btn-outline btn-sm"
							onclick={clearVenueSelection}
							disabled={submitting}
						>
							Change
						</button>
					</div>
				{:else}
					<input
						type="text"
						bind:value={venueSearchTerm}
						onfocus={() => showVenueDropdown = true}
						placeholder="Search venues..."
						class="input input-bordered input-sm"
						disabled={submitting || loadingVenues}
						autocomplete="off"
					/>

					{#if showVenueDropdown && !loadingVenues}
						<div class="absolute top-full left-0 right-0 z-50 mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg max-h-48 overflow-y-auto">
							{#if filteredVenues.length > 0}
								{#each filteredVenues.slice(0, 8) as venue}
									<button
										type="button"
										class="w-full text-left px-3 py-2 hover:bg-base-200 border-b border-base-300 last:border-b-0"
										onclick={() => selectVenue(venue)}
										disabled={submitting}
									>
										<div class="font-medium text-sm">{venue.name}</div>
										{#if venue.city}
											<div class="text-xs text-base-content/60">{venue.city}</div>
										{/if}
									</button>
								{/each}
							{:else}
								<div class="px-3 py-4 text-center text-sm text-base-content/60">
									No venues found
								</div>
							{/if}
						</div>
					{/if}
				{/if}

				{#if loadingVenues}
					<label class="label">
						<span class="label-text-alt">Loading venues...</span>
					</label>
				{/if}
			</div>

			<!-- Date and Times -->
			<div class="grid grid-cols-3 gap-2" data-tour="date-time">
				<div class="form-control">
					<label class="label">
						<span class="label-text">Date <span class="text-error">*</span></span>
					</label>
					<input
						type="date"
						bind:value={date}
						class="input input-bordered input-sm"
						required
						disabled={submitting}
					/>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">Start</span>
					</label>
					<select
						bind:value={startTime}
						class="select select-bordered select-sm"
						disabled={submitting}
					>
						<option value="">--</option>
						{#each allTimeOptions as time}
							<option value={time}>{formatTimeDisplay(time)}</option>
						{/each}
					</select>
				</div>

				<div class="form-control">
					<label class="label">
						<span class="label-text">End</span>
					</label>
					<select
						bind:value={endTime}
						class="select select-bordered select-sm"
						disabled={submitting || !startTime}
					>
						<option value="">--</option>
						{#each availableEndTimes as time}
							<option value={time}>{formatTimeDisplay(time)}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Artist Assignment -->
			<div class="space-y-3">
				<h4 class="font-semibold text-sm border-b pb-2">Artist Assignment</h4>

				<div class="grid grid-cols-2 gap-2">
					<!-- Manual Assignment -->
					<div
						class="border rounded-lg p-3 cursor-pointer transition-all {assignmentMethod === 'manual' ? 'border-primary bg-primary/5' : 'border-base-300'}"
						data-tour="manual-assignment"
						onclick={() => assignmentMethod = 'manual'}
						onkeydown={(e) => e.key === 'Enter' && (assignmentMethod = 'manual')}
						role="button"
						tabindex="0"
					>
						<div class="flex items-center gap-2 mb-2">
							<input
								type="radio"
								name="assignmentMethod"
								value="manual"
								checked={assignmentMethod === 'manual'}
								class="radio radio-primary radio-xs"
								disabled={submitting}
							/>
							<span class="font-medium text-sm">Manual</span>
						</div>
						{#if assignmentMethod === 'manual'}
							<div class="space-y-2">
								<input
									type="text"
									bind:value={artistSearchTerm}
									placeholder="Search..."
									class="input input-bordered input-xs w-full"
									disabled={submitting}
								/>

								{#if loadingArtists}
									<div class="text-center py-2">
										<span class="loading loading-spinner loading-xs"></span>
									</div>
								{:else if displayedArtists.length > 0}
									<div class="border border-base-300 rounded max-h-32 overflow-y-auto">
										{#each displayedArtists.slice(0, 5) as artist}
											<label class="flex items-center p-1.5 hover:bg-base-100 border-b border-base-300 last:border-b-0 cursor-pointer text-xs">
												<input
													type="checkbox"
													class="checkbox checkbox-primary checkbox-xs mr-2"
													checked={selectedArtistIds.has(artist.id!)}
													onchange={() => toggleArtist(artist.id!)}
													disabled={submitting}
												/>
												<span class="truncate">{artist.full_name || artist.artist_name}</span>
											</label>
										{/each}
									</div>
								{/if}

								{#if selectedArtistIds.size > 0}
									<div class="bg-primary/10 rounded p-1.5">
										<span class="text-xs font-medium">Selected: {selectedArtistIds.size}</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- AI Matching -->
					<div
						class="border rounded-lg p-3 cursor-pointer transition-all {assignmentMethod === 'ai' ? 'border-secondary bg-secondary/5' : 'border-base-300'}"
						data-tour="ai-assignment"
						onclick={() => assignmentMethod = 'ai'}
						onkeydown={(e) => e.key === 'Enter' && (assignmentMethod = 'ai')}
						role="button"
						tabindex="0"
					>
						<div class="flex items-center gap-2 mb-2">
							<input
								type="radio"
								name="assignmentMethod"
								value="ai"
								checked={assignmentMethod === 'ai'}
								class="radio radio-secondary radio-xs"
								disabled={submitting}
							/>
							<span class="font-medium text-sm">AI Match</span>
						</div>
						{#if assignmentMethod === 'ai'}
							<div class="space-y-2">
								<select
									bind:value={selectedInstrument}
									class="select select-bordered select-xs w-full"
									disabled={submitting}
								>
									<option value="">Any Instrument</option>
									{#each instrumentOptions as instrument}
										<option value={instrument}>{instrument}</option>
									{/each}
								</select>

								<select
									bind:value={selectedGenre}
									class="select select-bordered select-xs w-full"
									disabled={submitting}
								>
									<option value="">Any Genre</option>
									{#each genreOptions as genre}
										<option value={genre}>{genre}</option>
									{/each}
								</select>

								<div class="bg-secondary/10 rounded p-1.5">
									<p class="text-xs text-secondary">AI suggests after creation</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="flex justify-end gap-2 pt-4 border-t" data-tour="form-actions">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => onCancel?.()}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary btn-sm"
					disabled={submitting || !venueId}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-xs"></span>
						Creating...
					{:else}
						Create Event
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
