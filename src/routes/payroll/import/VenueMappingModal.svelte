<script lang="ts">
	import { onMount } from 'svelte'
	import { venuesStore } from '$lib/stores/venues'
	import Modal from '$lib/components/ui/Modal.svelte'
	import SearchInput from '$lib/components/ui/SearchInput.svelte'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
	import type { Venue } from '$lib/schemas/venue'

	interface Props {
		conflict: any
		onVenueSelected: (venueId: number | null) => void
		onCancel: () => void
	}

	let { conflict, onVenueSelected, onCancel }: Props = $props()

	let allVenues: Venue[] = $state([])
	let filteredVenues: Venue[] = $state([])
	let searchTerm = $state('')
	let selectedVenue: Venue | null = $state(null)
	let isLoading = $state(true)
	let error: string | null = $state(null)
	let selectedAction: 'map' | 'skip' | null = $state(null)

	onMount(async () => {
		await loadVenues()
	})

	async function loadVenues() {
		isLoading = true
		error = null
		
		try {
			const result = await venuesStore.fetchAll()
			allVenues = result.data
			filteredVenues = allVenues
			
			// Pre-filter with similar venue names if available
			autoSuggestVenues()
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load venues'
		} finally {
			isLoading = false
		}
	}

	function autoSuggestVenues() {
		if (!conflict.value) return
		
		const searchValue = conflict.value.toLowerCase().trim()
		const suggestions = allVenues.filter(venue => {
			const venueName = venue.name?.toLowerCase() || ''
			const venueAddress = venue.address?.toLowerCase() || ''
			const venueCity = venue.city?.toLowerCase() || ''
			
			return venueName.includes(searchValue) || 
				   searchValue.includes(venueName) ||
				   venueAddress.includes(searchValue) ||
				   venueCity.includes(searchValue) ||
				   calculateSimilarity(venueName, searchValue) > 0.6
		})
		
		if (suggestions.length > 0) {
			filteredVenues = suggestions
		}
	}

	function handleSearch(term: string) {
		searchTerm = term
		if (!term.trim()) {
			autoSuggestVenues()
			return
		}

		const lowerTerm = term.toLowerCase().trim()
		filteredVenues = allVenues.filter(venue => {
			const searchableFields = [
				venue.name,
				venue.address,
				venue.city,
				venue.state,
				venue.venue_type,
				venue.contact_name
			].filter(Boolean).map(field => field!.toLowerCase())

			return searchableFields.some(field => 
				field.includes(lowerTerm) || 
				lowerTerm.includes(field) ||
				calculateSimilarity(field, lowerTerm) > 0.5
			)
		})
	}

	function calculateSimilarity(str1: string, str2: string): number {
		const longer = str1.length > str2.length ? str1 : str2
		const shorter = str1.length > str2.length ? str2 : str1
		
		if (longer.length === 0) return 1.0
		
		const editDistance = levenshteinDistance(longer, shorter)
		return (longer.length - editDistance) / longer.length
	}

	function levenshteinDistance(str1: string, str2: string): number {
		const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
		
		for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
		for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
		
		for (let j = 1; j <= str2.length; j++) {
			for (let i = 1; i <= str1.length; i++) {
				const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1
				matrix[j][i] = Math.min(
					matrix[j][i - 1] + 1,
					matrix[j - 1][i] + 1,
					matrix[j - 1][i - 1] + substitutionCost
				)
			}
		}
		
		return matrix[str2.length][str1.length]
	}

	function selectVenue(venue: Venue) {
		selectedVenue = venue
		selectedAction = 'map'
	}

	function selectSkip() {
		selectedVenue = null
		selectedAction = 'skip'
	}

	function confirmSelection() {
		if (selectedAction === 'map' && selectedVenue?.id) {
			onVenueSelected(selectedVenue.id)
		} else if (selectedAction === 'skip') {
			onVenueSelected(null)
		}
	}

	function resetSelection() {
		selectedVenue = null
		selectedAction = null
	}

	function getVenueDisplayName(venue: Venue): string {
		return venue.name || 'Unnamed Venue'
	}

	function getVenueSubtext(venue: Venue): string {
		const parts = []
		if (venue.venue_type) {
			parts.push(venue.venue_type)
		}
		if (venue.city && venue.state) {
			parts.push(`${venue.city}, ${venue.state}`)
		} else if (venue.city) {
			parts.push(venue.city)
		}
		if (venue.address) {
			parts.push(venue.address)
		}
		return parts.join(' • ')
	}

	// Calculate match confidence for visual indication
	function getMatchConfidence(venue: Venue): number {
		const originalName = conflict.value.toLowerCase()
		const venueName = venue.name?.toLowerCase() || ''
		
		if (originalName === venueName) return 1.0
		
		return calculateSimilarity(originalName, venueName)
	}

	// Group venues by match confidence
	let venueGroups = $derived({
		high: filteredVenues.filter(v => getMatchConfidence(v) > 0.8),
		medium: filteredVenues.filter(v => getMatchConfidence(v) > 0.6 && getMatchConfidence(v) <= 0.8),
		low: filteredVenues.filter(v => getMatchConfidence(v) <= 0.6)
	});
</script>

<Modal isOpen={true} onClose={onCancel} size="lg">
	<div class="p-6">
		<div class="flex justify-between items-center mb-6">
			<div>
				<h2 class="text-xl font-bold">Map Venue</h2>
				<p class="text-sm text-base-content/60">
					CSV contains: <strong>"{conflict.value}"</strong> (Row {conflict.row})
				</p>
			</div>
			<button class="btn btn-ghost btn-sm btn-circle" onclick={onCancel}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<LoadingSpinner size="lg" />
				<span class="ml-4">Loading venues...</span>
			</div>
		{:else if error}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{:else}
			<!-- Action Selection -->
			{#if !selectedAction}
				<div class="space-y-4 mb-6">
					<p class="text-base-content/80">
						This venue name was not found exactly in the system. Choose an option below:
					</p>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<!-- Map to Existing Venue -->
						<div 
							class="border-2 border-dashed border-base-300 rounded-lg p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
							onclick={() => selectedAction = 'map'}
						>
							<div class="text-center">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-primary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<h3 class="font-semibold text-lg mb-2">Map to Existing Venue</h3>
								<p class="text-sm text-base-content/60">
									Find and select a matching venue from the system
								</p>
							</div>
						</div>

						<!-- Skip Venue -->
						<div 
							class="border-2 border-dashed border-base-300 rounded-lg p-6 cursor-pointer hover:border-warning hover:bg-warning/5 transition-colors"
							onclick={selectSkip}
						>
							<div class="text-center">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-warning mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
								</svg>
								<h3 class="font-semibold text-lg mb-2">Skip Venue</h3>
								<p class="text-sm text-base-content/60">
									Import without venue information for this row
								</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Venue Selection Interface -->
			{#if selectedAction === 'map'}
				<div class="space-y-4">
					<div class="flex items-center mb-4">
						<button 
							class="btn btn-ghost btn-sm mr-3"
							onclick={resetSelection}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
						<h3 class="text-lg font-semibold">Select Matching Venue</h3>
					</div>

					<!-- Search -->
					<div class="mb-4">
						<SearchInput
							placeholder="Search venues by name, address, city, or type..."
							value={searchTerm}
							onInput={handleSearch}
						/>
					</div>

					<!-- Suggestions Banner -->
					{#if venueGroups.high.length > 0 && !searchTerm}
						<div class="alert alert-info mb-4">
							<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>Showing {venueGroups.high.length} high-confidence matches first. Use search to see all venues.</span>
						</div>
					{/if}

					<!-- Venues List -->
					<div class="max-h-96 overflow-y-auto mb-6">
						{#if filteredVenues.length === 0}
							<div class="text-center py-8">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
								<p class="text-base-content/60">
									{searchTerm ? 'No venues found matching your search' : 'No venues available'}
								</p>
								{#if searchTerm}
									<button class="btn btn-link btn-sm mt-2" onclick={() => handleSearch('')}>
										Clear search to see all venues
									</button>
								{/if}
							</div>
						{:else}
							<div class="space-y-4">
								<!-- High Confidence Matches -->
								{#if venueGroups.high.length > 0 && !searchTerm}
									<div>
										<h4 class="font-semibold text-sm text-success mb-2 flex items-center">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											High Confidence Matches
										</h4>
										<div class="space-y-2">
											{#each venueGroups.high as venue}
												{@const confidence = getMatchConfidence(venue)}
												<div 
													class="border rounded-lg p-3 cursor-pointer transition-colors hover:bg-base-200
														{selectedVenue?.id === venue.id ? 'border-primary bg-primary/10' : 'border-base-300'}"
													onclick={() => selectVenue(venue)}
												>
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<div class="flex items-center">
																<div class="font-medium">{getVenueDisplayName(venue)}</div>
																<span class="badge badge-success badge-sm ml-2">
																	{Math.round(confidence * 100)}% match
																</span>
															</div>
															{#if getVenueSubtext(venue)}
																<div class="text-sm text-base-content/60 mt-1">
																	{getVenueSubtext(venue)}
																</div>
															{/if}
														</div>
														<div class="flex items-center">
															{#if selectedVenue?.id === venue.id}
																<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
																</svg>
															{/if}
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Medium Confidence Matches -->
								{#if venueGroups.medium.length > 0 && !searchTerm}
									<div>
										<h4 class="font-semibold text-sm text-warning mb-2 flex items-center">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
											</svg>
											Possible Matches
										</h4>
										<div class="space-y-2">
											{#each venueGroups.medium as venue}
												{@const confidence = getMatchConfidence(venue)}
												<div 
													class="border rounded-lg p-3 cursor-pointer transition-colors hover:bg-base-200
														{selectedVenue?.id === venue.id ? 'border-primary bg-primary/10' : 'border-base-300'}"
													onclick={() => selectVenue(venue)}
												>
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<div class="flex items-center">
																<div class="font-medium">{getVenueDisplayName(venue)}</div>
																<span class="badge badge-warning badge-sm ml-2">
																	{Math.round(confidence * 100)}% match
																</span>
															</div>
															{#if getVenueSubtext(venue)}
																<div class="text-sm text-base-content/60 mt-1">
																	{getVenueSubtext(venue)}
																</div>
															{/if}
														</div>
														<div class="flex items-center">
															{#if selectedVenue?.id === venue.id}
																<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
																</svg>
															{/if}
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}

								<!-- All Results (when searching) or Low Confidence -->
								{#if searchTerm}
									<div class="space-y-2">
										{#each filteredVenues as venue}
											{@const confidence = getMatchConfidence(venue)}
											<div 
												class="border rounded-lg p-3 cursor-pointer transition-colors hover:bg-base-200
													{selectedVenue?.id === venue.id ? 'border-primary bg-primary/10' : 'border-base-300'}"
												onclick={() => selectVenue(venue)}
											>
												<div class="flex items-start justify-between">
													<div class="flex-1">
														<div class="flex items-center">
															<div class="font-medium">{getVenueDisplayName(venue)}</div>
															{#if confidence > 0.8}
																<span class="badge badge-success badge-sm ml-2">High Match</span>
															{:else if confidence > 0.6}
																<span class="badge badge-warning badge-sm ml-2">Partial Match</span>
															{/if}
														</div>
														{#if getVenueSubtext(venue)}
															<div class="text-sm text-base-content/60 mt-1">
																{getVenueSubtext(venue)}
															</div>
														{/if}
													</div>
													<div class="flex items-center">
														{#if selectedVenue?.id === venue.id}
															<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
															</svg>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								{:else if venueGroups.low.length > 0}
									<details class="collapse bg-base-200">
										<summary class="collapse-title text-sm font-medium">
											Show all venues ({venueGroups.low.length} more)
										</summary>
										<div class="collapse-content space-y-2">
											{#each venueGroups.low as venue}
												<div 
													class="border rounded-lg p-3 cursor-pointer transition-colors hover:bg-base-200
														{selectedVenue?.id === venue.id ? 'border-primary bg-primary/10' : 'border-base-300'}"
													onclick={() => selectVenue(venue)}
												>
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<div class="font-medium">{getVenueDisplayName(venue)}</div>
															{#if getVenueSubtext(venue)}
																<div class="text-sm text-base-content/60 mt-1">
																	{getVenueSubtext(venue)}
																</div>
															{/if}
														</div>
														<div class="flex items-center">
															{#if selectedVenue?.id === venue.id}
																<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
																</svg>
															{/if}
														</div>
													</div>
												</div>
											{/each}
										</div>
									</details>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Skip Confirmation -->
			{#if selectedAction === 'skip'}
				<div class="text-center py-6">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-warning mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
					<h3 class="text-lg font-semibold mb-2">Skip Venue Assignment</h3>
					<p class="text-base-content/60 mb-4">
						The payroll record will be imported without venue information. You can add venue details later if needed.
					</p>
					<button 
						class="btn btn-ghost btn-sm"
						onclick={resetSelection}
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
						Back to Options
					</button>
				</div>
			{/if}

			<!-- Actions -->
			{#if selectedAction}
				<div class="flex justify-between items-center mt-6 pt-6 border-t border-base-300">
					<div class="text-sm text-base-content/60">
						{#if selectedAction === 'map' && selectedVenue}
							Selected venue: <strong>{getVenueDisplayName(selectedVenue)}</strong>
						{:else if selectedAction === 'skip'}
							Skipping venue for this row
						{:else}
							Select a venue to continue
						{/if}
					</div>
					<div class="flex space-x-3">
						<button class="btn btn-ghost" onclick={onCancel}>
							Cancel
						</button>
						<button 
							class="btn btn-primary"
							disabled={selectedAction === 'map' && !selectedVenue}
							onclick={confirmSelection}
						>
							{selectedAction === 'map' ? 'Map Venue' : 'Skip Venue'}
						</button>
					</div>
				</div>
			{:else}
				<div class="flex justify-end mt-6 pt-6 border-t border-base-300">
					<button class="btn btn-ghost" onclick={onCancel}>
						Cancel
					</button>
				</div>
			{/if}
		{/if}
	</div>
</Modal>