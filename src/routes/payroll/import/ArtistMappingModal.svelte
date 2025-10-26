<script lang="ts">
	import { onMount } from 'svelte'
	import { artistsStore } from '$lib/stores/artists'
	import Modal from '$lib/components/ui/Modal.svelte'
	import SearchInput from '$lib/components/ui/SearchInput.svelte'
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte'
	import type { Artist } from '$lib/schemas/artist'

	interface Props {
		conflict: any
		onArtistSelected: (artistId: string) => void
		onCancel: () => void
	}

	let { conflict, onArtistSelected, onCancel }: Props = $props()

	let allArtists: Artist[] = $state([])
	let filteredArtists: Artist[] = $state([])
	let searchTerm = $state('')
	let selectedArtist: Artist | null = $state(null)
	let isLoading = $state(true)
	let error: string | null = $state(null)

	onMount(async () => {
		await loadArtists()
	})

	async function loadArtists() {
		isLoading = true
		error = null
		
		try {
			const result = await artistsStore.fetchAll()
			allArtists = result.data
			filteredArtists = allArtists
			
			// Pre-filter with suggestions if available
			if (conflict.suggestions?.length > 0) {
				filterArtistsBySuggestions()
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load artists'
		} finally {
			isLoading = false
		}
	}

	function filterArtistsBySuggestions() {
		if (conflict.suggestions?.length > 0) {
			const suggestionNames = conflict.suggestions.map((s: string) => s.toLowerCase())
			filteredArtists = allArtists.filter(artist => {
				const names = [
					artist.full_name?.toLowerCase(),
					artist.artist_name?.toLowerCase(),
					artist.legal_name?.toLowerCase(),
					`${artist.legal_first_name} ${artist.legal_last_name}`.toLowerCase(),
					`${artist.public_first_name} ${artist.public_last_name}`.toLowerCase()
				].filter(Boolean)
				
				return names.some(name => suggestionNames.includes(name))
			})
		}
	}

	function handleSearch(term: string) {
		searchTerm = term
		if (!term.trim()) {
			if (conflict.suggestions?.length > 0) {
				filterArtistsBySuggestions()
			} else {
				filteredArtists = allArtists
			}
			return
		}

		const lowerTerm = term.toLowerCase().trim()
		filteredArtists = allArtists.filter(artist => {
			const searchableFields = [
				artist.full_name,
				artist.artist_name,
				artist.legal_name,
				artist.legal_first_name,
				artist.legal_last_name,
				artist.public_first_name,
				artist.public_last_name,
				artist.email
			].filter(Boolean).map(field => field!.toLowerCase())

			return searchableFields.some(field => 
				field.includes(lowerTerm) || 
				lowerTerm.includes(field) ||
				calculateSimilarity(field, lowerTerm) > 0.6
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

	function selectArtist(artist: Artist) {
		selectedArtist = artist
	}

	function confirmSelection() {
		if (selectedArtist?.id) {
			onArtistSelected(selectedArtist.id)
		}
	}

	function getArtistDisplayName(artist: Artist): string {
		return artist.full_name || artist.artist_name || `${artist.public_first_name} ${artist.public_last_name}` || 'Unnamed Artist'
	}

	function getArtistSubtext(artist: Artist): string {
		const parts = []
		if (artist.artist_name && artist.artist_name !== artist.full_name) {
			parts.push(`Stage: ${artist.artist_name}`)
		}
		if (artist.email) {
			parts.push(artist.email)
		}
		return parts.join(' • ')
	}

	// Calculate match confidence for visual indication
	function getMatchConfidence(artist: Artist): number {
		const originalName = conflict.value.toLowerCase()
		const artistNames = [
			artist.full_name?.toLowerCase(),
			artist.artist_name?.toLowerCase(),
			`${artist.public_first_name} ${artist.public_last_name}`.toLowerCase()
		].filter(Boolean)

		let maxSimilarity = 0
		for (const name of artistNames) {
			const similarity = calculateSimilarity(originalName, name)
			maxSimilarity = Math.max(maxSimilarity, similarity)
		}

		return maxSimilarity
	}
</script>

<Modal isOpen={true} onClose={onCancel} size="lg">
	<div class="p-6">
		<div class="flex justify-between items-center mb-6">
			<div>
				<h2 class="text-xl font-bold">Select Artist</h2>
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
				<span class="ml-4">Loading artists...</span>
			</div>
		{:else if error}
			<div class="alert alert-error">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{error}</span>
			</div>
		{:else}
			<!-- Search -->
			<div class="mb-4">
				<SearchInput
					placeholder="Search artists by name, email, or other details..."
					value={searchTerm}
					onInput={handleSearch}
				/>
			</div>

			<!-- Suggestions Banner -->
			{#if conflict.suggestions?.length > 0 && !searchTerm}
				<div class="alert alert-info mb-4">
					<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>Showing {filteredArtists.length} suggested matches. Use search to see all artists.</span>
				</div>
			{/if}

			<!-- Artists List -->
			<div class="max-h-96 overflow-y-auto mb-6">
				{#if filteredArtists.length === 0}
					<div class="text-center py-8">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<p class="text-base-content/60">
							{searchTerm ? 'No artists found matching your search' : 'No artists available'}
						</p>
						{#if searchTerm}
							<button class="btn btn-link btn-sm mt-2" onclick={() => handleSearch('')}>
								Clear search to see all artists
							</button>
						{/if}
					</div>
				{:else}
					<div class="space-y-2">
						{#each filteredArtists as artist}
							{@const confidence = getMatchConfidence(artist)}
							<div 
								class="border rounded-lg p-3 cursor-pointer transition-colors hover:bg-base-200
									{selectedArtist?.id === artist.id ? 'border-primary bg-primary/10' : 'border-base-300'}"
								onclick={() => selectArtist(artist)}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="flex items-center">
											<div class="font-medium">{getArtistDisplayName(artist)}</div>
											{#if confidence > 0.8}
												<span class="badge badge-success badge-sm ml-2">High Match</span>
											{:else if confidence > 0.6}
												<span class="badge badge-warning badge-sm ml-2">Partial Match</span>
											{/if}
										</div>
										{#if getArtistSubtext(artist)}
											<div class="text-sm text-base-content/60 mt-1">
												{getArtistSubtext(artist)}
											</div>
										{/if}
									</div>
									<div class="flex items-center">
										{#if selectedArtist?.id === artist.id}
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex justify-between items-center">
				<div class="text-sm text-base-content/60">
					{#if selectedArtist}
						Selected: <strong>{getArtistDisplayName(selectedArtist)}</strong>
					{:else}
						Select an artist to continue
					{/if}
				</div>
				<div class="flex space-x-3">
					<button class="btn btn-ghost" onclick={onCancel}>
						Cancel
					</button>
					<button 
						class="btn btn-primary"
						disabled={!selectedArtist}
						onclick={confirmSelection}
					>
						Confirm Selection
					</button>
				</div>
			</div>

			<!-- Create New Artist Option -->
			<div class="mt-4 pt-4 border-t border-base-300">
				<div class="text-sm text-base-content/60 mb-2">
					Can't find the right artist?
				</div>
				<button class="btn btn-outline btn-sm">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Create New Artist
				</button>
			</div>
		{/if}
	</div>
</Modal>