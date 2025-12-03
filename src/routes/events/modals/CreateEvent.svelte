<script lang="ts">
	import { Lightbulb } from 'lucide-svelte'
	import { eventsStore } from '$lib/stores/events'
	import { venuesStore } from '$lib/stores/venues'
	import { artistsStore } from '$lib/stores/artists'
	import { onMount } from 'svelte'
	import type { Venue } from '$lib/schemas/venue'
	import type { Artist } from '$lib/schemas/artist'
	import { supabase } from '$lib/supabase'
	import type { EnhancedEvent } from '$lib/stores/events'

	interface Props {
		open?: boolean
		onClose?: () => void
		onSuccess?: (createdEvent?: EnhancedEvent) => void
	}

	let { open = false, onClose, onSuccess }: Props = $props()

	// Modal reference
	let modalElement: HTMLDialogElement

	// Form state
	let title = $state('')
	let date = $state(new Date().toISOString().split('T')[0])
	let startTime = $state('')
	let endTime = $state('')
	let status = $state('planned')
	let venueId = $state<number | null>(null)
	let selectedArtistIds = $state<Set<string>>(new Set())

	// Data state
	let venues = $state<Venue[]>([])
	let artists = $state<Artist[]>([])
	let loadingVenues = $state(true)
	let loadingArtists = $state(true)

	// UI state
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let artistSearchTerm = $state('')
	let venueSearchTerm = $state('')
	let showVenueDropdown = $state(false)

	// Display-only fields (not saved to database)
	let selectedInstrument = $state('')
	let selectedGenre = $state('')
	let selectedEnsembleSize = $state('')
	let assignmentMethod = $state<'manual' | 'ai'>('manual') // Track which method user chooses

	const statusOptions = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' }
	]

	// Display-only options (for demo purposes)
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

	// Generate time options (half-hour blocks from 6am to 10pm)
	function generateTimeOptions() {
		const times: string[] = []
		for (let hour = 6; hour <= 22; hour++) {
			times.push(`${hour.toString().padStart(2, '0')}:00`)
			if (hour < 22) { // Don't add :30 for 10pm
				times.push(`${hour.toString().padStart(2, '0')}:30`)
			}
		}
		return times
	}

	const allTimeOptions = generateTimeOptions()

	// Filter end times based on start time
	let availableEndTimes = $derived.by(() => {
		if (!startTime) return allTimeOptions

		// Find the index of the start time
		const startIndex = allTimeOptions.indexOf(startTime)
		if (startIndex === -1) return allTimeOptions

		// Return only times after the start time
		return allTimeOptions.slice(startIndex + 1)
	})

	// Format time for display (e.g., "09:00" -> "9:00 AM")
	function formatTimeDisplay(time: string): string {
		const [hourStr, minute] = time.split(':')
		const hour = parseInt(hourStr)
		const period = hour >= 12 ? 'PM' : 'AM'
		const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
		return `${displayHour}:${minute} ${period}`
	}

	// Load venues and artists on mount
	onMount(async () => {
		await Promise.all([loadVenues(), loadArtists()])
	})

	async function loadVenues() {
		try {
			// The base store defaults to sorting by created_at which fails on the venues view.
			// Force an alphabetical fetch so the dropdown has the full list available.
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

	// Control modal visibility
	$effect(() => {
		if (modalElement) {
			if (open) {
				modalElement.showModal()
			} else {
				modalElement.close()
			}
		}
	})

	// Filter venues based on search
	let filteredVenues = $derived.by(() => {
		if (!venueSearchTerm.trim()) {
			return venues
		}

		const searchLower = venueSearchTerm.toLowerCase()
		return venues.filter(venue =>
			venue.name?.toLowerCase().includes(searchLower) ||
			venue.address?.toLowerCase().includes(searchLower) ||
			venue.city?.toLowerCase().includes(searchLower)
		)
	})

	// Get selected venue name for display
	let selectedVenueName = $derived.by(() => {
		if (!venueId) return ''
		const venue = venues.find(v => v.id === venueId)
		return venue?.name || ''
	})

	// Filter artists based on search
	let displayedArtists = $derived.by(() => {
		if (!artistSearchTerm.trim()) {
			return artists
		}

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
		selectedArtistIds = new Set(selectedArtistIds) // Trigger reactivity
	}

	function selectAllVisibleArtists() {
		displayedArtists.forEach(artist => {
			if (artist.id) selectedArtistIds.add(artist.id)
		})
		selectedArtistIds = new Set(selectedArtistIds)
	}

	function clearAllArtists() {
		selectedArtistIds.clear()
		selectedArtistIds = new Set()
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
			// Auto-generate title if blank
			const venue = venues.find(v => v.id === venueId)
			let finalTitle = title.trim()

			// Generate title automatically: "Artist @ Venue" or "Artist1 & Artist2 @ Venue"
			if (!finalTitle) {
				const selectedArtistNames = Array.from(selectedArtistIds)
					.map(artistId => {
						const artist = artists.find(a => a.id === artistId)
						return artist?.artist_name || artist?.full_name || 'Unknown Artist'
					})
					.filter(name => name !== 'Unknown Artist')

				if (selectedArtistNames.length === 0) {
					// No artists selected
					finalTitle = `Event @ ${venue?.name || 'Unknown Venue'}`
				} else if (selectedArtistNames.length === 1) {
					// Single artist
					finalTitle = `${selectedArtistNames[0]} @ ${venue?.name || 'Unknown Venue'}`
				} else if (selectedArtistNames.length === 2) {
					// Two artists
					finalTitle = `${selectedArtistNames[0]} & ${selectedArtistNames[1]} @ ${venue?.name || 'Unknown Venue'}`
				} else {
					// Multiple artists - show first and count
					finalTitle = `${selectedArtistNames[0]} +${selectedArtistNames.length - 1} @ ${venue?.name || 'Unknown Venue'}`
				}
			}

			// Prepare artist assignments
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

			// Create event data
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

			// Reset form
			resetForm()

			// Close modal and notify parent with the created event
			onSuccess?.(createdEvent)
			onClose?.()

		} catch (err) {
			console.error('Error creating event:', err)
			error = err instanceof Error ? err.message : 'Failed to create event'
		} finally {
			submitting = false
		}
	}

	function resetForm() {
		title = ''
		date = new Date().toISOString().split('T')[0]
		startTime = ''
		endTime = ''
		status = 'planned'
		venueId = null
		venueSearchTerm = ''
		showVenueDropdown = false
		selectedArtistIds.clear()
		selectedArtistIds = new Set()
		artistSearchTerm = ''
		assignmentMethod = 'manual'
		selectedInstrument = ''
		selectedGenre = ''
		selectedEnsembleSize = ''
		error = null
	}

	function handleClose() {
		resetForm()
		onClose?.()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === modalElement) {
			handleClose()
		}
	}

	function handleClickOutsideVenue(e: MouseEvent) {
		const target = e.target as HTMLElement
		if (!target.closest('.venue-dropdown-container')) {
			showVenueDropdown = false
		}
	}

	// Add click listener to close venue dropdown when clicking outside
	$effect(() => {
		if (showVenueDropdown && modalElement) {
			const handleClick = (e: MouseEvent) => handleClickOutsideVenue(e)
			document.addEventListener('click', handleClick)
			return () => document.removeEventListener('click', handleClick)
		}
	})
</script>

<dialog
	bind:this={modalElement}
	class="modal"
	onclick={handleBackdropClick}
>
	<div class="modal-box w-11/12 max-w-4xl max-h-[90vh]">
		<div class="flex items-center justify-between mb-6">
			<h3 class="font-bold text-lg">Create New Event</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost"
				onclick={handleClose}
			>
				✕
			</button>
		</div>

		{#if error}
			<div class="alert alert-error mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-6">
			<!-- Basic Info Section -->
			<div class="space-y-4">
				<h4 class="font-semibold text-base border-b pb-2">Event Information</h4>

				<!-- Event Title (Optional - auto-generated) -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Event Title (Optional)</span>
					</label>
					<input
						type="text"
						bind:value={title}
						placeholder="Leave blank to auto-generate from artist(s) and venue"
						class="input input-bordered"
						maxlength="200"
						disabled={submitting}
					/>
					<label class="label">
						<span class="label-text-alt text-info flex items-center gap-1">
							<Lightbulb class="w-3 h-3" />
							Will auto-generate as "Artist @ Venue" if left blank
						</span>
					</label>
				</div>

				<!-- Venue (Required) -->
				<div class="form-control relative venue-dropdown-container">
					<label class="label">
						<span class="label-text">Venue <span class="text-error">*</span></span>
					</label>

					{#if venueId && selectedVenueName}
						<!-- Display selected venue -->
						<div class="flex gap-2">
							<input
								type="text"
								value={selectedVenueName}
								class="input input-bordered flex-1"
								disabled
							/>
							<button
								type="button"
								class="btn btn-outline"
								onclick={clearVenueSelection}
								disabled={submitting}
							>
								Change
							</button>
						</div>
					{:else}
						<!-- Search input -->
						<input
							type="text"
							bind:value={venueSearchTerm}
							onfocus={() => showVenueDropdown = true}
							placeholder="Search venues by name, address, or city..."
							class="input input-bordered"
							disabled={submitting || loadingVenues}
							autocomplete="off"
						/>

						<!-- Dropdown list -->
						{#if showVenueDropdown && !loadingVenues}
							<div class="absolute top-full left-0 right-0 z-50 mt-1 border border-base-300 rounded-lg bg-base-100 shadow-lg max-h-64 overflow-y-auto">
								{#if filteredVenues.length > 0}
									{#each filteredVenues as venue}
										<button
											type="button"
											class="w-full text-left px-4 py-3 hover:bg-base-200 border-b border-base-300 last:border-b-0"
											onclick={() => selectVenue(venue)}
											disabled={submitting}
										>
											<div class="font-medium text-sm">{venue.name}</div>
											{#if venue.address || venue.city}
												<div class="text-xs text-base-content/60 mt-1">
													{#if venue.address}{venue.address}{/if}
													{#if venue.address && venue.city}, {/if}
													{#if venue.city}{venue.city}{/if}
												</div>
											{/if}
										</button>
									{/each}
								{:else}
									<div class="px-4 py-6 text-center text-sm text-base-content/60">
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
					{:else if !venueId}
						<label class="label">
							<span class="label-text-alt">{filteredVenues.length} venues available</span>
						</label>
					{/if}
				</div>

				<!-- Date and Times Row -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- Date (Required) -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Date <span class="text-error">*</span></span>
						</label>
						<input
							type="date"
							bind:value={date}
							class="input input-bordered"
							required
							disabled={submitting}
						/>
					</div>

					<!-- Start Time -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Start Time</span>
						</label>
						<select
							bind:value={startTime}
							class="select select-bordered"
							disabled={submitting}
						>
							<option value="">Not specified</option>
							{#each allTimeOptions as time}
								<option value={time}>{formatTimeDisplay(time)}</option>
							{/each}
						</select>
					</div>

					<!-- End Time -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">End Time</span>
						</label>
						<select
							bind:value={endTime}
							class="select select-bordered"
							disabled={submitting || !startTime}
						>
							<option value="">Not specified</option>
							{#each availableEndTimes as time}
								<option value={time}>{formatTimeDisplay(time)}</option>
							{/each}
						</select>
						{#if !startTime}
							<label class="label">
								<span class="label-text-alt">Select a start time first</span>
							</label>
						{/if}
					</div>
				</div>
			</div>

			<!-- Artist Assignment Section -->
			<div class="space-y-4">
				<div class="border-b pb-2">
					<h4 class="font-semibold text-base">Artist Assignment</h4>
				</div>

				<!-- Split Layout: Manual vs AI -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Manual Assignment Option -->
					<div class="border-2 rounded-lg p-4 transition-all {assignmentMethod === 'manual' ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-200/50'}">
						<div class="flex items-start gap-3 mb-3">
							<input
								type="radio"
								name="assignmentMethod"
								value="manual"
								checked={assignmentMethod === 'manual'}
								onchange={() => assignmentMethod = 'manual'}
								class="radio radio-primary radio-sm mt-1"
								disabled={submitting}
							/>
							<div class="flex-1">
								<h5 class="font-semibold text-sm mb-1">Assign Artists Manually</h5>
								<p class="text-xs text-base-content/70">Select specific artists from your roster</p>
							</div>
						</div>
						{#if assignmentMethod === 'manual'}
							<div class="space-y-3 mt-4">
								<!-- Artist Search -->
								<input
									type="text"
									bind:value={artistSearchTerm}
									placeholder="Search artists..."
									class="input input-bordered input-sm w-full"
									disabled={submitting}
								/>

								<!-- Artist List -->
								{#if loadingArtists}
									<div class="text-center py-4">
										<span class="loading loading-spinner loading-sm"></span>
									</div>
								{:else if displayedArtists.length > 0}
									<div class="border border-base-300 rounded-lg max-h-48 overflow-y-auto">
										{#each displayedArtists.slice(0, 5) as artist}
											<label class="flex items-center p-2 hover:bg-base-100 border-b border-base-300 last:border-b-0 cursor-pointer">
												<input
													type="checkbox"
													class="checkbox checkbox-primary checkbox-xs mr-2"
													checked={selectedArtistIds.has(artist.id!)}
													onchange={() => toggleArtist(artist.id!)}
													disabled={submitting}
												/>
												<div class="flex-1 min-w-0">
													<div class="font-medium text-xs truncate">
														{artist.full_name || artist.artist_name || 'Unknown'}
													</div>
												</div>
											</label>
										{/each}
									</div>
									{#if displayedArtists.length > 5}
										<p class="text-xs text-center text-base-content/60">
											Showing 5 of {displayedArtists.length} artists
										</p>
									{/if}
								{/if}

								<!-- Selected Preview -->
								{#if selectedArtistIds.size > 0}
									<div class="bg-primary/10 rounded p-2">
										<p class="text-xs font-medium mb-1">Selected: {selectedArtistIds.size}</p>
										<div class="flex flex-wrap gap-1">
											{#each Array.from(selectedArtistIds).slice(0, 3) as artistId}
												{@const artist = artists.find(a => a.id === artistId)}
												{#if artist}
													<span class="badge badge-primary badge-xs">
														{(artist.full_name || artist.artist_name || '').split(' ')[0]}
													</span>
												{/if}
											{/each}
											{#if selectedArtistIds.size > 3}
												<span class="badge badge-xs">+{selectedArtistIds.size - 3}</span>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- AI Matching Option -->
					<div class="border-2 rounded-lg p-4 transition-all {assignmentMethod === 'ai' ? 'border-secondary bg-secondary/5' : 'border-base-300 bg-base-200/50'}">
						<div class="flex items-start gap-3 mb-3">
							<input
								type="radio"
								name="assignmentMethod"
								value="ai"
								checked={assignmentMethod === 'ai'}
								onchange={() => assignmentMethod = 'ai'}
								class="radio radio-secondary radio-sm mt-1"
								disabled={submitting}
							/>
							<div class="flex-1">
								<div class="flex items-center gap-2 mb-1">
									<h5 class="font-semibold text-sm">AI Auto-Match</h5>
									<div class="flex gap-0.5">
										<span class="inline-block w-1 h-1 bg-secondary rounded-full animate-pulse" style="animation-delay: 0ms;"></span>
										<span class="inline-block w-1 h-1 bg-secondary rounded-full animate-pulse" style="animation-delay: 150ms;"></span>
										<span class="inline-block w-1 h-1 bg-secondary rounded-full animate-pulse" style="animation-delay: 300ms;"></span>
									</div>
								</div>
								<p class="text-xs text-base-content/70">AI finds artists matching your criteria</p>
							</div>
						</div>
						{#if assignmentMethod === 'ai'}
							<div class="space-y-3 mt-4">
								<p class="text-xs font-medium mb-2">Set Preferences:</p>

								<!-- Instrument -->
								<div class="form-control">
									<label class="label py-1">
										<span class="label-text text-xs">Instrument</span>
									</label>
									<select
										bind:value={selectedInstrument}
										class="select select-bordered select-sm w-full"
										disabled={submitting}
									>
										<option value="">Any</option>
										{#each instrumentOptions as instrument}
											<option value={instrument}>{instrument}</option>
										{/each}
									</select>
								</div>

								<!-- Genre -->
								<div class="form-control">
									<label class="label py-1">
										<span class="label-text text-xs">Genre</span>
									</label>
									<select
										bind:value={selectedGenre}
										class="select select-bordered select-sm w-full"
										disabled={submitting}
									>
										<option value="">Any</option>
										{#each genreOptions as genre}
											<option value={genre}>{genre}</option>
										{/each}
									</select>
								</div>

								<!-- Ensemble Size -->
								<div class="form-control">
									<label class="label py-1">
										<span class="label-text text-xs">Size</span>
									</label>
									<select
										bind:value={selectedEnsembleSize}
										class="select select-bordered select-sm w-full"
										disabled={submitting}
									>
										<option value="">Any</option>
										{#each ensembleSizeOptions as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>

								<div class="bg-secondary/10 rounded p-2 mt-3">
									<p class="text-xs text-secondary font-medium">
										🤖 AI will suggest best matches after event creation
									</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={handleClose}
					disabled={submitting}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={submitting || !venueId}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						Creating...
					{:else}
						Create Event
					{/if}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>
